import fs from "fs";
import { PDFDocument, rgb, degrees } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

const hebB = fs.readFileSync("convex/fonts/NotoSansHebrew-Regular.ttf");
const latB = fs.readFileSync("convex/fonts/NotoSans-Regular.ttf");

function isHebrewChar(ch) {
  const c = ch.codePointAt(0) ?? 0;
  return c >= 0x0590 && c <= 0x05ff;
}
function splitRuns(text) {
  const runs = [];
  let cur = "";
  let heb = null;
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
  return runs.length ? runs : [{ text: "", heb: false }];
}
function drawRtl(page, fonts, text, rightX, y, size, color = rgb(0.05, 0.05, 0.05)) {
  const runs = splitRuns(text);
  let totalW = 0;
  for (const run of runs) {
    const font = run.heb ? fonts.heb : fonts.lat;
    totalW += font.widthOfTextAtSize(run.text, size);
  }
  let x = rightX - totalW;
  for (const run of runs) {
    const font = run.heb ? fonts.heb : fonts.lat;
    if (run.text.length) page.drawText(run.text, { x, y, size, font, color });
    x += font.widthOfTextAtSize(run.text, size);
  }
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
function wrapRtl(fonts, text, maxWidth, size) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = "";
  const widthOf = (t) => {
    let w = 0;
    for (const r of splitRuns(t))
      w += (r.heb ? fonts.heb : fonts.lat).widthOfTextAtSize(r.text, size);
    return w;
  };
  for (const w of words) {
    const next = cur ? cur + " " + w : w;
    if (widthOf(next) <= maxWidth) cur = next;
    else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

const offer = {
  number: 308,
  title: "07/10/25, 08/10/25, 09/10/25",
  attention: "סיון",
  lineItems: [
    {
      quantity: 6,
      description:
        "עובד תפעול לתאריך: 07/10/25 ל-8 שעות כולל שעות נוספות, שעות נסיעה ואש״ל.",
      unitPrice: 400,
      total: 2400,
    },
    {
      quantity: 6,
      description:
        "עובד תפעול לתאריך: 08/10/25 ל-8 שעות כולל שעות נוספות, שעות נסיעה ואש״ל.",
      unitPrice: 400,
      total: 2400,
    },
    {
      quantity: 6,
      description:
        "עובד תפעול לתאריך: 09/10/25 ל-12 שעות כולל שעות נוספות, שעות נסיעה ואש״ל.",
      unitPrice: 1280,
      total: 7680,
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
const fonts = {
  heb: await pdf.embedFont(hebB),
  lat: await pdf.embedFont(latB),
};
const page = pdf.addPage([595.28, 841.89]);
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
let cy = height - margin;
drawRtl(page, fonts, "11/08/2026", left + 160, cy, 10);
cy -= 14;
drawRtl(page, fonts, "לכבוד:", left + 160, cy, 10);
cy -= 14;
drawRtl(page, fonts, "החברה העירונית ראשון לציון", left + 200, cy, 11);
cy -= 14;
drawRtl(
  page,
  fonts,
  "Olaguy@gmail.com, mati@htrl.co.il",
  left + 200,
  cy,
  9,
  rgb(0.35, 0.35, 0.35),
);
y = Math.min(y, cy) - 20;
drawRtl(page, fonts, `הצעת מחיר ${offer.number}`, right, y, 16);
drawRtl(page, fonts, "העתק נאמן למקור", left + 120, y, 11, rgb(0.1, 0.4, 0.2));
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
drawRtl(page, fonts, "מע״מ 18%", right, y, 11);
drawRtl(page, fonts, money(offer.vatAmount), colTotal, y, 11);
y -= 18;
drawRtl(page, fonts, "סה״כ לתשלום", right, y, 13, rgb(0.04, 0.43, 0.76));
drawRtl(page, fonts, money(offer.grandTotal), colTotal, y, 13, rgb(0.04, 0.43, 0.76));
y -= 24;
drawRtl(page, fonts, "לידי סיון", right, y, 11);
y -= 30;
for (const line of offer.bankSnapshot.paymentTerms.split("\n")) {
  drawRtl(page, fonts, line, right, y, 10);
  y -= 13;
}
drawRtl(page, fonts, offer.bankSnapshot.payee, right, y, 10);
y -= 13;
drawRtl(page, fonts, offer.bankSnapshot.bank, right, y, 10);
y -= 13;
drawRtl(page, fonts, offer.bankSnapshot.branch, right, y, 10);
y -= 13;
drawRtl(page, fonts, `${offer.bankSnapshot.account} ח.מ`, right, y, 10);
drawRtl(
  page,
  fonts,
  "הופק ב 11/08/2026 19:20 | הצעת מחיר 308 | עמוד 1 מתוך 1",
  right,
  28,
  8,
  rgb(0.45, 0.45, 0.45),
);
page.drawText("העתק נאמן למקור", {
  x: width / 2 - 80,
  y: height / 2,
  size: 28,
  font: fonts.heb,
  color: rgb(0.85, 0.9, 0.85),
  rotate: degrees(35),
  opacity: 0.35,
});
fs.writeFileSync("assets/fonts/offer-fixed-preview.pdf", await pdf.save());
console.log("ok", fs.statSync("assets/fonts/offer-fixed-preview.pdf").size);
