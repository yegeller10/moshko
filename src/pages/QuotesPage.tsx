import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { formatMoney } from "@/lib/costs";
import { cn } from "@/lib/utils";
import type { Id } from "../../convex/_generated/dataModel";

type JobStatus = "booked" | "approved" | "done" | "cancelled";

const ALL_STATUSES: JobStatus[] = [
  "booked",
  "approved",
  "done",
  "cancelled",
];

function formatLocalDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function defaultFromDate() {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return formatLocalDate(d);
}

function defaultToDate() {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + 2);
  d.setDate(0);
  return formatLocalDate(d);
}

function statusCardClass(status: JobStatus) {
  if (status === "approved") return "border-emerald-200 bg-emerald-50";
  if (status === "done") return "border-zinc-200 bg-zinc-100";
  if (status === "cancelled") return "border-red-200 bg-red-50";
  return "border-amber-200 bg-amber-50";
}

function statusPillClass(status: JobStatus) {
  if (status === "approved") return "bg-emerald-100 text-emerald-800";
  if (status === "done") return "bg-zinc-200 text-zinc-700";
  if (status === "cancelled") return "bg-red-100 text-red-800";
  return "bg-amber-100 text-amber-900";
}

export function QuotesPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "he" ? "he-IL" : "en-IL";
  const navigate = useNavigate();

  const [fromDate, setFromDate] = useState(defaultFromDate);
  const [toDate, setToDate] = useState(defaultToDate);
  const [clientId, setClientId] = useState("");
  const [statuses, setStatuses] = useState<JobStatus[]>([
    "booked",
    "approved",
    "done",
  ]);

  const clients = useQuery(api.clients.list, {});
  const jobs = useQuery(
    api.calendar.listOpen,
    statuses.length === 0
      ? "skip"
      : {
          fromDate,
          toDate,
          clientId: clientId
            ? (clientId as Id<"clients">)
            : undefined,
          statuses,
        },
  );

  const statusSet = useMemo(() => new Set(statuses), [statuses]);

  function toggleStatus(status: JobStatus) {
    setStatuses((prev) =>
      prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status],
    );
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold md:text-2xl">{t("quotes.title")}</h2>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => navigate("/jobs/new?mode=quote")}
          >
            {t("quotes.newQuote")}
          </Button>
          <Button size="sm" onClick={() => navigate("/jobs/new?mode=job")}>
            {t("quotes.newJob")}
          </Button>
        </div>
      </div>

      <Card className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label>{t("quotes.fromDate")}</Label>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>
          <div>
            <Label>{t("quotes.toDate")}</Label>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
          <div>
            <Label>{t("quotes.filterClient")}</Label>
            <Select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            >
              <option value="">{t("quotes.allClients")}</option>
              {(clients ?? []).map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div>
          <Label>{t("quotes.filterStatus")}</Label>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {ALL_STATUSES.map((status) => {
              const on = statusSet.has(status);
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => toggleStatus(status)}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                    on
                      ? statusPillClass(status)
                      : "border-border bg-white text-muted",
                  )}
                >
                  {t(`calendar.status.${status}`)}
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      {statuses.length === 0 ? (
        <Card className="text-sm text-muted">{t("quotes.noStatusSelected")}</Card>
      ) : jobs === undefined ? (
        <p className="text-sm text-muted">{t("common.loading")}</p>
      ) : jobs.length === 0 ? (
        <Card className="text-sm text-muted">{t("quotes.empty")}</Card>
      ) : (
        <ul className="space-y-2">
          {jobs.map((job) => {
            const workerCount =
              job.workerAssignments?.length ?? job.workerIds.length;
            const status = job.status as JobStatus;
            const draftTotal = (job.draftCharges ?? []).reduce(
              (sum, c) => sum + (c.amount > 0 ? c.amount : 0),
              0,
            );
            const total = (job.quote?.grandTotal ?? 0) + draftTotal;
            return (
              <li key={job._id}>
                <button
                  type="button"
                  onClick={() => navigate(`/jobs/${job._id}`)}
                  className={cn(
                    "flex w-full flex-col gap-1 rounded-2xl border px-4 py-3 text-start transition-colors hover:brightness-95",
                    statusCardClass(status),
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-ink">
                      {job.client?.name ?? "—"}
                    </p>
                    <span
                      className={cn(
                        "rounded-lg px-2 py-0.5 text-xs font-bold",
                        statusPillClass(status),
                      )}
                    >
                      {t(`calendar.status.${status}`)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                    <span>{job.date}</span>
                    {job.locationText ? <span>{job.locationText}</span> : null}
                    <span>
                      {t("quotes.workers")}: {workerCount}
                    </span>
                    <span className="font-semibold text-brand">
                      {formatMoney(total, locale)}
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
