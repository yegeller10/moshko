/**
 * Local visual QA for offer PDF (mirrors convex/offerPdf.ts).
 * Usage: node scripts/preview-offer-pdf.mjs
 */
import fs from "fs";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

const BRAND = rgb(0.043, 0.435, 0.761);
const MUTED = rgb(0.42, 0.42, 0.42);
const INK = rgb(0.05, 0.05, 0.05);
const BORDER = rgb(0.78, 0.78, 0.78);
const WHITE = rgb(1, 1, 1);

const fontB = fs.readFileSync("convex/fonts/Heebo-Regular.ttf");
const logoB = fs.readFileSync("public/logo.png");

function isRtlChar(ch) {
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
  let rtl = null;
  for (const ch of normalized) {
    if (ch === " ") {
      cur += ch;
      continue;
    }
    const nextRtl = isRtlChar(ch);
    if (rtl === null) {
      rtl = nextRtl;
      cur = ch;
      continue;
    }
    if (nextRtl === rtl) cur += ch;
    else {
      runs.push({ text: cur, rtl });
      cur = ch;
      rtl = nextRtl;
    }
  }
  if (cur && rtl !== null) runs.push({ text: cur, rtl });
  for (let i = 0; i < runs.length - 1; i++) {
    const run = runs[i];
    const next = runs[i + 1];
    const m = run.text.match(/^(.*?)(\s+)$/);
    if (m && run.rtl && !next.rtl) {
      run.text = m[1];
      next.text = m[2] + next.text;
    }
  }
  return runs.length ? runs : [{ text: "", rtl: true }];
}
function widthOf(font, text, size) {
  let w = 0;
  for (const run of splitRuns(text)) {
    w += font.widthOfTextAtSize(run.text, size);
  }
  return w;
}
function drawRtl(page, font, text, rightX, y, size, color = INK) {
  const runs = splitRuns(text);
  let x = rightX;
  for (const run of runs) {
    const w = font.widthOfTextAtSize(run.text, size);
    x -= w;
    if (run.text.length) page.drawText(run.text, { x, y, size, font, color });
  }
}
function drawLeft(page, font, text, leftX, y, size, color = INK) {
  if (!text.length) return;
  page.drawText(text, { x: leftX, y, size, font, color });
}
function wrapRtl(font, text, maxWidth, size) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (widthOf(font, next, size) <= maxWidth) cur = next;
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
  number: 308,
  title: "פסטיבל ראשון 2025",
  attention: "סיון",
  lineItems: [
    {
      quantity: 3,
      description:
        "עובד תפעול לתאריך: 07/10/25 ל-8 שעות כולל שעות נוספות, שעות נסיעה ואש״ל.",
      unitPrice: 1470,
      total: 4410,
    },
    {
      quantity: 3,
      description:
        "עובד תפעול לתאריך: 08/10/25 ל-8 שעות כולל שעות נוספות, שעות נסיעה ואש״ל.",
      unitPrice: 1470,
      total: 4410,
    },
    {
      quantity: 3,
      description:
        "עובד תפעול לתאריך: 09/10/25 ל-12 שעות כולל שעות נוספות, שעות נסיעה ואש״ל.",
      unitPrice: 1220,
      total: 3660,
    },
    {
      quantity: 3,
      description: "הוצאות רכב/נסיעות",
      unitPrice: 400,
      total: 1200,
    },
  ],
  subtotal: 13680,
  vatRate: 0.18,
  vatAmount: 2462.4,
  grandTotal: 16142.4,
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
const font = await pdf.embedFont(fontB);
const logo = await pdf.embedJpg(logoB);
const page = pdf.addPage([595.28, 841.89]);
const { width, height } = page.getSize();
const margin = 36;
const right = width - margin;
const left = margin;
const co = offer.companySnapshot;
const issuedAt = Date.parse("2025-09-25T14:13:00");
const clientName = "החברה העירונית ראשון לציון לתרבות, נופש וספורט בעמ";
const clientEmails = "Olaguy@gmail.com, mati@htrl.co.il";

const boxW = 310;
const boxX = right - boxW;
const boxTop = height - 28;
const boxPad = 16;
const clientLines = wrapRtl(font, clientName, boxW - boxPad * 2, 10);
const emailLines = wrapRtl(font, clientEmails, boxW - boxPad * 2, 8);
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
  20 +
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
drawRtl(page, font, "25/09/2025", boxX + boxW - boxPad, by, 10, WHITE);
by -= 16;
drawRtl(page, font, "לכבוד:", boxX + boxW - boxPad, by, 10, WHITE);
by -= 14;
for (const line of clientLines) {
  drawRtl(page, font, line, boxX + boxW - boxPad, by, 10, WHITE);
  by -= 13;
}
by -= 2;
for (const line of emailLines) {
  drawRtl(page, font, line, boxX + boxW - boxPad, by, 8, WHITE);
  by -= 11;
}
by -= 8;
page.drawLine({
  start: { x: boxX + boxPad, y: by },
  end: { x: boxX + boxW - boxPad, y: by },
  thickness: 0.8,
  color: WHITE,
});
by -= 18;
drawRtl(
  page,
  font,
  `הצעת מחיר ${offer.number}`,
  boxX + boxW - boxPad,
  by,
  18,
  WHITE,
);
by -= 16;
drawRtl(page, font, "העתק נאמן למקור", boxX + boxW - boxPad, by, 9, WHITE);

