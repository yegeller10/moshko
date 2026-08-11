import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { JobForm, type JobFormMode } from "@/components/jobs/JobForm";
import { JobSummary } from "@/components/jobs/JobSummary";
import type { Id } from "../../convex/_generated/dataModel";
import { cn } from "@/lib/utils";

export function JobPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const isNew = !id || id === "new";

  const modeParam = searchParams.get("mode");
  const [createMode, setCreateMode] = useState<JobFormMode>(
    modeParam === "job" ? "job" : "quote",
  );
  const initialDate = searchParams.get("date") ?? undefined;
  const [editing, setEditing] = useState(isNew);

  const title = isNew
    ? t("jobs.newJob")
    : editing
      ? t("jobs.edit")
      : t("jobs.summary");

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold md:text-2xl">{title}</h2>
        <div className="flex flex-wrap items-center gap-3">
          {editing && !isNew && (
            <button
              type="button"
              className="text-sm font-medium text-brand hover:underline"
              onClick={() => setEditing(false)}
            >
              {t("jobs.viewSummary")}
            </button>
          )}
          <Link
            to="/quotes"
            className="text-sm font-medium text-brand hover:underline"
          >
            {t("common.back")}
          </Link>
        </div>
      </div>

      {isNew && (
        <div className="inline-flex rounded-xl border border-border bg-zinc-50 p-1">
          <button
            type="button"
            onClick={() => setCreateMode("quote")}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors",
              createMode === "quote"
                ? "bg-white text-ink shadow-sm"
                : "text-muted",
            )}
          >
            {t("jobs.asQuote")}
          </button>
          <button
            type="button"
            onClick={() => setCreateMode("job")}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors",
              createMode === "job"
                ? "bg-white text-ink shadow-sm"
                : "text-muted",
            )}
          >
            {t("jobs.asConfirmed")}
          </button>
        </div>
      )}

      {!isNew && !editing ? (
        <JobSummary
          jobId={id as Id<"calendarEvents">}
          onEdit={() => setEditing(true)}
        />
      ) : (
        <JobForm
          mode={isNew ? createMode : "quote"}
          jobId={isNew ? undefined : (id as Id<"calendarEvents">)}
          initialDate={isNew ? initialDate : undefined}
          onSaved={(savedId) => {
            if (isNew) {
              navigate(`/jobs/${savedId}`, { replace: true });
            } else {
              setEditing(false);
            }
          }}
        />
      )}
    </div>
  );
}
