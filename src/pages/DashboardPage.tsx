import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { Plus, Upload, FileBarChart2 } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { currentYearMonth } from "@/lib/utils";
import { formatMoney } from "@/lib/costs";

export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const yearMonth = currentYearMonth();
  const stats = useQuery(api.reports.dashboardStats, { yearMonth });
  const recent = useQuery(api.entries.recent, { limit: 6 });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold">{t("dashboard.title")}</h2>
        <p className="text-sm text-slate-500">
          {t("dashboard.thisMonth")}: {yearMonth}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Metric
          label={t("dashboard.totalHours")}
          value={stats ? String(stats.totalHours) : "—"}
        />
        <Metric
          label={t("dashboard.totalCost")}
          value={
            stats
              ? formatMoney(stats.totalCost, i18n.language === "he" ? "he-IL" : "en-IL")
              : "—"
          }
        />
        <Metric
          label={t("dashboard.entries")}
          value={stats ? String(stats.entriesCount) : "—"}
        />
        <Metric
          label={t("dashboard.activeClients")}
          value={stats ? String(stats.activeClients) : "—"}
        />
      </div>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-700">
          {t("dashboard.quickActions")}
        </h3>
        <div className="grid gap-2">
          <Button asChild className="justify-start" size="lg">
            <Link to="/entries/new">
              <Plus className="h-5 w-5" />
              {t("dashboard.newEntry")}
            </Link>
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button asChild variant="secondary" className="justify-start">
              <Link to="/import">
                <Upload className="h-4 w-4" />
                {t("dashboard.importCsv")}
              </Link>
            </Button>
            <Button asChild variant="secondary" className="justify-start">
              <Link to="/reports">
                <FileBarChart2 className="h-4 w-4" />
                {t("dashboard.monthReport")}
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-700">
          {t("dashboard.recent")}
        </h3>
        {!recent?.length ? (
          <Card className="text-sm text-slate-500">{t("dashboard.emptyRecent")}</Card>
        ) : (
          <ul className="space-y-2">
            {recent.map((e) => (
              <li key={e._id}>
                <Card className="flex items-start justify-between gap-2 py-3">
                  <div>
                    <p className="font-medium">
                      {e.worker?.name} · {e.client?.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {e.date} · {e.location} · {e.startTime}–{e.endTime}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-teal-800">
                    {e.hours}h
                  </span>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card className="space-y-1">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-xl font-bold text-slate-900">{value}</p>
    </Card>
  );
}
