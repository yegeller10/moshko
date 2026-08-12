/**
 * Preview using the real Convex PDF builder.
 * Usage: npx tsx scripts/preview-offer-pdf.mjs
 */
import fs from "fs";
import { buildOfferPdfBytes, buildOfferPngBytes } from "../convex/offerPdf.ts";

const sample = {
  offer: {
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
      paymentTerms: "תשלום עד ל-10 לחודש העוקב.\nבהעברה בנקאית לחשבון:",
    },
  },
  clientName: 'החברה העירונית ראשון לציון לתרבות, נופש וספורט בע"מ',
  clientEmails: "Olaguy@gmail.com, mati@htrl.co.il",
  issuedAt: Date.parse("2025-09-25T14:13:00"),
};

const bytes = await buildOfferPdfBytes(sample);
const png = await buildOfferPngBytes(sample);

fs.mkdirSync("assets/pdf-compare", { recursive: true });
fs.writeFileSync("assets/pdf-compare/offer-fixed-preview.pdf", Buffer.from(bytes));
fs.writeFileSync("assets/pdf-compare/offer-fixed-preview.png", Buffer.from(png));
console.log("wrote assets/pdf-compare/offer-fixed-preview.pdf", bytes.length);
console.log("wrote assets/pdf-compare/offer-fixed-preview.png", png.length);
