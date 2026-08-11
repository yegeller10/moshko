import { useEffect, useMemo, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export function SendJobEmailButtons({
  jobId,
  status,
  clientEmails,
}: {
  jobId: Id<"calendarEvents">;
  status: "booked" | "approved" | "done" | "cancelled";
  clientEmails: string[];
}) {
  const { t } = useTranslation();
  const send = useAction(api.emails.sendJobEmail);
  const links = useQuery(api.emailLinks.listForJob, { jobId });
  const emails = useMemo(
    () => [...new Set(clientEmails.map((e) => e.trim()).filter(Boolean))],
    [clientEmails],
  );
  const [toEmail, setToEmail] = useState("");
  const [busy, setBusy] = useState<"quote" | "order" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!toEmail && emails[0]) setToEmail(emails[0]);
  }, [emails, toEmail]);

  async function run(kind: "quote" | "order") {
    setBusy(kind);
    setError(null);
    setMessage(null);
    try {
      const email = (toEmail || emails[0] || "").trim();
      if (!email) {
        setError(t("jobs.emailMissing"));
        return;
      }
      const result = await send({
        jobId,
        kind,
        toEmail: email,
        appOrigin: window.location.origin,
      });
      setMessage(t("jobs.emailSent", { email: result.toEmail }));
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setBusy(null);
    }
  }

  const canQuote = status === "booked";
  const canOrder = status === "approved";
  if (!canQuote && !canOrder) return null;

  const last = links?.[0];

  return (
    <div className="space-y-2 border-t border-border pt-3">
      <div>
        <Label>{t("jobs.emailTo")}</Label>
        {emails.length > 0 ? (
          <Select
            value={toEmail || emails[0]}
            onChange={(e) => setToEmail(e.target.value)}
          >
            {emails.map((em) => (
              <option key={em} value={em}>
                {em}
              </option>
            ))}
          </Select>
        ) : (
          <p className="text-sm text-red-700">{t("jobs.emailMissing")}</p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {canQuote && (
          <Button
            type="button"
            variant="secondary"
            disabled={!!busy || emails.length === 0}
            onClick={() => void run("quote")}
          >
            {busy === "quote" ? t("common.loading") : t("jobs.sendQuoteEmail")}
          </Button>
        )}
        {canOrder && (
          <Button
            type="button"
            variant="secondary"
            disabled={!!busy || emails.length === 0}
            onClick={() => void run("order")}
          >
            {busy === "order"
              ? t("common.loading")
              : t("jobs.sendOrderConfirmation")}
          </Button>
        )}
      </div>
      {message && <p className="text-sm text-emerald-800">{message}</p>}
      {error && <p className="text-sm text-red-700">{error}</p>}
      {last && (
        <p className="text-xs text-muted">
          {t("jobs.lastEmail")}: {last.toEmail} ·{" "}
          {t(`jobs.linkStatus.${last.status}`)}
        </p>
      )}
    </div>
  );
}
