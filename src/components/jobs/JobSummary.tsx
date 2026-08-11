import { Link } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatMoney } from "@/lib/costs";
import { cn } from "@/lib/utils";
import { SendJobEmailButtons } from "@/components/jobs/SendJobEmailButtons";

function statusBadgeClass(status: string) {
  if (status === "approved") return "bg-emerald-100 text-emerald-800";
  if (status === "done") return "bg-zinc-200 text-zinc-700";
  if (status === "cancelled") return "bg-red-100 text-red-800";
  return "bg-amber-100 text-amber-900";
}

export function JobSummary({
  jobId,
  onEdit,
}: {
  jobId: Id<"calendarEvents">;
  onEdit: () => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "he" ? "he-IL" : "en-IL";
  const job = useQuery(api.calendar.get, { id: jobId });
  const setStatus = useMutation(api.calendar.setStatus);
  const remove = useMutation(api.calendar.remove);
  const [saving, setSaving] = useState(false);

  if (job === undefined) {
    return <p className="text-sm text-muted">{t("common.loading")}</p>;
  }
  if (job === null) {
    return <p className="text-sm text-red-700">{t("common.error")}</p>;
  }

  const status = job.status;
  const assignments = job.workerAssignments ?? [];
  const draftCharges = job.draftCharges ?? [];
  const draftTotal = draftCharges.reduce(
    (sum, c) => sum + (c.amount > 0 ? c.amount : 0),
    0,
  );
  const grand =
    (job.quote?.grandTotal ?? 0) + draftTotal;

  async function run(action: () => Promise<unknown>) {
    setSaving(true);
    try {
      await action();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full max-w-3xl space-y-4">
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span
            className={cn(
              "inline-flex rounded-xl px-4 py-2 text-base font-bold",
              statusBadgeClass(status),
            )}
          >
            {t(`calendar.status.${status}`)}
          </span>
          <Button type="button" onClick={onEdit}>
            {t("common.edit")}
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {status === "booked" && (
            <Button
              type="button"
              variant="secondary"
              disabled={saving}
              onClick={() =>
                void run(() => setStatus({ id: jobId, status: "approved" }))
              }
            >
              {t("calendar.approve")}
            </Button>
          )}
          {status === "approved" && (
            <Button
              type="button"
              variant="secondary"
              disabled={saving}
              onClick={() => {
                if (!window.confirm(t("calendar.markDoneConfirm"))) return;
                void run(() => setStatus({ id: jobId, status: "done" }));
              }}
            >
              {t("calendar.markDone")}
            </Button>
          )}
          {status === "done" && (
            <Button
              type="button"
              variant="secondary"
              disabled={saving}
              onClick={() =>
                void run(() => setStatus({ id: jobId, status: "approved" }))
              }
            >
              {t("calendar.reopen")}
            </Button>
          )}
          {status === "cancelled" && (
            <Button
              type="button"
              variant="secondary"
              disabled={saving}
              onClick={() =>
                void run(() => setStatus({ id: jobId, status: "booked" }))
              }
            >
              {t("calendar.undelete")}
            </Button>
          )}
          {status !== "cancelled" && (
            <Button
              type="button"
              variant="ghost"
              disabled={saving}
              onClick={() => void run(() => remove({ id: jobId }))}
            >
              {t("calendar.cancelEvent")}
            </Button>
          )}
        </div>

        {job.clientDecision && (
          <p className="text-sm">
            <span className="font-semibold">
              {t(`jobs.clientDecision.${job.clientDecision}`)}
            </span>
            {job.clientDecisionEmail ? ` · ${job.clientDecisionEmail}` : ""}
            {job.clientDecisionNote ? ` — ${job.clientDecisionNote}` : ""}
          </p>
        )}

        {status === "booked" && (
          <Button asChild type="button" className="w-full sm:w-auto">
            <Link to={`/offers/new?jobId=${jobId}`}>
              {t("offers.createSend")}
            </Link>
          </Button>
        )}

        <SendJobEmailButtons
          jobId={jobId}
          status={status}
          clientEmails={[
            ...(job.client?.emails ?? []),
            ...(job.client?.email ? [job.client.email] : []),
          ]}
        />
      </Card>

      <Card className="space-y-3 text-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted">{t("calendar.date")}</p>
            <p className="font-semibold">{job.date}</p>
          </div>
          <div>
            <p className="text-xs text-muted">{t("entries.client")}</p>
            <p className="font-semibold">{job.client?.name ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted">{t("entries.location")}</p>
            <p className="font-semibold">{job.locationText || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted">{t("calendar.city")}</p>
            <p className="font-semibold">{job.city?.name ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted">{t("calendar.includeCar")}</p>
            <p className="font-semibold">
              {job.includeCar ? t("common.yes") : t("common.no")}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted">{t("calendar.time")}</p>
            <p className="font-semibold">
              {job.startTime}–{job.endTime}
            </p>
          </div>
        </div>
        {job.notes && (
          <div>
            <p className="text-xs text-muted">{t("calendar.notes")}</p>
            <p>{job.notes}</p>
          </div>
        )}
      </Card>

      <Card className="space-y-2">
        <p className="font-semibold">{t("quotes.workers")}</p>
        {assignments.length === 0 ? (
          <p className="text-sm text-muted">—</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {assignments.map((a, i) => {
              const worker = job.workers?.find((w) => w?._id === a.workerId);
              const name = worker
                ? [worker.firstName, worker.lastName]
                    .filter(Boolean)
                    .join(" ")
                    .trim() ||
                  worker.name?.trim() ||
                  "—"
                : "—";
              return (
                <li
                  key={`${a.workerId}-${i}`}
                  className="rounded-xl border border-border px-3 py-2"
                >
                  <p className="font-medium">{name}</p>
                  <p className="text-muted">
                    {a.startTime}–{a.endTime} ·{" "}
                    {t(`entries.shiftTypes.${a.shiftType}`)}
                    {a.travelHours
                      ? ` · ${t("entries.travelHours")}: ${a.travelHours}`
                      : ""}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card className="space-y-1 text-sm">
        <p className="font-semibold">{t("calendar.quotePreview")}</p>
        <p>
          {t("calendar.labor")}:{" "}
          {formatMoney(job.quote?.laborTotal ?? 0, locale)}
        </p>
        <p>
          {t("calendar.commute")}:{" "}
          {formatMoney(job.quote?.commuteCost ?? 0, locale)}
        </p>
        <p>
          {t("calendar.car")}: {formatMoney(job.quote?.carCost ?? 0, locale)}
        </p>
        {draftCharges
          .filter((c) => c.amount > 0)
          .map((c, i) => (
            <p key={`${c.title}-${i}`}>
              {c.title}: {formatMoney(c.amount, locale)}
            </p>
          ))}
        <p className="font-semibold text-brand">
          {t("calendar.grandTotal")}: {formatMoney(grand, locale)}
        </p>
      </Card>

      {(job.linkedEntries?.length > 0 || job.linkedExpenses?.length > 0) && (
        <Card className="space-y-2 text-sm">
          <p className="font-semibold">{t("calendar.linkedActuals")}</p>
          {job.linkedEntries?.map((e) => (
            <p key={e._id} className="text-muted">
              {e.workerName}: {e.startTime}–{e.endTime} ({e.hours}h
              {e.travelHours ? ` + ${e.travelHours}` : ""})
            </p>
          ))}
          {job.linkedExpenses?.map((e) => (
            <p key={e._id} className="text-muted">
              {t(`expenses.${e.type}`)}: {formatMoney(e.total, locale)}
            </p>
          ))}
        </Card>
      )}
    </div>
  );
}
