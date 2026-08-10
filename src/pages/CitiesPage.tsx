import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Id } from "../../convex/_generated/dataModel";
import {
  downloadCityCsvTemplate,
  parseCityCsv,
  type ParsedCityCsvRow,
} from "@/lib/cityCsv";

export function CitiesPage() {
  const { t } = useTranslation();
  const cities = useQuery(api.cities.list, { includeInactive: true });
  const createCity = useMutation(api.cities.create);
  const addRateVersion = useMutation(api.cities.addRateVersion);
  const setCityActive = useMutation(api.cities.setActive);
  const renameCity = useMutation(api.cities.rename);
  const importRows = useMutation(api.cities.importRows);

  const [selectedId, setSelectedId] = useState<Id<"cities"> | null>(null);
  const versions = useQuery(
    api.cities.listVersions,
    selectedId ? { cityId: selectedId } : "skip",
  );

  const [name, setName] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [carRate, setCarRate] = useState("0");
  const [commuteRate, setCommuteRate] = useState("0");
  const [msg, setMsg] = useState<string | null>(null);

  const [rateFrom, setRateFrom] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [rateCar, setRateCar] = useState("0");
  const [rateCommute, setRateCommute] = useState("0");

  const [renameValue, setRenameValue] = useState("");
  const [csvRows, setCsvRows] = useState<ParsedCityCsvRow[]>([]);
  const [csvStatus, setCsvStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");

  const selected = useMemo(
    () => cities?.find((c) => c._id === selectedId) ?? null,
    [cities, selectedId],
  );

  const filteredCities = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!cities) return [];
    if (!q) return cities;
    return cities.filter((c) => c.name.toLowerCase().includes(q));
  }, [cities, search]);

  const validCsv = csvRows.filter((r) => r.errors.length === 0);
  const errorCsv = csvRows.filter((r) => r.errors.length > 0);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      const id = await createCity({
        name: name.trim(),
        effectiveFrom,
        carRate: Number(carRate) || 0,
        commuteRate: Number(commuteRate) || 0,
      });
      setName("");
      setSelectedId(id);
      setMsg("ok");
    } catch {
      setMsg("error");
    }
  }

  async function onAddRates(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    setMsg(null);
    try {
      await addRateVersion({
        cityId: selectedId,
        effectiveFrom: rateFrom,
        carRate: Number(rateCar) || 0,
        commuteRate: Number(rateCommute) || 0,
      });
      setMsg("ok");
    } catch {
      setMsg("error");
    }
  }

  async function onRename(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId || !renameValue.trim()) return;
    setMsg(null);
    try {
      await renameCity({ id: selectedId, name: renameValue.trim() });
      setRenameValue("");
      setMsg("ok");
    } catch {
      setMsg("error");
    }
  }

  async function onImportCsv() {
    if (!validCsv.length) return;
    setBusy(true);
    setCsvStatus(null);
    try {
      const result = await importRows({
        rows: validCsv.map((r) => ({
          cityName: r.city_name,
          effectiveFrom: r.effective_from,
          carRate: r.car_rate,
          commuteRate: r.commute_rate,
        })),
      });
      setCsvStatus(
        `ok:${result.createdCities}:${result.versions}`,
      );
      setCsvRows([]);
    } catch {
      setCsvStatus("error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-5xl space-y-4">
      <div>
        <h2 className="text-xl font-bold md:text-2xl">{t("cities.title")}</h2>
        <p className="text-sm text-muted">{t("cities.hint")}</p>
      </div>

      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t("common.search")}
        className="max-w-md"
      />

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card className="space-y-3 overflow-x-auto">
          <h3 className="font-semibold">{t("cities.list")}</h3>
          <table className="w-full min-w-[28rem] text-sm">
            <thead>
              <tr className="border-b border-border text-start text-muted">
                <th className="py-2 pe-2 font-medium">{t("cities.name")}</th>
                <th className="py-2 pe-2 font-medium">{t("cities.carRate")}</th>
                <th className="py-2 pe-2 font-medium">
                  {t("cities.commuteRate")}
                </th>
                <th className="py-2 pe-2 font-medium">{t("cities.active")}</th>
                <th className="py-2 font-medium">{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredCities.map((c) => (
                <tr key={c._id} className="border-b border-zinc-100">
                  <td className="py-2 pe-2 font-medium">{c.name}</td>
                  <td className="py-2 pe-2">
                    {c.currentRates?.carRate ?? "—"}
                  </td>
                  <td className="py-2 pe-2">
                    {c.currentRates?.commuteRate ?? "—"}
                  </td>
                  <td className="py-2 pe-2">
                    {c.active ? t("common.yes") : t("common.no")}
                  </td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-1">
                      <Button
                        size="sm"
                        variant={
                          selectedId === c._id ? "default" : "secondary"
                        }
                        onClick={() => {
                          setSelectedId(c._id);
                          setRenameValue(c.name);
                          setRateCar(String(c.currentRates?.carRate ?? 0));
                          setRateCommute(
                            String(c.currentRates?.commuteRate ?? 0),
                          );
                        }}
                      >
                        {t("cities.open")}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          void setCityActive({
                            id: c._id,
                            active: !c.active,
                          })
                        }
                      >
                        {c.active ? t("cities.deactivate") : t("cities.activate")}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!cities?.length ? (
            <p className="text-sm text-muted">{t("cities.empty")}</p>
          ) : filteredCities.length === 0 ? (
            <p className="text-sm text-muted">{t("common.noResults")}</p>
          ) : null}
        </Card>

        <Card className="space-y-3">
          <h3 className="font-semibold">{t("cities.add")}</h3>
          <form onSubmit={onCreate} className="grid gap-3">
            <div>
              <Label>{t("cities.name")}</Label>
              <Input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <Label>{t("cities.effectiveFrom")}</Label>
              <Input
                type="date"
                required
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>{t("cities.carRate")}</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={carRate}
                  onChange={(e) => setCarRate(e.target.value)}
                />
              </div>
              <div>
                <Label>{t("cities.commuteRate")}</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.25"
                  value={commuteRate}
                  onChange={(e) => setCommuteRate(e.target.value)}
                />
              </div>
            </div>
            <Button type="submit">{t("cities.create")}</Button>
          </form>
          {msg === "ok" && (
            <p className="text-xs text-brand">{t("entries.saved")}</p>
          )}
          {msg === "error" && (
            <p className="text-xs text-red-700">{t("common.error")}</p>
          )}
        </Card>
      </div>

      {selected && (
        <Card className="space-y-4">
          <div>
            <h3 className="font-semibold">
              {t("cities.detail")}: {selected.name}
            </h3>
            <p className="text-sm text-muted">{t("cities.versionsHint")}</p>
          </div>

          <form
            onSubmit={onRename}
            className="flex flex-wrap items-end gap-2"
          >
            <div className="min-w-[12rem] flex-1">
              <Label>{t("cities.rename")}</Label>
              <Input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
              />
            </div>
            <Button type="submit" variant="secondary">
              {t("common.save")}
            </Button>
          </form>

          <form onSubmit={onAddRates} className="grid gap-3 sm:grid-cols-4">
            <div>
              <Label>{t("cities.effectiveFrom")}</Label>
              <Input
                type="date"
                required
                value={rateFrom}
                onChange={(e) => setRateFrom(e.target.value)}
              />
            </div>
            <div>
              <Label>{t("cities.carRate")}</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={rateCar}
                onChange={(e) => setRateCar(e.target.value)}
              />
            </div>
            <div>
              <Label>{t("cities.commuteRate")}</Label>
              <Input
                type="number"
                min="0"
                step="0.25"
                value={rateCommute}
                onChange={(e) => setRateCommute(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" className="w-full">
                {t("cities.saveVersion")}
              </Button>
            </div>
          </form>

          <div>
            <p className="mb-2 text-sm font-medium">{t("cities.history")}</p>
            <ul className="space-y-1 text-sm">
              {(versions ?? []).map((v) => (
                <li
                  key={v._id}
                  className="rounded-lg border border-zinc-100 px-3 py-2"
                >
                  {v.effectiveFrom}: {t("cities.carRate")} {v.carRate} ·{" "}
                  {t("cities.commuteRate")} {v.commuteRate}h
                </li>
              ))}
              {!versions?.length && (
                <li className="text-muted">{t("cities.noVersions")}</li>
              )}
            </ul>
          </div>
        </Card>
      )}

      <Card className="space-y-3">
        <h3 className="font-semibold">{t("cities.csvTitle")}</h3>
        <p className="text-sm text-muted">{t("cities.csvHint")}</p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => downloadCityCsvTemplate()}
          >
            {t("cities.downloadTemplate")}
          </Button>
          <Label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm">
            {t("cities.upload")}
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                void f.text().then((text) => {
                  setCsvRows(parseCityCsv(text));
                  setCsvStatus(null);
                });
              }}
            />
          </Label>
          {validCsv.length > 0 && (
            <Button
              type="button"
              disabled={busy}
              onClick={() => void onImportCsv()}
            >
              {busy ? t("common.loading") : t("cities.import")}
            </Button>
          )}
        </div>
        {csvRows.length > 0 && (
          <p className="text-sm">
            {t("cities.okRows")}: {validCsv.length} · {t("cities.errorRows")}:{" "}
            {errorCsv.length}
          </p>
        )}
        {errorCsv.length > 0 && (
          <ul className="max-h-40 overflow-auto text-xs text-red-700">
            {errorCsv.slice(0, 20).map((r) => (
              <li key={r.rowNumber}>
                #{r.rowNumber}: {r.errors.join(", ")}
              </li>
            ))}
          </ul>
        )}
        {csvStatus?.startsWith("ok:") && (
          <p className="text-xs text-brand">
            {t("cities.importOk", {
              cities: csvStatus.split(":")[1],
              versions: csvStatus.split(":")[2],
            })}
          </p>
        )}
        {csvStatus === "error" && (
          <p className="text-xs text-red-700">{t("common.error")}</p>
        )}
      </Card>
    </div>
  );
}
