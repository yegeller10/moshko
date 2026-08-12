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
  paymentTerms: "תשלום עד ל-10 לחודש העוקב.\nבהעברה בנקאית לחשבון:",
  workerLineTemplate:
    "עובד תפעול לתאריך: {{date}} ל-{{hours}} שעות כולל שעות נוספות, שעות נסיעה ואש״ל.",
  carLineTemplate: "הוצאות רכב/נסיעות",
  emailSubjectTemplate: "הצעת מחיר {{offerNumber}} — {{clientName}}",
  emailBodyTemplate: `<!DOCTYPE html>
<html lang="he" dir="rtl">
<body style="font-family:Arial,Helvetica,sans-serif;background:#f1f5f9;margin:0;padding:24px;color:#0a0a0a">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:20px;overflow:hidden">
    <div style="background:linear-gradient(135deg,#0b6fc2,#085a9e);padding:24px 28px;color:#fff">
      <img src="{{logoUrl}}" alt="" width="56" height="56" style="display:block;border-radius:12px;margin-bottom:12px" />
      <p style="margin:0;font-size:13px;opacity:0.9">{{companyName}}</p>
      <h1 style="margin:8px 0 0;font-size:22px">הצעת מחיר {{offerNumber}}</h1>
    </div>
    <div style="padding:28px">
      <p style="margin:0 0 12px">שלום {{clientName}},</p>
      <p style="margin:0 0 20px;color:#52525b">מצורפת הצעת מחיר (PDF). לאישור לחצו למטה. הקישור תקף 21 יום.</p>
      <p style="margin:0 0 8px"><strong>{{title}}</strong></p>
      <p style="margin:0 0 24px;font-size:20px;color:#0b6fc2;direction:ltr;text-align:right"><strong>{{grandTotal}}</strong></p>
      <div style="text-align:center">
        <a href="{{acceptUrl}}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;font-weight:700;padding:14px 32px;border-radius:14px">אישור הצעת המחיר</a>
      </div>
      <p style="margin:24px 0 0;font-size:12px;color:#a1a1aa;text-align:center"><a href="{{linkUrl}}" style="color:#0b6fc2">{{linkUrl}}</a></p>
    </div>
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
