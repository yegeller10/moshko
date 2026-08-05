// Phase 2 email hook (not implemented)

export type MonthlyReportEmailPayload = {
  clientEmail: string;
  clientName: string;
  yearMonth: string;
  monthTotal: number;
  htmlBody: string;
};

/**
 * Placeholder for future Resend / Cloudflare Email / similar.
 * Wire a Convex action here when ready to send monthly confirmation emails.
 */
export async function sendMonthlyReportEmail(
  _payload: MonthlyReportEmailPayload,
): Promise<{ ok: false; reason: "not_implemented" }> {
  return { ok: false, reason: "not_implemented" };
}
