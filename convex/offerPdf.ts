"use node";

import { action } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { api, internal } from "./_generated/api";
import { PDFDocument, PDFFont, PDFPage, rgb, degrees } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { createHash } from "crypto";
import { applyTemplate } from "./lib/offerDefaults";

/** pdf-lib draws LTR; reverse Hebrew runs for visual RTL. */
function prepareText(text: string): string {
  if (!/[\u0590-\u05FF]/.test(text)) return text;
  return [...text].reverse().join("");
}

function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function money(n: number) {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 2,
  }).format(n);
}

function formatIssuedAt(ts: number) {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function loadHebrewFont(pdf: PDFDocument) {
  pdf.registerFontkit(fontkit);
  const urls = [
    "https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSansHebrew/NotoSansHebrew-Regular.ttf",
    "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSansHebrew/NotoSansHebrew-Regular.ttf",
  ];
  let lastErr: unknown;
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const bytes = await res.arrayBuffer();
      return await pdf.embedFont(bytes);
    } catch (e) {
      lastErr = e;
    }
  }
  throw new ConvexError(
    `Could not load Hebrew font: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`,
  );
}

/** Draw RTL text by measuring width and placing from the right edge. */
function drawRtl(
  page: PDFPage,
  font: PDFFont,
  text: string,
  rightX: number,
  y: number,
  size: number,
  color = rgb(0.05, 0.05, 0.05),
) {
  const shaped = prepareText(text);
  const width = font.widthOfTextAtSize(shaped, size);
  page.drawText(shaped, {
    x: rightX - width,
    y,
    size,
    font,
    color,
  });
  return width;
}

function wrapRtl(
  font: PDFFont,
  text: string,
  maxWidth: number,
  size: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(prepareText(next), size) <= maxWidth) {
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
      "<p>הצעת מחיר {{offerNumber}}</p><p><a href=\"{{acceptUrl}}\">אישור</a> · <a href=\"{{disputeUrl}}\">ערעור</a></p>";

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
  const font = await loadHebrewFont(pdf);
  const page = pdf.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();
  const margin = 40;
  const right = width - margin;
  const left = margin;
  let y = height - margin;

  const co = offer.companySnapshot;
  drawRtl(page, font, co.name, right, y, 14);
  y -= 16;
  drawRtl(page, font, `עוסק מורשה ${co.vatId}`, right, y, 10);
  y -= 14;
  drawRtl(page, font, co.address, right, y, 10);
  y -= 14;
  if (co.emails) {
    drawRtl(page, font, co.emails, right, y, 9, rgb(0.3, 0.3, 0.3));
    y -= 14;
  }

  // Client block (left side of header area) — RTL so "לכבוד" near left-of-right content
  let cy = height - margin;
  drawRtl(page, font, formatIssuedAt(args.issuedAt).split(" ")[0]!, left + 160, cy, 10);
  cy -= 14;
  drawRtl(page, font, "לכבוד:", left + 160, cy, 10);
  cy -= 14;
  const clientLines = wrapRtl(font, args.clientName, 200, 11);
  for (const line of clientLines) {
    drawRtl(page, font, line, left + 200, cy, 11);
    cy -= 14;
  }
  if (args.clientEmails) {
    const emLines = wrapRtl(font, args.clientEmails, 200, 9);
    for (const line of emLines) {
      drawRtl(page, font, line, left + 200, cy, 9, rgb(0.35, 0.35, 0.35));
      cy -= 12;
    }
  }

  y = Math.min(y, cy) - 20;
  drawRtl(page, font, `הצעת מחיר ${offer.number}`, right, y, 16);
  drawRtl(
    page,
    font,
    "העתק נאמן למקור",
    left + 120,
    y,
    11,
    rgb(0.1, 0.4, 0.2),
  );
  y -= 22;
  drawRtl(page, font, offer.title, right, y, 13);
  y -= 28;

  // Table header
  const colQty = right;
  const colDesc = right - 50;
  const colUnit = left + 160;
  const colTotal = left + 70;
  drawRtl(page, font, "כמות", colQty, y, 9, rgb(0.4, 0.4, 0.4));
  drawRtl(page, font, "פירוט", colDesc, y, 9, rgb(0.4, 0.4, 0.4));
  drawRtl(page, font, "מחיר", colUnit, y, 9, rgb(0.4, 0.4, 0.4));
  drawRtl(page, font, "סה״כ", colTotal, y, 9, rgb(0.4, 0.4, 0.4));
  y -= 8;
  page.drawLine({
    start: { x: left, y },
    end: { x: right, y },
    thickness: 0.5,
    color: rgb(0.75, 0.75, 0.75),
  });
  y -= 14;

  for (const item of offer.lineItems) {
    const descLines = wrapRtl(font, item.description, 280, 9);
    const rowHeight = Math.max(14, descLines.length * 12);
    if (y - rowHeight < 140) {
      // simple single-page for v1; shrink remaining
    }
    drawRtl(page, font, String(item.quantity), colQty, y, 10);
    let dy = y;
    for (const line of descLines) {
      drawRtl(page, font, line, colDesc, dy, 9);
      dy -= 12;
    }
    drawRtl(page, font, money(item.unitPrice), colUnit, y, 9);
    drawRtl(page, font, money(item.total), colTotal, y, 9);
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
  drawRtl(page, font, "סה״כ", right, y, 11);
  drawRtl(page, font, money(offer.subtotal), colTotal, y, 11);
  y -= 16;
  drawRtl(
    page,
    font,
    `מע״מ ${Math.round(offer.vatRate * 100)}%`,
    right,
    y,
    11,
  );
  drawRtl(page, font, money(offer.vatAmount), colTotal, y, 11);
  y -= 18;
  drawRtl(page, font, "סה״כ לתשלום", right, y, 13, rgb(0.04, 0.43, 0.76));
  drawRtl(
    page,
    font,
    money(offer.grandTotal),
    colTotal,
    y,
    13,
    rgb(0.04, 0.43, 0.76),
  );

  if (offer.attention) {
    y -= 24;
    drawRtl(page, font, `לידי ${offer.attention}`, right, y, 11);
  }

  y -= 30;
  const bank = offer.bankSnapshot;
  for (const line of bank.paymentTerms.split("\n")) {
    drawRtl(page, font, line, right, y, 10);
    y -= 13;
  }
  drawRtl(page, font, bank.payee, right, y, 10);
  y -= 13;
  drawRtl(page, font, bank.bank, right, y, 10);
  y -= 13;
  drawRtl(page, font, bank.branch, right, y, 10);
  y -= 13;
  drawRtl(page, font, `${bank.account} ח.מ`, right, y, 10);

  // Footer
  const footer = `הופק ב ${formatIssuedAt(args.issuedAt)} | הצעת מחיר ${offer.number} | עמוד 1 מתוך 1`;
  drawRtl(page, font, footer, right, 28, 8, rgb(0.45, 0.45, 0.45));

  // Faithful-copy watermark-ish rotation small
  page.drawText(prepareText("העתק נאמן למקור"), {
    x: width / 2 - 40,
    y: height / 2,
    size: 28,
    font,
    color: rgb(0.85, 0.9, 0.85),
    rotate: degrees(35),
    opacity: 0.35,
  });

  return await pdf.save();
}
