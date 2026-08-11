import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { FileBarChart2, ClipboardList, FilePlus } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { currentYearMonth } from "@/lib/utils";
import { formatMoney } from "@/lib/costs";

export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "he" ? "he-IL" : "en-IL";
  const yearMonth = currentYearMonth();
  const stats = useQuery(api.reports.dashboardStats, { yearMonth });

  return (
    <div className="w-full space-y-6">
      <div>
        <h2 className="text-xl font-bold md:text-2xl">{t("dashboard.title")}</h2>
        <p className="text-sm text-muted">
          {t("dashboard.thisMonth")}: {yearMonth}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="space-y-2">
          <p className="text-xs text-muted">{t("dashboard.openOrders")}</p>
          <p className="text-3xl font-bold text-ink">
            {stats ? stats.openOrdersTotal : "—"}
          </p>
          <p className="text-sm text-muted">
            {t("dashboard.openQuotes")}: {stats?.openQuotes ?? "—"} ·{" "}
            {t("dashboard.openConfirmed")}: {stats?.openConfirmed ?? "—"}
          </p>
        </Card>
        <Card className="space-y-2">
          <p className="text-xs text-muted">{t("dashboard.doneJobs")}</p>
          <p className="text-3xl font-bold text-ink">
            {stats
              ? formatMoney(stats.doneJobsAmount, locale)
              : "—"}
          </p>
          <p className="text-sm text-muted">
            {t("dashboard.doneJobsCount")}: {stats?.doneJobsCount ?? "—"} ·{" "}
            {t("dashboard.doneJobsHours")}: {stats?.doneJobsHours ?? "—"}
          </p>
        </Card>
      </div>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-zinc-700">
          {t("dashboard.quickActions")}
        </h3>
        <div className="grid gap-2 sm:grid-cols-3">
          <Button asChild className="justify-start" size="lg">
            <Link to="/jobs/new?mode=quote">
              <FilePlus className="h-5 w-5" />
              {t("quotes.newQuote")}
            </Link>
          </Button>
          <Button asChild variant="secondary" className="justify-start" size="lg">
            <Link to="/quotes">
              <ClipboardList className="h-5 w-5" />
              {t("nav.quotes")}
            </Link>
          </Button>
          <Button asChild variant="secondary" className="justify-start" size="lg">
            <Link to="/reports">
              <FileBarChart2 className="h-5 w-5" />
              {t("dashboard.monthReport")}
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
