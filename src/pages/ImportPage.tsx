import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  downloadCsvTemplate,
  parseEntriesCsv,
  type ParsedCsvRow,
} from "@/lib/csv";
import type { Id } from "../../convex/_generated/dataModel";

export function ImportPage() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<ParsedCsvRow[]>([]);
  const [createMissing, setCreateMissing] = useState(false);
  const [defaultRate, setDefaultRate] = useState("100");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const workerNames = useMemo(
    () => [...new Set(rows.map((r) => r.worker_name).filter(Boolean))],
    [rows],
  );
  const clientNames = useMemo(
    () => [...new Set(rows.map((r) => r.client_name).filter(Boolean))],
    [rows],
  );

  const resolved = useQuery(
    api.import.resolveImportNames,
    rows.length
      ? { workerNames, clientNames }
      : "skip",
  );

  const ensureEntities = useMutation(api.import.ensureNamedEntities);
  const createMany = useMutation(api.entries.createMany);

  const validRows = rows.filter((r) => r.errors.length === 0);
  const errorRows = rows.filter((r) => r.errors.length > 0);

  async function onFile(file: File) {
    const text = await file.text();
    setRows(parseEntriesCsv(text));
    setStatus(null);
  }

  async function onCommit() {
    setBusy(true);
    setStatus(null);
    try {
      let workerIds: Record<string, Id<"workers">> = {};
      let clientIds: Record<string, Id<"clients">> = {};

      if (createMissing) {
        const created = await ensureEntities({
          workers: workerNames.filter(
            (n) => resolved && resolved.workerMap[n] == null,
          ),
          clients: clientNames
            .filter((n) => resolved && resolved.clientMap[n] == null)
            .map((name) => ({
              name,
              hourlyRate: Number(defaultRate) || 0,
            })),
        });
        workerIds = created.workerIds as Record<string, Id<"workers">>;
        clientIds = created.clientIds as Record<string, Id<"clients">>;
      }

      const payload: Array<{
        workerId: Id<"workers">;
        clientId: Id<"clients">;
        location: string;
        date: string;
        startTime: string;
        endTime: string;
        addons: Array<{
          type: "car_drive" | "parking" | "other";
          amount: number;
          note?: string;
        }>;
      }> = [];
      for (const row of validRows) {
        const workerId =
          (resolved?.workerMap[row.worker_name] as Id<"workers"> | null) ??
          workerIds[row.worker_name] ??
          null;
        const clientId =
          (resolved?.clientMap[row.client_name] as Id<"clients"> | null) ??
          clientIds[row.client_name] ??
          null;
        if (!workerId || !clientId) {
          throw new Error(`Missing entity for row ${row.rowNumber}`);
        }
        const addons = [];
        if (row.car_hours > 0)
          addons.push({ type: "car_drive" as const, amount: row.car_hours });
        if (row.parking > 0)
          addons.push({ type: "parking" as const, amount: row.parking });
        if (row.other_amount > 0)
          addons.push({
            type: "other" as const,
            amount: row.other_amount,
            note: row.other_note || undefined,
          });
        payload.push({
          workerId,
          clientId,
          location: row.location,
          date: row.date,
          startTime: row.start_time,
          endTime: row.end_time,
          addons,
        });
      }

      await createMany({ rows: payload });
      setStatus("done");
      setRows([]);
    } catch (e) {
      console.error(e);
      setStatus("error");
    } finally {
      setBusy(false);
    }
  }

  const unresolved =
    resolved &&
    validRows.some(
      (r) =>
        resolved.workerMap[r.worker_name] == null ||
        resolved.clientMap[r.client_name] == null,
    );

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">{t("import.title")}</h2>

      <Card className="space-y-3">
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          onClick={downloadCsvTemplate}
        >
          {t("import.downloadTemplate")}
        </Button>
        <div>
          <Label htmlFor="csv">{t("import.upload")}</Label>
          <Input
            id="csv"
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onFile(f);
            }}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={createMissing}
            onChange={(e) => setCreateMissing(e.target.checked)}
          />
          {t("import.createMissing")}
        </label>
        {createMissing && (
          <div>
            <Label>{t("import.defaultRate")}</Label>
            <Input
              type="number"
              min="0"
              value={defaultRate}
              onChange={(e) => setDefaultRate(e.target.value)}
            />
          </div>
        )}
      </Card>

      {rows.length > 0 && (
        <Card className="space-y-2">
          <p className="text-sm font-semibold">{t("import.preview")}</p>
          <p className="text-sm text-slate-600">
            {t("import.okRows")}: {validRows.length} · {t("import.errors")}:{" "}
            {errorRows.length}
          </p>
          {errorRows.slice(0, 5).map((r) => (
            <p key={r.rowNumber} className="text-xs text-red-700">
              #{r.rowNumber}: {r.errors.join(", ")}
            </p>
          ))}
          {unresolved && !createMissing && (
            <p className="text-xs text-amber-800">
              Some workers/clients are missing — enable create-missing or add
              them first.
            </p>
          )}
          <Button
            className="w-full"
            disabled={
              busy ||
              validRows.length === 0 ||
              (Boolean(unresolved) && !createMissing)
            }
            onClick={() => void onCommit()}
          >
            {busy ? t("common.loading") : t("import.commit")}
          </Button>
        </Card>
      )}

      {status === "done" && (
        <Card className="text-sm text-teal-800">{t("import.done")}</Card>
      )}
      {status === "error" && (
        <Card className="text-sm text-red-700">{t("common.error")}</Card>
      )}
    </div>
  );
}
