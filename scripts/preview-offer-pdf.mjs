/**
 * Local visual QA for offer PDF (mirrors convex/offerPdf.ts drawing).
 * Usage: node scripts/preview-offer-pdf.mjs
 */
import fs from "fs";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

const BRAND = rgb(0.043, 0.435, 0.761);
const BRAND_DARK = rgb(0.031, 0.353, 0.62);
const MUTED = rgb(0.42, 0.42, 0.42);
const INK = rgb(0.05, 0.05, 0.05);
const BORDER = rgb(0.78, 0.78, 0.78);
const WHITE = rgb(1, 1, 1);

const hebB = fs.readFileSync("convex/fonts/NotoSansHebrew-Regular.ttf");
const latB = fs.readFileSync("convex/fonts/NotoSans-Regular.ttf");
const logoB = fs.readFileSync("public/logo.png");

function isHebrewChar(ch) {
  const code = ch.codePointAt(0) ?? 0;
  return code >= 0x0590 && code <= 0x05ff;
}
function normalizeOfferText(text) {
  return text
    .replace(/["\u201C\u201D]/g, "\u05F4")
    .replace(/['\u2018\u2019]/g, "\u05F3");
}
function splitRuns(text) {
  const normalized = normalizeOfferText(text);
  const runs = [];
  let cur = "";
  let heb = null;
  for (const ch of normalized) {
    if (ch === " ") {
      cur += ch;
      continue;
    }
    const nextHeb = isHebrewChar(ch);
    if (heb === null) {
      heb = nextHeb;
      cur = ch;
      continue;
    }
    if (nextHeb === heb) cur += ch;
    else {
      runs.push({ text: cur, heb });
      cur = ch;
      heb = nextHeb;
    }
  }
  if (cur && heb !== null) runs.push({ text: cur, heb });
  for (let i = 0; i < runs.length - 1; i++) {
    const run = runs[i];
    const next = runs[i + 1];
    const m = run.text.match(/^(.*?)(\s+)$/);
    if (m && run.heb && !next.heb) {
      run.text = m[1];
      next.text = m[2] + next.text;
    }
  }
  return runs.length ? runs : [{ text: "", heb: true }];
}
function widthOf(fonts, text, size) {
  let w = 0;
  for (const run of splitRuns(text)) {
    w += (run.heb ? fonts.heb : fonts.lat).widthOfTextAtSize(run.text, size);
  }
  return w;
}
function drawRtl(page, fonts, text, rightX, y, size, color = INK) {
  const runs = splitRuns(text);
  let x = rightX;
  for (const run of runs) {
    const font = run.heb ? fonts.heb : fonts.lat;
    const w = font.widthOfTextAtSize(run.text, size);
    x -= w;
    if (run.text.length) page.drawText(run.text, { x, y, size, font, color });
  }
}
function drawLeft(page, fonts, text, leftX, y, size, color = INK) {
  page.drawText(text, { x: leftX, y, size, font: fonts.lat, color });
}
function wrapRtl(fonts, text, maxWidth, size) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (widthOf(fonts, next, size) <= maxWidth) cur = next;
    else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}
function money(n) {
  return (
    "₪" +
    n.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

const offer = {
  number: 310,
  title: "בדיקת הצעה",
  attention: "שם של מי שמקבל",
  lineItems: [
    {
      quantity: 1,
      description:
        "עובד תפעול לתאריך: 28/07/26 ל-8 שעות כולל שעות נוספות, שעות נסיעה ואש״ל.",
      unitPrice: 800,
      total: 800,
    },
    {
      quantity: 1,
      description: "הוצאות רכב/נסיעות",
      unitPrice: 150,
      total: 150,
    },
  ],
  subtotal: 950,
  vatRate: 0.18,
  vatAmount: 171,
  grandTotal: 1121,
  companySnapshot: {
    name: "מושקו להפקות",
    vatId: "046646535",
    address: "שוקן 10, תל אביב - יפו",
    emails: "",
  },
  bankSnapshot: {
    payee: "תומר מושקו",
    bank: "בנק דיסקונט",
    branch: "סניף 75 קרית מוצקין",
    account: "4584610",
    paymentTerms: "תשלום עד ל- 10 לחודש העוקב.\nבהעברה בנקאית לחשבון:",
  },
};

const pdf = await PDFDocument.create();
pdf.registerFontkit(fontkit);
const fonts = {
  heb: await pdf.embedFont(hebB),
  lat: await pdf.embedFont(latB),
};
const logo = await pdf.embedJpg(logoB);
const page = pdf.addPage([595.28, 841.89]);
const { width, height } = page.getSize();
const margin = 36;
const right = width - margin;
const left = margin;
const co = offer.companySnapshot;
const issuedAt = Date.now();
const clientName = "הדונים";
const clientEmails = "gellerye@gmail.com, gellerye@gmail.com";

const boxW = 300;
const boxX = right - boxW;
const boxTop = height - margin;
const boxPad = 14;
const clientLines = wrapRtl(fonts, clientName, boxW - boxPad * 2, 10);
const emailLines = wrapRtl(fonts, clientEmails, boxW - boxPad * 2, 8);
const boxH =
  boxPad +
  14 +
  16 +
  clientLines.length * 13 +
  emailLines.length * 11 +
  4 +
  10 +
  1 +
  12 +
  18 +
  14 +
  boxPad;

page.drawRectangle({
  x: boxX,
  y: boxTop - boxH,
  width: boxW,
  height: boxH,
  color: BRAND,
});

let by = boxTop - boxPad - 2;
const d = new Date(issuedAt);
const dateStr = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
drawRtl(page, fonts, dateStr, boxX + boxW - boxPad, by, 10, WHITE);
by -= 16;
drawRtl(page, fonts, "לכבוד:", boxX + boxW - boxPad, by, 10, WHITE);
by -= 14;
for (const line of clientLines) {
  drawRtl(page, fonts, line, boxX + boxW - boxPad, by, 10, WHITE);
  by -= 13;
}
by -= 2;
for (const line of emailLines) {
  drawRtl(page, fonts, line, boxX + boxW - boxPad, by, 8, WHITE);
  by -= 11;
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

let headerTop = height - margin;
const logoH = 72;
const logoW = Math.min((logo.width / logo.height) * logoH, 150);
page.drawImage(logo, {
  x: left,
  y: headerTop - logoH,
  width: logoW,
  height: logoH * (logoW / ((logo.width / logo.height) * logoH)),
});
headerTop -= logoH + 10;
drawRtl(page, fonts, `עוסק מורשה ${co.vatId}`, left + 160, headerTop, 9, MUTED);
headerTop -= 12;
drawRtl(page, fonts, co.address, left + 160, headerTop, 9, MUTED);

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
drawRtl(page, fonts, "מע״מ 18%", right, y, 11, INK);
drawLeft(page, fonts, money(offer.vatAmount), colTotalLeft, y, 11, INK);
y -= 20;

const totalStr = money(offer.grandTotal);
const totalW = fonts.lat.widthOfTextAtSize(totalStr, 13) + 16;
page.drawRectangle({
  x: left,
  y: y - 5,
  width: totalW,
  height: 22,
  color: BRAND,
});
drawLeft(page, fonts, totalStr, left + 8, y, 13, WHITE);
drawRtl(page, fonts, "סה״כ לתשלום", right, y, 13, INK);
y -= 28;
drawRtl(page, fonts, `לידי ${offer.attention}`, right, y, 11, INK);
y -= 20;
page.drawLine({
  start: { x: left, y },
  end: { x: right, y },
  thickness: 0.5,
  color: BORDER,
});
y -= 16;
const terms = offer.bankSnapshot.paymentTerms.split("\n").filter((l) => l.trim());
terms.forEach((line, i) => {
  drawRtl(
    page,
    fonts,
    i === 0 && !line.trimStart().startsWith("*") ? `* ${line}` : line,
    right,
    y,
    10,
    INK,
  );
  y -= 13;
});
drawRtl(page, fonts, offer.bankSnapshot.payee, right, y, 10, INK);
y -= 13;
drawRtl(page, fonts, offer.bankSnapshot.bank, right, y, 10, INK);
y -= 13;
drawRtl(page, fonts, offer.bankSnapshot.branch, right, y, 10, INK);
y -= 13;
drawRtl(page, fonts, `מ.ח ${offer.bankSnapshot.account}`, right, y, 10, INK);

drawRtl(
  page,
  fonts,
  `הופק ב ${dateStr} | הצעת מחיר ${offer.number} | עמוד 1 מתוך 1`,
  right,
  24,
  7.5,
  MUTED,
);

const out = "assets/pdf-compare/offer-fixed-preview.pdf";
fs.mkdirSync("assets/pdf-compare", { recursive: true });
fs.writeFileSync(out, await pdf.save());
console.log("wrote", out, fs.statSync(out).size);
