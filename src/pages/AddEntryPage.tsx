import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  computeExpenseTotal,
  computeHours,
  formatMoney,
} from "@/lib/costs";
import { cn } from "@/lib/utils";
import type { Id } from "../../convex/_generated/dataModel";

type EntryKind = "hours" | "car" | "parking" | "other";
type Step = 1 | 2 | 3 | 4;

export function AddEntryPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "he" ? "he-IL" : "en-IL";

  const [step, setStep] = useState<Step>(1);
  const [jobId, setJobId] = useState("");
  const [kind, setKind] = useState<EntryKind | null>(null);
  const [search, setSearch] = useState("");

  const [workerId, setWorkerId] = useState("");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("16:00");
  const [shiftType, setShiftType] = useState<"normal" | "saturday">("normal");
  const [travelHours, setTravelHours] = useState("");

  const [quantity, setQuantity] = useState("1");
  const [unitRate, setUnitRate] = useState("");
  const [note, setNote] = useState("");
  const [title, setTitle] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedJobId, setSavedJobId] = useState<Id<"calendarEvents"> | null>(
    null,
  );

  const workers = useQuery(api.workers.list, {});
  const rates = useQuery(api.expenses.getServiceRates);
  const jobs = useQuery(api.calendar.listForAttach, { includeQuotes: true });
  const selectedJob = useQuery(
    api.calendar.get,
    jobId ? { id: jobId as Id<"calendarEvents"> } : "skip",
  );
  const cityRates = useQuery(
    api.cities.ratesForDate,
    selectedJob?.includeCar && selectedJob.cityId
      ? { cityId: selectedJob.cityId, date: selectedJob.date }
      : "skip",
  );

  const createEntry = useMutation(api.entries.create);
  const createExpense = useMutation(api.expenses.create);
  const approve = useMutation(api.calendar.setStatus);

  const filteredJobs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!jobs) return [];
    if (!q) return jobs;
    return jobs.filter((job) => {
      const hay = [
        job.date,
        job.clientName,
        job.locationText ?? "",
        job.title,
        t(`calendar.status.${job.status}`),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [jobs, search, t]);

  const hours = useMemo(
    () => computeHours(startTime, endTime),
    [startTime, endTime],
  );

  const defaultRate =
    kind === "car"
      ? (rates?.carHourlyRate ?? 0)
      : kind === "parking"
        ? (rates?.parkingRate ?? 0)
        : 0;
  const effectiveRate = unitRate === "" ? defaultRate : Number(unitRate);
  const qty = Number(quantity) || 0;
  const previewTotal = useMemo(
    () => computeExpenseTotal(qty, effectiveRate || 0),
    [qty, effectiveRate],
  );

  useEffect(() => {
    if (kind !== "hours") return;
    if (!selectedJob?.includeCar || !cityRates) return;
    setTravelHours((prev) =>
      prev === "" || prev === "0" ? String(cityRates.commuteRate * 2) : prev,
    );
  }, [kind, selectedJob?.includeCar, cityRates]);

  function pickKind(next: EntryKind) {
    setKind(next);
    setQuantity("1");
    setUnitRate("");
    setNote("");
    setTitle("");
    setError(null);
    setStep(3);
  }

  function resetWizard() {
    setStep(1);
    setJobId("");
    setKind(null);
    setSavedJobId(null);
    setWorkerId("");
    setTravelHours("");
    setQuantity("1");
    setUnitRate("");
    setNote("");
    setTitle("");
    setError(null);
  }

  async function ensureApproved(): Promise<boolean> {
    if (!selectedJob) return false;
    if (selectedJob.status === "approved" || selectedJob.status === "done") {
      return true;
    }
    if (selectedJob.status === "booked") {
      await approve({ id: selectedJob._id, status: "approved" });
      return true;
    }
    return false;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!jobId || !kind || !selectedJob) {
      setError("missing");
      return;
    }
    setSaving(true);
    try {
      const ok = await ensureApproved();
      if (!ok) {
        setError("save");
        return;
      }
      const calendarEventId = jobId as Id<"calendarEvents">;
      if (kind === "hours") {
        if (!workerId) {
          setError("missing");
          return;
        }
        await createEntry({
          workerId: workerId as Id<"workers">,
          calendarEventId,
          startTime,
          endTime,
          shiftType,
          travelHours: travelHours === "" ? undefined : Number(travelHours),
          note: note || undefined,
        });
      } else {
        if (qty <= 0) {
          setError("missing");
          return;
        }
        if (kind === "other" && unitRate === "") {
          setError("missing");
          return;
        }
        const defaultTitle =
          kind === "parking" ? "parking" : kind === "other" ? "other" : "";
        const expenseNote = [title.trim() || defaultTitle, note.trim()]
          .filter(Boolean)
          .join(" — ");
        await createExpense({
          type: kind,
          calendarEventId,
          date: selectedJob.date,
          quantity: qty,
          unitRate: unitRate === "" ? undefined : Number(unitRate),
          note: expenseNote || undefined,
        });
      }
      setSavedJobId(calendarEventId);
      setStep(4);
    } catch (err) {
      console.error(err);
      setError("save");
    } finally {
      setSaving(false);
    }
  }

  const kinds: { id: EntryKind; label: string }[] = [
    { id: "hours", label: t("actuals.types.hours") },
    { id: "car", label: t("expenses.car") },
    { id: "parking", label: t("expenses.parking") },
    { id: "other", label: t("expenses.other") },
  ];

  return (
    <div className="w-full max-w-2xl space-y-4 pb-8">
      <h2 className="text-xl font-bold md:text-2xl">{t("actuals.title")}</h2>
      <p className="text-sm text-muted">{t("actuals.hint")}</p>

      {step === 1 && (
        <Card className="space-y-3">
          <p className="text-sm font-medium">{t("actuals.pickJob")}</p>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("actuals.searchJobs")}
          />
          {jobs === undefined ? (
            <p className="text-sm text-muted">{t("common.loading")}</p>
          ) : filteredJobs.length === 0 ? (
            <p className="text-sm text-muted">{t("actuals.noJobs")}</p>
          ) : (
            <ul className="max-h-[28rem] space-y-2 overflow-y-auto">
              {filteredJobs.map((job) => (
                <li key={job._id}>
                  <button
                    type="button"
                    onClick={() => {
                      setJobId(job._id);
                      setKind(null);
                      setStep(2);
                    }}
                    className={cn(
                      "flex w-full flex-col gap-0.5 rounded-xl border border-border px-3 py-2.5 text-start hover:bg-zinc-50",
                      jobId === job._id && "border-brand bg-brand-soft",
                    )}
                  >
                    <span className="font-medium">{job.clientName}</span>
                    <span className="text-sm text-ink">
                      {job.date}
                      {job.locationText ? ` · ${job.locationText}` : ""}
                    </span>
                    <span className="text-xs text-muted">
                      {t(`calendar.status.${job.status}`)}
                      {job.startTime && job.endTime
                        ? ` · ${job.startTime}–${job.endTime}`
                        : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {step === 2 && (
        <Card className="space-y-3">
          {selectedJob && (
            <p className="text-sm text-muted">
              {selectedJob.client?.name ?? "—"} · {selectedJob.date}
              {selectedJob.locationText
                ? ` · ${selectedJob.locationText}`
                : ""}
            </p>
          )}
          <p className="text-sm font-medium">{t("actuals.pickType")}</p>
          <div className="grid grid-cols-2 gap-2">
            {kinds.map(({ id, label }) => (
              <Button
                key={id}
                type="button"
                variant="secondary"
                className="h-14"
                onClick={() => pickKind(id)}
              >
                {label}
              </Button>
            ))}
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setStep(1)}
          >
            {t("common.back")}
          </Button>
        </Card>
      )}

      {step === 3 && kind && (
        <form onSubmit={onSubmit} className="space-y-3">
          <Card className="space-y-3">
            <p className="text-sm font-medium">
              {kinds.find((k) => k.id === kind)?.label ?? kind}
              {selectedJob
                ? ` · ${selectedJob.client?.name ?? ""} · ${selectedJob.date}`
                : ""}
            </p>

            {kind === "hours" ? (
              <>
                <div>
                  <Label>{t("entries.worker")}</Label>
                  <Select
                    required
                    value={workerId}
                    onChange={(e) => setWorkerId(e.target.value)}
                  >
                    <option value="">—</option>
                    {(workers ?? []).map((w) => (
                      <option key={w._id} value={w._id}>
                        {w.displayName}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>{t("entries.start")}</Label>
                    <Input
                      type="time"
                      required
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>{t("entries.end")}</Label>
                    <Input
                      type="time"
                      required
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                    />
                  </div>
                </div>
                <p className="text-sm text-brand">
                  {t("entries.hours")}: <strong>{hours}</strong>
                </p>
                <div>
                  <Label>{t("entries.shiftType")}</Label>
                  <Select
                    value={shiftType}
                    onChange={(e) =>
                      setShiftType(e.target.value as "normal" | "saturday")
                    }
                  >
                    <option value="normal">
                      {t("entries.shiftTypes.normal")}
                    </option>
                    <option value="saturday">
                      {t("entries.shiftTypes.saturday")}
                    </option>
                  </Select>
                </div>
                <div>
                  <Label>{t("entries.travelHours")}</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.25"
                    value={travelHours}
                    onChange={(e) => setTravelHours(e.target.value)}
                  />
                </div>
                <div>
                  <Label>{t("entries.note")}</Label>
                  <Input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </div>
              </>
            ) : (
              <>
                {kind === "other" && (
                  <div>
                    <Label>{t("jobs.chargeTitle")}</Label>
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>
                      {kind === "car"
                        ? t("expenses.hours")
                        : t("expenses.quantity")}
                    </Label>
                    <Input
                      type="number"
                      min="0.25"
                      step="0.25"
                      required
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>
                      {kind === "car"
                        ? t("expenses.carRate")
                        : t("expenses.unitRate")}
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      required={kind === "other"}
                      placeholder={
                        kind === "other" ? undefined : String(defaultRate)
                      }
                      value={unitRate}
                      onChange={(e) => setUnitRate(e.target.value)}
                    />
                  </div>
                </div>
                <p className="text-sm font-semibold text-brand">
                  {t("expenses.total")}: {formatMoney(previewTotal, locale)}
                </p>
                <div>
                  <Label>{t("entries.note")}</Label>
                  <Input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </div>
              </>
            )}

            {error && (
              <p className="text-sm text-red-700">{t("common.error")}</p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setStep(2)}
              >
                {t("common.back")}
              </Button>
              <Button type="submit" disabled={saving} className="flex-1">
                {saving ? t("common.loading") : t("actuals.save")}
              </Button>
            </div>
          </Card>
        </form>
      )}

      {step === 4 && savedJobId && (
        <Card className="space-y-3">
          <p className="font-medium text-emerald-800">{t("actuals.saved")}</p>
          <Link
            to={`/jobs/${savedJobId}`}
            className="inline-flex text-sm font-semibold text-brand hover:underline"
          >
            {t("actuals.openJob")}
          </Link>
          <Button type="button" variant="secondary" onClick={resetWizard}>
            {t("actuals.addAnother")}
          </Button>
        </Card>
      )}
    </div>
  );
}
