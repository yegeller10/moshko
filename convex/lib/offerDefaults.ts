/** Default offer company/bank/templates (sample 308 style). */

export const DEFAULT_OFFER_SETTINGS = {
  nextNumber: 308,
  vatPercent: 18,
  companyName: "מושקו להפקות",
  companyVatId: "046646535",
  companyAddress: "שוקן 10, תל אביב - יפו",
  companyEmails: "",
  bankPayee: "תומר מושקו",
  bankName: "בנק דיסקונט",
  bankBranch: "סניף 75 קרית מוצקין",
  bankAccount: "4584610",
  paymentTerms: "תשלום עד ל- 10 לחודש העוקב.\nבהעברה בנקאית לחשבון:",
  workerLineTemplate:
    "עובד תפעול לתאריך: {{date}} ל-{{hours}} שעות כולל שעות נוספות, שעות נסיעה ואש״ל.",
  carLineTemplate: "הוצאות רכב/נסיעות",
  emailSubjectTemplate: "הצעת מחיר {{offerNumber}} — {{clientName}}",
  emailBodyTemplate: `<!DOCTYPE html>
<html lang="he" dir="rtl">
<body style="font-family:Arial,Helvetica,sans-serif;background:#f8fafc;margin:0;padding:24px;color:#0a0a0a">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e4e4e7;border-radius:16px;padding:24px">
    <h1 style="margin:0 0 8px;font-size:22px;color:#0b6fc2">{{companyName}}</h1>
    <p style="margin:0 0 16px;font-size:16px;font-weight:700">הצעת מחיר {{offerNumber}}</p>
    <p style="margin:0 0 12px;line-height:1.5">שלום {{clientName}},</p>
    <p style="margin:0 0 16px;line-height:1.5;color:#3f3f46">מצורפת הצעת מחיר. ניתן לאשר או לערער בקישורים למטה. קובץ PDF מצורף להודעה.</p>
    <p style="margin:0 0 8px"><strong>{{title}}</strong></p>
    <p style="margin:0 0 16px">סה״כ לתשלום כולל מע״מ: <strong>{{grandTotal}}</strong></p>
    <div style="margin-top:24px;text-align:center">
      <a href="{{acceptUrl}}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:12px;margin:4px">אישור</a>
      <a href="{{disputeUrl}}" style="display:inline-block;background:#fff;color:#b91c1c;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:12px;margin:4px;border:1px solid #fecaca">ערעור</a>
    </div>
    <p style="margin:20px 0 0;font-size:12px;color:#a1a1aa;text-align:center">
      <a href="{{linkUrl}}" style="color:#0b6fc2">{{linkUrl}}</a>
    </p>
  </div>
</body>
</html>`,
} as const;

export function applyTemplate(
  template: string,
  vars: Record<string, string | number>,
): string {
  let out = template;
  for (const [key, value] of Object.entries(vars)) {
    out = out.split(`{{${key}}}`).join(String(value));
  }
  return out;
}

export function formatOfferDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y.slice(2)}`;
}

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}
