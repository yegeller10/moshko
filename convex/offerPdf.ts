"use node";

import { action } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { api, internal } from "./_generated/api";
import { PDFDocument, PDFFont, PDFPage, rgb, degrees } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { createHash } from "crypto";
import { applyTemplate } from "./lib/offerDefaults";
import { NOTO_SANS_HEBREW_REGULAR_BASE64 } from "./lib/hebrewFontBase64";
import { NOTO_SANS_REGULAR_BASE64 } from "./lib/latinFontBase64";

type FontPair = { heb: PDFFont; lat: PDFFont };

function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Shekel + ASCII digits (Latin font). */
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

function isHebrewChar(ch: string) {
  const code = ch.codePointAt(0) ?? 0;
  return code >= 0x0590 && code <= 0x05ff;
}

/** Split into Hebrew vs Latin/digit/punct runs for dual-font drawing. */
function splitRuns(text: string): Array<{ text: string; heb: boolean }> {
  const runs: Array<{ text: string; heb: boolean }> = [];
  let cur = "";
  let heb: boolean | null = null;
  for (const ch of text) {
    if (ch === " " && heb !== null) {
      cur += ch;
      continue;
    }
    const nextHeb = isHebrewChar(ch);
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

  // Move trailing spaces from a Hebrew run onto the following Latin run
  // so RTL painting keeps a visible gap (e.g. "הצעת מחיר 308").
  for (let i = 0; i < runs.length - 1; i++) {
    const run = runs[i]!;
    const next = runs[i + 1]!;
    const m = run.text.match(/^(.*?)(\s+)$/);
    if (m && run.heb && !next.heb) {
      run.text = m[1]!;
      next.text = m[2]! + next.text;
    }
  }

  return runs.length ? runs : [{ text: "", heb: false }];
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
 * Draw mixed Hebrew/Latin right-aligned.
 * Do NOT reverse Hebrew — NotoSansHebrew glyphs are drawn in logical order.
 */
function drawRtl(
  page: PDFPage,
  fonts: FontPair,
  text: string,
  rightX: number,
  y: number,
  size: number,
  color = rgb(0.05, 0.05, 0.05),
) {
  const runs = splitRuns(text);
  let x = rightX;
  // Paint from the right: rightmost run first.
  for (const run of [...runs].reverse()) {
    const font = run.heb ? fonts.heb : fonts.lat;
    const w = font.widthOfTextAtSize(run.text, size);
    x -= w;
    if (run.text.length) {
      page.drawText(run.text, { x, y, size, font, color });
    }
  }
  return rightX - x;
}

function wrapRtl(fonts: FontPair, text: string, maxWidth: number, size: number) {
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
    const disputeUrl = `${linkUrl}?action=dispute`;

    const subjectTpl =
      settings?.emailSubjectTemplate ??
      "הצעת מחיר {{offerNumber}} — {{clientName}}";
    const bodyTpl =
      settings?.emailBodyTemplate ??
      '<p>הצעת מחיר {{offerNumber}}</p><p><a href="{{acceptUrl}}">אישור</a> · <a href="{{disputeUrl}}">ערעור</a></p>';

    const vars = {
      offerNumber: String(offer.number),
      clientName: client?.name ?? "—",
      title: offer.title,
      companyName: offer.companySnapshot.name,
      subtotal: money(offer.subtotal),
      vat: money(offer.vatAmount),
      grandTotal: money(offer.grandTotal),
      linkUrl,
      acceptUrl,
      disputeUrl,
    };

    const subject = applyTemplate(subjectTpl, vars);
    const html = applyTemplate(bodyTpl, vars);

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
}): Promise<Uint8Array> {
  const { offer } = args;
  const pdf = await PDFDocument.create();
  const fonts = await loadFonts(pdf);
  const page = pdf.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();
  const margin = 40;
  const right = width - margin;
  const left = margin;
  let y = height - margin;

  const co = offer.companySnapshot;
  drawRtl(page, fonts, co.name, right, y, 14);
  y -= 16;
  drawRtl(page, fonts, `עוסק מורשה ${co.vatId}`, right, y, 10);
  y -= 14;
  drawRtl(page, fonts, co.address, right, y, 10);
  y -= 14;
  if (co.emails) {
    drawRtl(page, fonts, co.emails, right, y, 9, rgb(0.3, 0.3, 0.3));
    y -= 14;
  }

  let cy = height - margin;
  drawRtl(
    page,
    fonts,
    formatIssuedAt(args.issuedAt).split(" ")[0]!,
    left + 160,
    cy,
    10,
  );
  cy -= 14;
  drawRtl(page, fonts, "לכבוד:", left + 160, cy, 10);
  cy -= 14;
  const clientLines = wrapRtl(fonts, args.clientName, 200, 11);
  for (const line of clientLines) {
    drawRtl(page, fonts, line, left + 200, cy, 11);
    cy -= 14;
  }
  if (args.clientEmails) {
    const emLines = wrapRtl(fonts, args.clientEmails, 200, 9);
    for (const line of emLines) {
      drawRtl(page, fonts, line, left + 200, cy, 9, rgb(0.35, 0.35, 0.35));
      cy -= 12;
    }
  }

  y = Math.min(y, cy) - 20;
  drawRtl(page, fonts, `הצעת מחיר ${offer.number}`, right, y, 16);
  drawRtl(
    page,
    fonts,
    "העתק נאמן למקור",
    left + 120,
    y,
    11,
    rgb(0.1, 0.4, 0.2),
  );
  y -= 22;
  drawRtl(page, fonts, offer.title, right, y, 13);
  y -= 28;

  const colQty = right;
  const colDesc = right - 50;
  const colUnit = left + 160;
  const colTotal = left + 70;
  drawRtl(page, fonts, "כמות", colQty, y, 9, rgb(0.4, 0.4, 0.4));
  drawRtl(page, fonts, "פירוט", colDesc, y, 9, rgb(0.4, 0.4, 0.4));
  drawRtl(page, fonts, "מחיר", colUnit, y, 9, rgb(0.4, 0.4, 0.4));
  drawRtl(page, fonts, "סה״כ", colTotal, y, 9, rgb(0.4, 0.4, 0.4));
  y -= 8;
  page.drawLine({
    start: { x: left, y },
    end: { x: right, y },
    thickness: 0.5,
    color: rgb(0.75, 0.75, 0.75),
  });
  y -= 14;

  for (const item of offer.lineItems) {
    const descLines = wrapRtl(fonts, item.description, 280, 9);
    const rowHeight = Math.max(14, descLines.length * 12);
    drawRtl(page, fonts, String(item.quantity), colQty, y, 10);
    let dy = y;
    for (const line of descLines) {
      drawRtl(page, fonts, line, colDesc, dy, 9);
      dy -= 12;
    }
    drawRtl(page, fonts, money(item.unitPrice), colUnit, y, 9);
    drawRtl(page, fonts, money(item.total), colTotal, y, 9);
    y -= rowHeight + 4;
  }

  y -= 10;
  page.drawLine({
    start: { x: left, y },
    end: { x: right, y },
    thickness: 0.5,
    color: rgb(0.75, 0.75, 0.75),
  });
  y -= 18;
  drawRtl(page, fonts, "סה״כ", right, y, 11);
  drawRtl(page, fonts, money(offer.subtotal), colTotal, y, 11);
  y -= 16;
  drawRtl(
    page,
    fonts,
    `מע״מ ${Math.round(offer.vatRate * 100)}%`,
    right,
    y,
    11,
  );
  drawRtl(page, fonts, money(offer.vatAmount), colTotal, y, 11);
  y -= 18;
  drawRtl(page, fonts, "סה״כ לתשלום", right, y, 13, rgb(0.04, 0.43, 0.76));
  drawRtl(
    page,
    fonts,
    money(offer.grandTotal),
    colTotal,
    y,
    13,
    rgb(0.04, 0.43, 0.76),
  );

  if (offer.attention) {
    y -= 24;
    drawRtl(page, fonts, `לידי ${offer.attention}`, right, y, 11);
  }

  y -= 30;
  const bank = offer.bankSnapshot;
  for (const line of bank.paymentTerms.split("\n")) {
    drawRtl(page, fonts, line, right, y, 10);
    y -= 13;
  }
  drawRtl(page, fonts, bank.payee, right, y, 10);
  y -= 13;
  drawRtl(page, fonts, bank.bank, right, y, 10);
  y -= 13;
  drawRtl(page, fonts, bank.branch, right, y, 10);
  y -= 13;
  drawRtl(page, fonts, `${bank.account} ח.מ`, right, y, 10);

  const footer = `הופק ב ${formatIssuedAt(args.issuedAt)} | הצעת מחיר ${offer.number} | עמוד 1 מתוך 1`;
  drawRtl(page, fonts, footer, right, 28, 8, rgb(0.45, 0.45, 0.45));

  page.drawText("העתק נאמן למקור", {
    x: width / 2 - 80,
    y: height / 2,
    size: 28,
    font: fonts.heb,
    color: rgb(0.85, 0.9, 0.85),
    rotate: degrees(35),
    opacity: 0.35,
  });

  return await pdf.save();
}