const brandRight = left + 170;
let headerTop = height - 28;
const logoH = 78;
const naturalW = (logo.width / logo.height) * logoH;
const logoW = Math.min(naturalW, 155);
const drawH = logoH * (logoW / naturalW);
page.drawImage(logo, {
  x: left,
  y: headerTop - drawH,
  width: logoW,
  height: drawH,
});
headerTop -= drawH + 12;
drawRtl(page, font, `עוסק מורשה ${co.vatId}`, brandRight, headerTop, 9, MUTED);
headerTop -= 12;
drawRtl(page, font, co.address, brandRight, headerTop, 9, MUTED);

let y = Math.min(headerTop, boxTop - boxH) - 28;
drawRtl(page, font, offer.title, right, y, 13, INK);
y -= 24;

const colQtyRight = right;
const colDescRight = right - 42;
const colPriceLeft = left + 118;
const colTotalLeft = left;
const descMaxW = Math.max(160, colDescRight - (colPriceLeft + 78));

drawRtl(page, font, "כמות", colQtyRight, y, 8, MUTED);
drawRtl(page, font, "פירוט", colDescRight, y, 8, MUTED);
drawRtl(page, font, "מחיר", colPriceLeft + 52, y, 8, MUTED);
drawRtl(page, font, "סה״כ", colTotalLeft + 52, y, 8, MUTED);
y -= 6;
page.drawLine({
  start: { x: left, y },
  end: { x: right, y },
  thickness: 0.6,
  color: BORDER,
});
y -= 14;

for (const item of offer.lineItems) {
  const descLines = wrapRtl(font, item.description, descMaxW, 9);
  const rowHeight = Math.max(14, descLines.length * 12);
  drawRtl(page, font, String(item.quantity), colQtyRight, y, 10, INK);
  let dy = y;
  for (const line of descLines) {
    drawRtl(page, font, line, colDescRight, dy, 9, INK);
    dy -= 12;
  }
  drawLeft(page, font, money(item.unitPrice), colPriceLeft, y, 9, INK);
  drawLeft(page, font, money(item.total), colTotalLeft, y, 9, INK);
  y -= rowHeight + 6;
}

y -= 4;
page.drawLine({
  start: { x: left, y },
  end: { x: right, y },
  thickness: 0.6,
  color: BORDER,
});
y -= 16;
drawRtl(page, font, "סה״כ", right, y, 11, INK);
drawLeft(page, font, money(offer.subtotal), colTotalLeft, y, 11, INK);
y -= 15;
drawRtl(page, font, "מע״מ 18%", right, y, 11, INK);
drawLeft(page, font, money(offer.vatAmount), colTotalLeft, y, 11, INK);
y -= 20;

const totalStr = money(offer.grandTotal);
const totalW = font.widthOfTextAtSize(totalStr, 13) + 18;
page.drawRectangle({
  x: left,
  y: y - 5,
  width: totalW,
  height: 22,
  color: BRAND,
});
drawLeft(page, font, totalStr, left + 9, y, 13, WHITE);
drawRtl(page, font, "סה״כ לתשלום", right, y, 13, INK);
y -= 28;
drawRtl(page, font, `לידי ${offer.attention}`, right, y, 11, INK);
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
    font,
    i === 0 && !line.trimStart().startsWith("*") ? `* ${line}` : line,
    right,
    y,
    10,
    INK,
  );
  y -= 13;
});
drawRtl(page, font, offer.bankSnapshot.payee, right, y, 10, INK);
y -= 13;
drawRtl(page, font, offer.bankSnapshot.bank, right, y, 10, INK);
y -= 13;
drawRtl(page, font, offer.bankSnapshot.branch, right, y, 10, INK);
y -= 13;
drawRtl(page, font, `מ.ח ${offer.bankSnapshot.account}`, right, y, 10, INK);

drawLeft(page, font, "created by moshkoprod", left, 24, 8, MUTED);
drawRtl(
  page,
  font,
  `הופק ב 25/09/2025 14:13 | הצעת מחיר ${offer.number} | עמוד 1 מתוך 1`,
  right,
  24,
  7.5,
  MUTED,
);

const out = "assets/pdf-compare/offer-fixed-preview.pdf";
fs.mkdirSync("assets/pdf-compare", { recursive: true });
fs.writeFileSync(out, await pdf.save());
console.log("wrote", out, fs.statSync(out).size);
