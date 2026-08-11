// Resend send lives in convex/emails.ts (Convex action).
// Client magic-link confirm/dispute: /c/:token → emailLinks.respond

export type MonthlyReportEmailPayload = {
  clientEmail: string;
  clientName: string;
  yearMonth: string;
  monthTotal: number;
  htmlBody: string;
};

/** Placeholder for future monthly report emails via the same Resend setup. */
export async function sendMonthlyReportEmail(
  _payload: MonthlyReportEmailPayload,
): Promise<{ ok: false; reason: "not_implemented" }> {
  return { ok: false, reason: "not_implemented" };
}
