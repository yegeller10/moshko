"use node";

import { action } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { api, internal } from "./_generated/api";
import { PDFDocument, PDFFont, PDFPage, rgb, degrees } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { createHash } from "crypto";
import { applyTemplate } from "./lib/offerDefaults";
import { buildOfferEmailHtml } from "./lib/offerEmailHtml";
import { NOTO_SANS_HEBREW_REGULAR_BASE64 } from "./lib/hebrewFontBase64";
import { NOTO_SANS_REGULAR_BASE64 } from "./lib/latinFontBase64";

type FontPair = { heb: PDFFont; lat: PDFFont };

const BRAND = rgb(0.043, 0.435, 0.761);
const BRAND_SOFT = rgb(0.91, 0.953, 0.984);
const BRAND_DARK = rgb(0.031, 0.353, 0.62);
const MUTED = rgb(0.45, 0.45, 0.45);
const INK = rgb(0.05, 0.05, 0.05);
const BORDER = rgb(0.82, 0.82, 0.82);
const GREEN = rgb(0.1, 0.4, 0.2);

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

function charScript(ch: string): "heb" | "lat" {
  if (isHebrewChar(ch)) return "heb";
  if (/[0-9A-Za-z@]/.test(ch)) return "lat";
  return "heb";
}

function splitRuns(text: string): Array<{ text: string; heb: boolean }> {
  const runs: Array<{ text: string; heb: boolean }> = [];
  let cur = "";
  let heb: boolean | null = null;
  for (const ch of text) {
    if (ch === " ") {
      cur += ch;
      continue;
    }
    const nextHeb = charScript(ch) === "heb";
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
  let totalW = 0;
  for (const run of runs) {
    const font = run.heb ? fonts.heb : fonts.lat;
    totalW += font.widthOfTextAtSize(run.text, size);
  }
  let x = rightX - totalW;
  for (const run of runs) {
    const font = run.heb ? fonts.heb : fonts.lat;
    if (run.text.length) {
      page.drawText(run.text, { x, y, size, font, color });
    }
    x += font.widthOfTextAtSize(run.text, size);
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

async function tryEmbedLogo(pdf: PDFDocument, logoUrl: string) {
  try {
    const res = await fetch(logoUrl);
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (ct.includes("png")) return await pdf.embedPng(bytes);
    if (ct.includes("jpeg") || ct.includes("jpg")) {
      return await pdf.embedJpg(bytes);
    }
    return null;
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
  const logo = await tryEmbedLogo(pdf, args.logoUrl);
  const page = pdf.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();
  const margin = 36;
  const right = width - margin;
  const left = margin;
  const co = offer.companySnapshot;

  let headerTop = height - margin;
  if (logo) {
    const logoH = 44;
    const logoW = (logo.width / logo.height) * logoH;
    page.drawImage(logo, {
      x: right - logoW,
      y: headerTop - logoH,
      width: logoW,
      height: logoH,
    });
    headerTop -= logoH + 8;
  }
  drawRtl(page, fonts, co.name, right, headerTop, 14, BRAND_DARK);
  headerTop -= 15;
  drawRtl(page, fonts, `עוסק מורשה ${co.vatId}`, right, headerTop, 9, MUTED);
  headerTop -= 13;
  drawRtl(page, fonts, co.address, right, headerTop, 9, MUTED);
  if (co.emails) {
    headerTop -= 13;
    drawRtl(page, fonts, co.emails, right, headerTop, 8, MUTED);
  }

  const boxW = 268;
  const boxX = left;
  const boxTop = height - margin;
  const boxPad = 14;
  let boxContentH = boxPad + 12 + 14 + 14;
  const clientLines = wrapRtl(fonts, args.clientName, boxW - boxPad * 2, 10);
  boxContentH += clientLines.length * 13;
  if (args.clientEmails) {
    const emLines = wrapRtl(fonts, args.clientEmails, boxW - boxPad * 2, 8);
    boxContentH += emLines.length * 11 + 4;
  }
  boxContentH += 18 + 14 + 12;
  const boxH = boxContentH + boxPad;
  page.drawRectangle({
    x: boxX,
    y: boxTop - boxH,
    width: boxW,
    height: boxH,
    color: BRAND_SOFT,
    borderColor: BRAND,
    borderWidth: 0.8,
  });

  let by = boxTop - boxPad - 10;
  drawLeft(
    page,
    fonts,
    formatDateOnly(args.issuedAt),
    boxX + boxPad,
    by,
    10,
    BRAND_DARK,
  );
  by -= 16;
  drawRtl(page, fonts, "לכבוד:", boxX + boxW - boxPad, by, 10, INK);
  by -= 14;
  for (const line of clientLines) {
    drawRtl(page, fonts, line, boxX + boxW - boxPad, by, 10, INK);
    by -= 13;
  }
  if (args.clientEmails) {
    by -= 2;
    const emLines = wrapRtl(fonts, args.clientEmails, boxW - boxPad * 2, 8);
    for (const line of emLines) {
      drawRtl(page, fonts, line, boxX + boxW - boxPad, by, 8, MUTED);
      by -= 11;
    }
  }
  by -= 8;
  drawRtl(
    page,
    fonts,
    `הצעת מחיר ${offer.number}`,
    boxX + boxW - boxPad,
    by,
    14,
    BRAND,
  );
  by -= 16;
  drawRtl(page, fonts, "העתק נאמן למקור", boxX + boxW - boxPad, by, 9, GREEN);

  let y = Math.min(headerTop, boxTop - boxH) - 22;
  drawRtl(page, fonts, offer.title, right, y, 13, INK);
  y -= 26;

  const colQtyRight = right;
  const colDescRight = right - 36;
  const colPriceLeft = left + 118;
  const colTotalLeft = left;
  drawRtl(page, fonts, "כמות", colQtyRight, y, 8, MUTED);
  drawRtl(page, fonts, "פירוט", colDescRight, y, 8, MUTED);
  drawLeft(page, fonts, "מחיר", colPriceLeft, y, 8, MUTED);
  drawLeft(page, fonts, "סה״כ", colTotalLeft, y, 8, MUTED);
  y -= 6;
  page.drawLine({
    start: { x: left, y },
    end: { x: right, y },
    thickness: 0.6,
    color: BORDER,
  });
  y -= 14;

  for (const item of offer.lineItems) {
    const descLines = wrapRtl(fonts, item.description, 300, 9);
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

  y -= 8;
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
  y -= 18;

  page.drawRectangle({
    x: left,
    y: y - 4,
    width: right - left,
    height: 22,
    color: BRAND_SOFT,
  });
  drawRtl(page, fonts, "סה״כ לתשלום", right, y, 13, BRAND);
  drawLeft(page, fonts, money(offer.grandTotal), colTotalLeft, y, 13, BRAND);
  y -= 28;

  if (offer.attention) {
    drawRtl(page, fonts, `לידי ${offer.attention}`, right, y, 11, INK);
    y -= 22;
  }

  y -= 8;
  const bank = offer.bankSnapshot;
  for (const line of bank.paymentTerms.split("\n")) {
    drawRtl(page, fonts, line, right, y, 10, INK);
    y -= 13;
  }
  drawRtl(page, fonts, bank.payee, right, y, 10, INK);
  y -= 13;
  drawRtl(page, fonts, bank.bank, right, y, 10, INK);
  y -= 13;
  drawRtl(page, fonts, bank.branch, right, y, 10, INK);
  y -= 13;
  drawRtl(page, fonts, `${bank.account} ח.מ`, right, y, 10, INK);

  const footer = `הופק ב ${formatIssuedAt(args.issuedAt)} | הצעת מחיר ${offer.number} | עמוד 1 מתוך 1`;
  drawRtl(page, fonts, footer, right, 24, 7.5, MUTED);

  page.drawText("העתק נאמן למקור", {
    x: width / 2 - 90,
    y: height / 2 - 10,
    size: 32,
    font: fonts.heb,
    color: rgb(0.88, 0.93, 0.96),
    rotate: degrees(35),
    opacity: 0.45,
  });

  return await pdf.save();
}
