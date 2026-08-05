import { useState } from "react";
import { useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { currentYearMonth } from "@/lib/utils";
import { formatMoney } from "@/lib/costs";
import type { Id } from "../../convex/_generated/dataModel";

export function ReportsPage() {
  const { t, i18n } = useTranslation();
  const clients = useQuery(api.clients.list, {});
  const [clientId, setClientId] = useState("");
  const [yearMonth, setYearMonth] = useState(currentYearMonth());
  const [submitted, setSubmitted] = useState<{
    clientId: Id<"clients">;
    yearMonth: string;
  } | null>(null);

  const report = useQuery(
    api.reports.monthlyClientReport,
    submitted ?? "skip",
  );

  const locale = i18n.language === "he" ? "he-IL" : "en-IL";

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">{t("reports.title")}</h2>

      <Card className="space-y-3">
        <div>
          <Label>{t("reports.selectClient")}</Label>
          <Select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          >
            <option value="">—</option>
            {(clients ?? []).map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>{t("reports.month")}</Label>
          <Input
            type="month"
            value={yearMonth}
            onChange={(e) => setYearMonth(e.target.value)}
          />
        </div>
        <Button
          className="w-full"
          disabled={!clientId}
          onClick={() =>
            setSubmitted({
              clientId: clientId as Id<"clients">,
              yearMonth,
            })
          }
        >
          {t("reports.generate")}
        </Button>
      </Card>

      {report === null && submitted && (
        <Card className="text-sm text-slate-500">{t("reports.empty")}</Card>
      )}

      {report && (
        <div className="space-y-3">
          {!report.overtimeConfigured && (
            <Card className="border-amber-200 bg-amber-50 text-sm text-amber-900">
              {t("reports.overtimeNote")}
            </Card>
          )}

          <Card className="space-y-1">
            <p className="font-semibold">{report.client.name}</p>
            <p className="text-sm text-slate-600">
              {t("reports.totalHours")}: {report.totalHours} ·{" "}
              {t("reports.monthTotal")}: {formatMoney(report.monthTotal, locale)}
            </p>
            <p className="text-xs text-slate-400">{t("reports.emailFuture")}</p>
          </Card>

          {!report.rows.length ? (
            <Card className="text-sm text-slate-500">{t("reports.empty")}</Card>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
              <table className="min-w-full text-start text-sm">
                <thead className="bg-slate-50 text-xs text-slate-600">
                  <tr>
                    <th className="px-3 py-2 font-medium">{t("reports.date")}</th>
                    <th className="px-3 py-2 font-medium">{t("reports.worker")}</th>
                    <th className="px-3 py-2 font-medium">{t("reports.location")}</th>
                    <th className="px-3 py-2 font-medium">{t("reports.hours")}</th>
                    <th className="px-3 py-2 font-medium">{t("reports.labor")}</th>
                    <th className="px-3 py-2 font-medium">{t("reports.addons")}</th>
                    <th className="px-3 py-2 font-medium">{t("reports.lineTotal")}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((r) => (
                    <tr key={r.entryId} className="border-t border-slate-100">
                      <td className="px-3 py-2 whitespace-nowrap">{r.date}</td>
                      <td className="px-3 py-2">{r.workerName}</td>
                      <td className="px-3 py-2">{r.location}</td>
                      <td className="px-3 py-2">{r.hours}</td>
                      <td className="px-3 py-2">
                        {formatMoney(r.laborCost, locale)}
                      </td>
                      <td className="px-3 py-2">
                        {formatMoney(r.addonCost, locale)}
                      </td>
                      <td className="px-3 py-2 font-medium">
                        {formatMoney(r.lineTotal, locale)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200 bg-teal-50 font-semibold">
                    <td className="px-3 py-2" colSpan={3}>
                      {t("reports.monthTotal")}
                    </td>
                    <td className="px-3 py-2">{report.totalHours}</td>
                    <td className="px-3 py-2" colSpan={2} />
                    <td className="px-3 py-2">
                      {formatMoney(report.monthTotal, locale)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
