"use node";

import { action } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { api, internal } from "./_generated/api";

function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildHtml(args: {
  kind: "quote" | "order";
  clientName: string;
  date: string;
  location: string;
  startTime: string;
  endTime: string;
  includeCar: boolean;
  laborTotal: number;
  commuteCost: number;
  carCost: number;
  draftCharges: Array<{ title: string; amount: number }>;
  grandTotal: number;
  workers: Array<{
    name: string;
    startTime: string;
    endTime: string;
    travelHours: number;
  }>;
  linkUrl: string;
  formatMoney: (n: number) => string;
}) {
  const title =
    args.kind === "quote" ? "הצעת מחיר — מושקו" : "אישור הזמנה — מושקו";
  const intro =
    args.kind === "quote"
      ? "שלום, מצורפת הצעת מחיר. ניתן לאשר או לערער ישירות מהקישורים למטה."
      : "שלום, מצורף אישור הזמנה. ניתן לאשר קבלה או לערער ישירות מהקישורים למטה.";

  const workerRows = args.workers
    .map(
      (w) =>
        `<tr><td style="padding:6px 0;border-bottom:1px solid #eee">${esc(w.name)}</td><td style="padding:6px 0;border-bottom:1px solid #eee">${esc(w.startTime)}–${esc(w.endTime)}</td><td style="padding:6px 0;border-bottom:1px solid #eee">${w.travelHours || "—"}</td></tr>`,
    )
    .join("");

  const chargeRows = args.draftCharges
    .filter((c) => c.amount > 0)
    .map(
      (c) =>
        `<tr><td style="padding:4px 0">${esc(c.title)}</td><td style="padding:4px 0;text-align:left">${esc(args.formatMoney(c.amount))}</td></tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<body style="font-family:Arial,Helvetica,sans-serif;background:#f8fafc;margin:0;padding:24px;color:#0a0a0a">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e4e4e7;border-radius:16px;padding:24px">
    <h1 style="margin:0 0 8px;font-size:22px;color:#0b6fc2">מושקו</h1>
    <p style="margin:0 0 16px;font-size:16px;font-weight:700">${title}</p>
    <p style="margin:0 0 20px;line-height:1.5;color:#3f3f46">${intro}</p>

    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:14px">
      <tr><td style="padding:4px 0;color:#71717a">לקוח</td><td style="padding:4px 0;font-weight:600">${esc(args.clientName)}</td></tr>
      <tr><td style="padding:4px 0;color:#71717a">תאריך</td><td style="padding:4px 0;font-weight:600">${esc(args.date)}</td></tr>
      <tr><td style="padding:4px 0;color:#71717a">שעות</td><td style="padding:4px 0;font-weight:600">${esc(args.startTime)}–${esc(args.endTime)}</td></tr>
      <tr><td style="padding:4px 0;color:#71717a">מיקום</td><td style="padding:4px 0;font-weight:600">${esc(args.location || "—")}</td></tr>
      <tr><td style="padding:4px 0;color:#71717a">רכב</td><td style="padding:4px 0;font-weight:600">${args.includeCar ? "כן" : "לא"}</td></tr>
    </table>

    <p style="margin:0 0 8px;font-weight:700">עובדים</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:13px">
      <tr style="color:#71717a;text-align:right"><td style="padding:4px 0">שם</td><td style="padding:4px 0">שעות</td><td style="padding:4px 0">נסיעה</td></tr>
      ${workerRows || "<tr><td colspan='3'>—</td></tr>"}
    </table>

    <p style="margin:0 0 8px;font-weight:700">סיכום עלות</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:8px;font-size:14px">
      <tr><td style="padding:4px 0">עבודה</td><td style="padding:4px 0;text-align:left">${esc(args.formatMoney(args.laborTotal))}</td></tr>
      <tr><td style="padding:4px 0">נסיעות</td><td style="padding:4px 0;text-align:left">${esc(args.formatMoney(args.commuteCost))}</td></tr>
      <tr><td style="padding:4px 0">רכב</td><td style="padding:4px 0;text-align:left">${esc(args.formatMoney(args.carCost))}</td></tr>
      ${chargeRows}
      <tr><td style="padding:10px 0 0;font-weight:700;font-size:16px;color:#0b6fc2">סה״כ</td><td style="padding:10px 0 0;text-align:left;font-weight:700;font-size:16px;color:#0b6fc2">${esc(args.formatMoney(args.grandTotal))}</td></tr>
    </table>

    <div style="margin-top:28px;text-align:center">
      <a href="${esc(args.linkUrl)}?action=approve" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:12px;margin:4px">אישור</a>
      <a href="${esc(args.linkUrl)}?action=dispute" style="display:inline-block;background:#fff;color:#b91c1c;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:12px;margin:4px;border:1px solid #fecaca">ערעור</a>
    </div>
    <p style="margin:20px 0 0;font-size:12px;color:#a1a1aa;line-height:1.4;text-align:center">
      הקישור תקף ל־21 יום. אם הכפתורים לא עובדים, פתחו:<br/>
      <a href="${esc(args.linkUrl)}" style="color:#0b6fc2">${esc(args.linkUrl)}</a>
    </p>
  </div>
</body>
</html>`;
}

export const sendJobEmail = action({
  args: {
    jobId: v.id("calendarEvents"),
    kind: v.union(v.literal("quote"), v.literal("order")),
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

    const token = randomToken();
    const created = await ctx.runMutation(internal.emailLinks.createForSend, {
      jobId: args.jobId,
      kind: args.kind,
      toEmail: args.toEmail,
      token,
      createdBy: me._id,
    });

    const linkUrl = `${origin}/c/${token}`;
    const s = created.summary;
    const html = buildHtml({
      kind: args.kind,
      clientName: s.clientName,
      date: s.date,
      location: s.location,
      startTime: s.startTime,
      endTime: s.endTime,
      includeCar: s.includeCar,
      laborTotal: s.laborTotal,
      commuteCost: s.commuteCost,
      carCost: s.carCost,
      draftCharges: s.draftCharges,
      grandTotal: s.grandTotal,
      workers: s.workers,
      linkUrl,
      formatMoney: (n) =>
        new Intl.NumberFormat("he-IL", {
          style: "currency",
          currency: "ILS",
          maximumFractionDigits: 2,
        }).format(n),
    });

    const subject =
      args.kind === "quote"
        ? `הצעת מחיר — ${s.clientName} — ${s.date}`
        : `אישור הזמנה — ${s.clientName} — ${s.date}`;

    const replyTo = process.env.EMAIL_REPLY_TO;
    const body: Record<string, unknown> = {
      from,
      to: [args.toEmail.trim().toLowerCase()],
      subject,
      html,
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
        payload.message ||
          payload.error ||
          `Resend failed (${res.status})`,
      );
    }

    await ctx.runMutation(internal.emailLinks.markSent, {
      linkId: created.linkId,
      resendId: payload.id,
    });

    return {
      ok: true as const,
      linkUrl,
      resendId: payload.id,
      toEmail: args.toEmail.trim().toLowerCase(),
    };
  },
});
