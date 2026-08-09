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
    rows.length ? { workerNames, clientNames } : "skip",
  );

  const ensureEntities = useMutation(api.import.ensureNamedEntities);

  const validRows = rows.filter((r) => r.errors.length === 0);
  const errorRows = rows.filter((r) => r.errors.length > 0);

  async function onFile(file: File) {
    const text = await file.text();
    setRows(parseEntriesCsv(text));
    setStatus(null);
  }

  async function onEnsureOnly() {
    setBusy(true);
    setStatus(null);
    try {
      if (createMissing) {
        await ensureEntities({
          workers: workerNames.filter(
            (n) => resolved && resolved.workerMap[n] == null,
          ),
          clients: clientNames
            .filter((n) => resolved && resolved.clientMap[n] == null)
            .map((name) => ({
              name,
              hourlyRate: Number(defaultRate) || 100,
            })),
        });
      }
      setStatus("entities");
    } catch (e) {
      console.error(e);
      setStatus("error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-3xl space-y-4">
      <h2 className="text-xl font-bold md:text-2xl">{t("import.title")}</h2>
      <Card className="space-y-2 text-sm text-muted">
        <p>{t("import.jobLinkNote")}</p>
      </Card>

      <Card className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => downloadCsvTemplate()}>
            {t("import.downloadTemplate")}
          </Button>
          <Label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm">
            {t("import.upload")}
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onFile(f);
              }}
            />
          </Label>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={createMissing}
            onChange={(e) => setCreateMissing(e.target.checked)}
          />
          {t("import.createMissing")}
        </label>
        <div>
          <Label>{t("import.defaultRate")}</Label>
          <Input
            type="number"
            value={defaultRate}
            onChange={(e) => setDefaultRate(e.target.value)}
          />
        </div>
        {rows.length > 0 && (
          <p className="text-sm">
            {t("import.okRows")}: {validRows.length} · {t("import.errors")}:{" "}
            {errorRows.length}
          </p>
        )}
        <Button
          type="button"
          disabled={busy || !rows.length}
          onClick={() => void onEnsureOnly()}
        >
          {busy ? t("common.loading") : t("import.createMissing")}
        </Button>
        {status === "entities" && (
          <p className="text-sm text-brand">{t("import.done")}</p>
        )}
        {status === "error" && (
          <p className="text-sm text-red-700">{t("common.error")}</p>
        )}
      </Card>
    </div>
  );
}
