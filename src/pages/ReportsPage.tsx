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
    <div className="w-full space-y-4">
      <h2 className="text-xl font-bold md:text-2xl">{t("reports.title")}</h2>

      <Card className="grid gap-3 sm:grid-cols-3 sm:items-end">
        <div className="sm:col-span-1">
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
        <Card className="text-sm text-muted">{t("reports.empty")}</Card>
      )}

      {report && (
        <div className="space-y-3">
          <Card className="space-y-1">
            <p className="font-semibold">{report.client.name}</p>
            <p className="text-sm text-zinc-600">
              {t("reports.totalHours")}: {report.totalHours} ·{" "}
              {t("reports.labor")}: {formatMoney(report.laborTotal, locale)} ·{" "}
              {t("reports.expenses")}:{" "}
              {formatMoney(report.expenseTotal, locale)} ·{" "}
              {t("reports.monthTotal")}:{" "}
              {formatMoney(report.monthTotal, locale)}
            </p>
            <p className="text-xs text-muted">{t("reports.emailFuture")}</p>
          </Card>

          {!report.groups.length ? (
            <Card className="text-sm text-muted">{t("reports.empty")}</Card>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-border bg-white">
              <table className="min-w-full text-start text-sm">
                <thead className="bg-blue-50 text-xs text-zinc-600">
                  <tr>
                    {["name", "enter", "exit", "h100", "h125", "h150", "h200", "travel", "totalH", "rate", "payment"].map((key) => <th key={key} className="whitespace-nowrap px-3 py-2 font-medium">{t(`reports.${key}`)}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {report.groups.flatMap((group) => [
                    <tr key={`date-${group.date}`} className="border-t border-zinc-200 bg-zinc-50 font-semibold"><td className="px-3 py-2" colSpan={11}>{group.date} · {formatMoney(group.dayTotal, locale)}</td></tr>,
                    ...group.rows.map((row) => <tr key={row.id} className="border-t border-zinc-100">
                      <td className="px-3 py-2">{row.kind === "worker" ? <><strong>{row.name}</strong><span className="block text-xs text-muted">{row.location}</span></> : <><span>{row.name}</span><span className="block text-xs text-muted">{row.location}</span></>}</td>
                      <td className="px-3 py-2">{row.enter ?? ""}</td><td className="px-3 py-2">{row.exit ?? ""}</td><td className="px-3 py-2">{row.h100 ?? ""}</td><td className="px-3 py-2">{row.h125 ?? ""}</td><td className="px-3 py-2">{row.h150 ?? ""}</td><td className="px-3 py-2">{row.h200 ?? ""}</td><td className="px-3 py-2">{row.travelH ?? ""}</td><td className="px-3 py-2">{row.totalH ?? ""}</td><td className="px-3 py-2">{row.rate === null ? "" : formatMoney(row.rate, locale)}</td><td className="px-3 py-2 font-medium">{formatMoney(row.payment, locale)}</td>
                    </tr>),
                  ])}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border bg-brand-soft font-semibold">
                    <td className="px-3 py-2" colSpan={10}>
                      {t("reports.monthTotal")}
                    </td>
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
