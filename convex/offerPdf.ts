"use node";

import { action } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { api, internal } from "./_generated/api";
import { PDFDocument, PDFFont, PDFPage, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { createHash } from "crypto";
import { applyTemplate } from "./lib/offerDefaults";
import { buildOfferEmailHtml } from "./lib/offerEmailHtml";
import { NOTO_SANS_HEBREW_REGULAR_BASE64 } from "./lib/hebrewFontBase64";
import { NOTO_SANS_REGULAR_BASE64 } from "./lib/latinFontBase64";
import { LOGO_PNG_BASE64 } from "./lib/logoPngBase64";

type FontPair = { heb: PDFFont; lat: PDFFont };

/** Sample 308 brand blue */
const BRAND = rgb(0.043, 0.435, 0.761);
const BRAND_DARK = rgb(0.031, 0.353, 0.62);
const MUTED = rgb(0.42, 0.42, 0.42);
const INK = rgb(0.05, 0.05, 0.05);
const BORDER = rgb(0.78, 0.78, 0.78);
const WHITE = rgb(1, 1, 1);

function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function money(n: number) {
  return (
    "₪" +
    n.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function formatIssuedAt(ts: number) {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDateOnly(ts: number) {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function isHebrewChar(ch: string) {
  const code = ch.codePointAt(0) ?? 0;
  return code >= 0x0590 && code <= 0x05ff;
}

function isHebrewFontChar(ch: string) {
  return isHebrewChar(ch);
}

function normalizeOfferText(text: string) {
  return text
    .replace(/["\u201C\u201D]/g, "\u05F4")
    .replace(/['\u2018\u2019]/g, "\u05F3");
}

function splitRuns(text: string): Array<{ text: string; heb: boolean }> {
  const normalized = normalizeOfferText(text);
  const runs: Array<{ text: string; heb: boolean }> = [];
  let cur = "";
  let heb: boolean | null = null;
  for (const ch of normalized) {
    if (ch === " ") {
      cur += ch;
      continue;
    }
    const nextHeb = isHebrewFontChar(ch);
    if (heb === null) {
      heb = nextHeb;
      cur = ch;
      continue;
    }
    if (nextHeb === heb) {
      cur += ch;
    } else {
      runs.push({ text: cur, heb });
      cur = ch;
      heb = nextHeb;
    }
  }
  if (cur && heb !== null) runs.push({ text: cur, heb });

  // Prefer spaces before a Latin run so "לתאריך: 28" keeps space with the number.
  for (let i = 0; i < runs.length - 1; i++) {
    const run = runs[i]!;
    const next = runs[i + 1]!;
    const m = run.text.match(/^(.*?)(\s+)$/);
    if (m && run.heb && !next.heb) {
      run.text = m[1] ?? "";
      next.text = `${m[2] ?? ""}${next.text}`;
    }
  }

  return runs.length ? runs : [{ text: "", heb: true }];
}

function widthOf(fonts: FontPair, text: string, size: number) {
  let w = 0;
  for (const run of splitRuns(text)) {
    const font = run.heb ? fonts.heb : fonts.lat;
    w += font.widthOfTextAtSize(run.text, size);
  }
  return w;
}

async function loadFonts(pdf: PDFDocument): Promise<FontPair> {
  pdf.registerFontkit(fontkit);
  const heb = await pdf.embedFont(
    Buffer.from(NOTO_SANS_HEBREW_REGULAR_BASE64, "base64"),
  );
  const lat = await pdf.embedFont(
    Buffer.from(NOTO_SANS_REGULAR_BASE64, "base64"),
  );
  return { heb, lat };
}

/**
 * RTL paragraph draw: first logical run sits on the right.
 * Do NOT reverse Hebrew glyphs — PDF viewers apply bidi/shaping;
 * reversing would double-flip letters into mirrored gibberish.
 * Digits/punctuation use the Latin font (Hebrew font lacks those glyphs).
 */
function drawRtl(
  page: PDFPage,
  fonts: FontPair,
  text: string,
  rightX: number,
  y: number,
  size: number,
  color = INK,
) {
  const runs = splitRuns(text);
  let x = rightX;
  for (const run of runs) {
    const font = run.heb ? fonts.heb : fonts.lat;
    const w = font.widthOfTextAtSize(run.text, size);
    x -= w;
    if (run.text.length) {
      page.drawText(run.text, { x, y, size, font, color });
    }
  }
}

function drawLeft(
  page: PDFPage,
  fonts: FontPair,
  text: string,
  leftX: number,
  y: number,
  size: number,
  color = INK,
) {
  page.drawText(text, { x: leftX, y, size, font: fonts.lat, color });
}

function wrapRtl(
  fonts: FontPair,
  text: string,
  maxWidth: number,
  size: number,
) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (widthOf(fonts, next, size) <= maxWidth) {
      cur = next;
    } else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

async function embedLogo(pdf: PDFDocument, logoUrl: string) {
  const fromBytes = async (bytes: Uint8Array) => {
    if (bytes[0] === 0x89 && bytes[1] === 0x50) return pdf.embedPng(bytes);
    if (bytes[0] === 0xff && bytes[1] === 0xd8) return pdf.embedJpg(bytes);
    return null;
  };

  try {
    const res = await fetch(logoUrl);
    if (res.ok) {
      const bytes = new Uint8Array(await res.arrayBuffer());
      const img = await fromBytes(bytes);
      if (img) return img;
    }
  } catch {
    // fall through to embedded asset
  }
  try {
    return await fromBytes(Buffer.from(LOGO_PNG_BASE64, "base64"));
  } catch {
    return null;
  }
}

export const sendOffer = action({
  args: {
    offerId: v.id("offers"),
    toEmail: v.string(),
    appOrigin: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Unauthenticated");
    const me = await ctx.runQuery(api.users.me, {});
    if (!me || me.status !== "active") {
      throw new ConvexError("Not authorized");
    }

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;
    if (!apiKey || !from) {
      throw new ConvexError(
        "Email not configured. Set RESEND_API_KEY and EMAIL_FROM in Convex env.",
      );
    }

    const origin = args.appOrigin.replace(/\/$/, "");
    if (!/^https?:\/\//i.test(origin)) {
      throw new ConvexError("Invalid app origin");
    }

    const packed = await ctx.runQuery(internal.offers.getInternal, {
      id: args.offerId,
    });
    if (!packed?.offer) throw new ConvexError("Offer not found");
    const { offer, client, settings } = packed;
    if (offer.status === "cancelled") {
      throw new ConvexError("Offer cancelled");
    }

    const issuedAt = Date.now();
    const pdfBytes = await buildOfferPdf({
      offer,
      clientName: client?.name ?? "—",
      clientEmails: [
        ...(client?.emails ?? []),
        ...(client?.email ? [client.email] : []),
      ]
        .filter(Boolean)
        .join(", "),
      issuedAt,
      logoUrl: `${origin}/logo.png`,
    });

    const contentHash = createHash("sha256").update(pdfBytes).digest("hex");

    const uploadUrl = await ctx.runMutation(api.offers.generateUploadUrl, {});
    const uploadRes = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": "application/pdf" },
      body: pdfBytes,
    });
    if (!uploadRes.ok) {
      throw new ConvexError("Failed to upload PDF");
    }
    const { storageId } = (await uploadRes.json()) as {
      storageId: string;
    };

    const token = randomToken();
    const link = await ctx.runMutation(internal.emailLinks.createForOffer, {
      offerId: args.offerId,
      toEmail: args.toEmail,
      token,
      createdBy: me._id,
    });

    const linkUrl = `${origin}/c/${token}`;
    const acceptUrl = `${linkUrl}?action=approve`;

    const subjectTpl =
      settings?.emailSubjectTemplate ??
      "הצעת מחיר {{offerNumber}} — {{clientName}}";
    const subject = applyTemplate(subjectTpl, {
      offerNumber: String(offer.number),
      clientName: client?.name ?? "—",
    });

    const html = buildOfferEmailHtml({
      companyName: offer.companySnapshot.name,
      offerNumber: String(offer.number),
      clientName: client?.name ?? "—",
      title: offer.title,
      grandTotal: money(offer.grandTotal),
      acceptUrl,
      linkUrl,
      logoUrl: `${origin}/logo.png`,
    });

    const replyTo = process.env.EMAIL_REPLY_TO;
    const pdfBase64 = Buffer.from(pdfBytes).toString("base64");
    const body: Record<string, unknown> = {
      from,
      to: [args.toEmail.trim().toLowerCase()],
      subject,
      html,
      attachments: [
        {
          filename: `offer-${offer.number}.pdf`,
          content: pdfBase64,
        },
      ],
    };
    if (replyTo) body.reply_to = replyTo;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const payload = (await res.json().catch(() => ({}))) as {
      id?: string;
      message?: string;
      error?: string;
    };
    if (!res.ok) {
      throw new ConvexError(
        payload.message || payload.error || `Resend failed (${res.status})`,
      );
    }

    await ctx.runMutation(internal.offers.markIssued, {
      id: args.offerId,
      contentHash,
      pdfStorageId: storageId as never,
      sentToEmail: args.toEmail.trim().toLowerCase(),
    });
    await ctx.runMutation(internal.emailLinks.markSent, {
      linkId: link.linkId,
      resendId: payload.id,
    });

    return {
      ok: true as const,
      linkUrl,
      resendId: payload.id,
      contentHash,
      toEmail: args.toEmail.trim().toLowerCase(),
    };
  },
});

async function buildOfferPdf(args: {
  offer: {
    number: number;
    title: string;
    attention?: string;
    lineItems: Array<{
      quantity: number;
      description: string;
      unitPrice: number;
      total: number;
    }>;
    subtotal: number;
    vatRate: number;
    vatAmount: number;
    grandTotal: number;
    companySnapshot: {
      name: string;
      vatId: string;
      address: string;
      emails: string;
    };
    bankSnapshot: {
      payee: string;
      bank: string;
      branch: string;
      account: string;
      paymentTerms: string;
    };
  };
  clientName: string;
  clientEmails: string;
  issuedAt: number;
  logoUrl: string;
}): Promise<Uint8Array> {
  const { offer } = args;
  const pdf = await PDFDocument.create();
  const fonts = await loadFonts(pdf);
  const logo = await embedLogo(pdf, args.logoUrl);
  const page = pdf.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();
  const margin = 36;
  const right = width - margin;
  const left = margin;
  const co = offer.companySnapshot;

  // --- Header: logo + company (LEFT), solid blue client block (RIGHT) ---
  const boxW = 300;
  const boxX = right - boxW;
  const boxTop = height - margin;
  const boxPad = 14;

  const clientLines = wrapRtl(fonts, args.clientName, boxW - boxPad * 2, 10);
  const emailLines = args.clientEmails
    ? wrapRtl(fonts, args.clientEmails, boxW - boxPad * 2, 8)
    : [];
  const boxH =
    boxPad +
    14 + // date
    16 + // לכבוד
    clientLines.length * 13 +
    (emailLines.length ? emailLines.length * 11 + 4 : 0) +
    10 + // line gap
    1 + // separator
    12 +
    18 + // title
    14 + // copy line
    boxPad;

  page.drawRectangle({
    x: boxX,
    y: boxTop - boxH,
    width: boxW,
    height: boxH,
    color: BRAND,
  });

  let by = boxTop - boxPad - 2;
  drawRtl(
    page,
    fonts,
    formatDateOnly(args.issuedAt),
    boxX + boxW - boxPad,
    by,
    10,
    WHITE,
  );
  by -= 16;
  drawRtl(page, fonts, "לכבוד:", boxX + boxW - boxPad, by, 10, WHITE);
  by -= 14;
  for (const line of clientLines) {
    drawRtl(page, fonts, line, boxX + boxW - boxPad, by, 10, WHITE);
    by -= 13;
  }
  if (emailLines.length) {
    by -= 2;
    for (const line of emailLines) {
      drawRtl(page, fonts, line, boxX + boxW - boxPad, by, 8, WHITE);
      by -= 11;
    }
  }
  by -= 8;
  page.drawLine({
    start: { x: boxX + boxPad, y: by },
    end: { x: boxX + boxW - boxPad, y: by },
    thickness: 0.8,
    color: WHITE,
  });
  by -= 16;
  drawRtl(
    page,
    fonts,
    `הצעת מחיר ${offer.number}`,
    boxX + boxW - boxPad,
    by,
    16,
    WHITE,
  );
  by -= 16;
  drawRtl(page, fonts, "העתק נאמן למקור", boxX + boxW - boxPad, by, 9, WHITE);

  // Left brand column
  let headerTop = height - margin;
  if (logo) {
    const logoH = 72;
    const logoW = (logo.width / logo.height) * logoH;
    page.drawImage(logo, {
      x: left,
      y: headerTop - logoH,
      width: Math.min(logoW, 150),
      height: logoH * (Math.min(logoW, 150) / logoW),
    });
    headerTop -= logoH + 10;
  } else {
    drawRtl(page, fonts, co.name, left + 160, headerTop, 14, BRAND_DARK);
    headerTop -= 18;
  }
  drawRtl(
    page,
    fonts,
    `עוסק מורשה ${co.vatId}`,
    left + 160,
    headerTop,
    9,
    MUTED,
  );
  headerTop -= 12;
  drawRtl(page, fonts, co.address, left + 160, headerTop, 9, MUTED);
  if (co.emails) {
    headerTop -= 12;
    drawRtl(page, fonts, co.emails, left + 160, headerTop, 8, MUTED);
  }

  let y = Math.min(headerTop, boxTop - boxH) - 28;
  drawRtl(page, fonts, offer.title, right, y, 13, INK);
  y -= 24;

  const colQtyRight = right;
  const colDescRight = right - 40;
  const colPriceLeft = left + 110;
  const colTotalLeft = left;
  const descMaxW = colDescRight - (colPriceLeft + 70);

  drawRtl(page, fonts, "כמות", colQtyRight, y, 8, MUTED);
  drawRtl(page, fonts, "פירוט", colDescRight, y, 8, MUTED);
  drawRtl(page, fonts, "מחיר", colPriceLeft + 48, y, 8, MUTED);
  drawRtl(page, fonts, "סה״כ", colTotalLeft + 48, y, 8, MUTED);
  y -= 6;
  page.drawLine({
    start: { x: left, y },
    end: { x: right, y },
    thickness: 0.6,
    color: BORDER,
  });
  y -= 14;

  for (const item of offer.lineItems) {
    const descLines = wrapRtl(fonts, item.description, descMaxW, 9);
    const rowHeight = Math.max(14, descLines.length * 12);
    drawRtl(page, fonts, String(item.quantity), colQtyRight, y, 10, INK);
    let dy = y;
    for (const line of descLines) {
      drawRtl(page, fonts, line, colDescRight, dy, 9, INK);
      dy -= 12;
    }
    drawLeft(page, fonts, money(item.unitPrice), colPriceLeft, y, 9, INK);
    drawLeft(page, fonts, money(item.total), colTotalLeft, y, 9, INK);
    y -= rowHeight + 5;
  }

  y -= 6;
  page.drawLine({
    start: { x: left, y },
    end: { x: right, y },
    thickness: 0.6,
    color: BORDER,
  });
  y -= 16;

  drawRtl(page, fonts, "סה״כ", right, y, 11, INK);
  drawLeft(page, fonts, money(offer.subtotal), colTotalLeft, y, 11, INK);
  y -= 15;
  drawRtl(
    page,
    fonts,
    `מע״מ ${Math.round(offer.vatRate * 100)}%`,
    right,
    y,
    11,
    INK,
  );
  drawLeft(page, fonts, money(offer.vatAmount), colTotalLeft, y, 11, INK);
  y -= 20;

  // Grand total: blue amount pill on the left (308 style), label on the right
  const totalLabel = "סה״כ לתשלום";
  const totalStr = money(offer.grandTotal);
  const totalW = fonts.lat.widthOfTextAtSize(totalStr, 13) + 16;
  const totalH = 22;
  page.drawRectangle({
    x: left,
    y: y - 5,
    width: totalW,
    height: totalH,
    color: BRAND,
  });
  drawLeft(page, fonts, totalStr, left + 8, y, 13, WHITE);
  drawRtl(page, fonts, totalLabel, right, y, 13, INK);
  y -= 28;

  if (offer.attention) {
    drawRtl(page, fonts, `לידי ${offer.attention}`, right, y, 11, INK);
    y -= 20;
  }

  page.drawLine({
    start: { x: left, y },
    end: { x: right, y },
    thickness: 0.5,
    color: BORDER,
  });
  y -= 16;

  const bank = offer.bankSnapshot;
  const termLines = bank.paymentTerms.split("\n").filter((l) => l.trim());
  termLines.forEach((line, i) => {
    const text =
      i === 0 && !line.trimStart().startsWith("*") ? `* ${line}` : line;
    drawRtl(page, fonts, text, right, y, 10, INK);
    y -= 13;
  });
  drawRtl(page, fonts, bank.payee, right, y, 10, INK);
  y -= 13;
  drawRtl(page, fonts, bank.bank, right, y, 10, INK);
  y -= 13;
  drawRtl(page, fonts, bank.branch, right, y, 10, INK);
  y -= 13;
  drawRtl(page, fonts, `מ.ח ${bank.account}`, right, y, 10, INK);

  let footerX = right;
  const footerParts = [
    `עמוד 1 מתוך 1`,
    `הצעת מחיר ${offer.number}`,
    `הופק ב ${formatIssuedAt(args.issuedAt)}`,
  ];
  for (let i = 0; i < footerParts.length; i++) {
    const part = footerParts[i]!;
    drawRtl(page, fonts, part, footerX, 24, 7.5, MUTED);
    footerX -= widthOf(fonts, part, 7.5);
    if (i < footerParts.length - 1) {
      drawRtl(page, fonts, " | ", footerX, 24, 7.5, MUTED);
      footerX -= widthOf(fonts, " | ", 7.5);
    }
  }

  return await pdf.save();
}
