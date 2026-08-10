import { useNavigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatMoney } from "@/lib/costs";
import { cn } from "@/lib/utils";

export function QuotesPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "he" ? "he-IL" : "en-IL";
  const navigate = useNavigate();
  const jobs = useQuery(api.calendar.listOpen, {});

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

      {jobs === undefined ? (
        <p className="text-sm text-muted">{t("common.loading")}</p>
      ) : jobs.length === 0 ? (
        <Card className="text-sm text-muted">{t("quotes.empty")}</Card>
      ) : (
        <ul className="space-y-2">
          {jobs.map((job) => {
            const workerCount =
              job.workerAssignments?.length ?? job.workerIds.length;
            const isApproved = job.status === "approved";
            return (
              <li key={job._id}>
                <button
                  type="button"
                  onClick={() => navigate(`/jobs/${job._id}`)}
                  className={cn(
                    "flex w-full flex-col gap-1 rounded-2xl border px-4 py-3 text-start transition-colors hover:brightness-95",
                    isApproved
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-sky-200 bg-sky-50",
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-ink">
                      {job.client?.name ?? "—"}
                    </p>
                    <span
                      className={cn(
                        "rounded-lg px-2 py-0.5 text-xs font-bold",
                        isApproved
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-900",
                      )}
                    >
                      {t(`calendar.status.${job.status}`)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                    <span>{job.date}</span>
                    <span>
                      {t("quotes.workers")}: {workerCount}
                    </span>
                    <span className="font-semibold text-brand">
                      {formatMoney(job.quote?.grandTotal ?? 0, locale)}
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
