/** Branded offer email HTML (accept only, no dispute). */

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildOfferEmailHtml(args: {
  companyName: string;
  offerNumber: string;
  clientName: string;
  title: string;
  grandTotal: string;
  acceptUrl: string;
  linkUrl: string;
  logoUrl: string;
}) {
  const logoBlock = args.logoUrl
    ? `<img src="${esc(args.logoUrl)}" alt="" width="56" height="56" style="display:block;border-radius:12px;margin-bottom:12px" />`
    : "";

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<body style="font-family:Arial,Helvetica,sans-serif;background:#f1f5f9;margin:0;padding:24px;color:#0a0a0a">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(11,111,194,0.08)">
    <div style="background:linear-gradient(135deg,#0b6fc2 0%,#085a9e 100%);padding:24px 28px;color:#fff">
      ${logoBlock}
      <p style="margin:0;font-size:13px;opacity:0.9">${esc(args.companyName)}</p>
      <h1 style="margin:8px 0 0;font-size:22px;font-weight:700">הצעת מחיר ${esc(args.offerNumber)}</h1>
    </div>
    <div style="padding:28px">
      <p style="margin:0 0 12px;line-height:1.6;font-size:15px">שלום ${esc(args.clientName)},</p>
      <p style="margin:0 0 20px;line-height:1.6;color:#52525b;font-size:14px">מצורפת הצעת מחיר רשמית (PDF). לאישור ההצעה לחצו על הכפתור למטה. הקישור תקף למשך 21 יום.</p>
      <div style="background:#f8fafc;border:1px solid #e4e4e7;border-radius:14px;padding:16px 18px;margin-bottom:24px">
        <p style="margin:0 0 6px;font-weight:600;font-size:15px">${esc(args.title)}</p>
        <p style="margin:0;font-size:14px;color:#52525b">סה״כ לתשלום כולל מע״מ</p>
        <p style="margin:6px 0 0;font-size:22px;font-weight:700;color:#0b6fc2;direction:ltr;text-align:right">${esc(args.grandTotal)}</p>
      </div>
      <div style="text-align:center">
        <a href="${esc(args.acceptUrl)}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;font-weight:700;font-size:16px;padding:14px 32px;border-radius:14px;box-shadow:0 2px 8px rgba(22,163,74,0.25)">אישור הצעת המחיר</a>
      </div>
      <p style="margin:24px 0 0;font-size:12px;color:#a1a1aa;line-height:1.5;text-align:center">
        אם הכפתור לא עובד:<br/>
        <a href="${esc(args.linkUrl)}" style="color:#0b6fc2;word-break:break-all">${esc(args.linkUrl)}</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}
