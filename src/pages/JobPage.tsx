import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { JobForm, type JobFormMode } from "@/components/jobs/JobForm";
import type { Id } from "../../convex/_generated/dataModel";

export function JobPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const isNew = !id || id === "new";

  const modeParam = searchParams.get("mode");
  const mode: JobFormMode =
    modeParam === "job" ? "job" : "quote";
  const initialDate = searchParams.get("date") ?? undefined;

  const title = isNew
    ? mode === "job"
      ? t("jobs.newJob")
      : t("jobs.newQuote")
    : t("jobs.edit");

  const backTo = mode === "job" && isNew ? "/calendar" : "/quotes";

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold md:text-2xl">{title}</h2>
        <Link
          to={backTo}
          className="text-sm font-medium text-brand hover:underline"
        >
          {t("common.back")}
        </Link>
      </div>

      <JobForm
        mode={isNew ? mode : "quote"}
        jobId={isNew ? undefined : (id as Id<"calendarEvents">)}
        initialDate={isNew ? initialDate : undefined}
        onSaved={(savedId) => {
          if (isNew) {
            navigate(`/jobs/${savedId}`, { replace: true });
          }
        }}
      />
    </div>
  );
}
