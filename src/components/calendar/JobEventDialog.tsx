import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  QuickAddCityDialog,
  QuickAddClientDialog,
  QuickAddLocationField,
  QuickAddWorkerDialog,
} from "@/components/calendar/QuickAddModals";
import {
  computeHours,
  computeJobQuote,
  DEFAULT_BILLING_RULE,
  formatMoney,
} from "@/lib/costs";
import { cn } from "@/lib/utils";
import type { Id } from "../../../convex/_generated/dataModel";

type JobFormState = {
  title: string;
  notes: string;
  date: string;
  startTime: string;
  endTime: string;
  clientId: string;
  cityId: string;
  shiftType: "normal" | "saturday";
  workerIds: string[];
  includeCar: boolean;
  locationText: string;
};

function emptyJobForm(
  date?: string,
  startTime?: string,
): JobFormState {
  const start = startTime ?? "08:00";
  const [h, m] = start.split(":").map(Number);
  const endMinutes = h * 60 + m + 8 * 60;
  const endH = Math.floor(endMinutes / 60) % 24;
  const endM = endMinutes % 60;
  const end = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
  return {
    title: "",
    notes: "",
    date: date ?? new Date().toISOString().slice(0, 10),
    startTime: start,
    endTime: end,
    clientId: "",
    cityId: "",
    shiftType: "normal",
    workerIds: [],
    includeCar: false,
    locationText: "",
  };
}

type EventDoc = {
  _id: Id<"calendarEvents">;
  title: string;
  notes?: string;
  date: string;
  startTime: string;
  endTime: string;
  clientId: Id<"clients">;
  cityId?: Id<"cities">;
  plannedWorkHours: number;
  shiftType: "normal" | "saturday";
  workerIds: Id<"workers">[];
  includeCar: boolean;
  locationText?: string;
  status?: "booked" | "approved" | "done" | "cancelled";
};

export function JobEventDialog({
  open,
  onOpenChange,
  editing,
  initialDate,
  initialStartTime,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: EventDoc | null;
  initialDate?: string;
  initialStartTime?: string;
  onSaved?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "he" ? "he-IL" : "en-IL";
  const [form, setForm] = useState(emptyJobForm(initialDate));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [quickWorker, setQuickWorker] = useState(false);
  const [quickClient, setQuickClient] = useState(false);
  const [quickCity, setQuickCity] = useState(false);

  const clients = useQuery(api.clients.list, {});
  const cities = useQuery(api.cities.list, {});
  const workers = useQuery(api.workers.list, {});
  const billingRule = useQuery(api.billing.forDate, { date: form.date });
  const cityRates = useQuery(
    api.cities.ratesForDate,
    form.includeCar && form.cityId
      ? { cityId: form.cityId as Id<"cities">, date: form.date }
      : "skip",
  );
  const create = useMutation(api.calendar.create);
  const update = useMutation(api.calendar.update);
  const remove = useMutation(api.calendar.remove);
  const setStatus = useMutation(api.calendar.setStatus);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        title: editing.title,
        notes: editing.notes ?? "",
        date: editing.date,
        startTime: editing.startTime,
        endTime: editing.endTime,
        clientId: editing.clientId,
        cityId: editing.cityId ?? "",
        shiftType: editing.shiftType,
        workerIds: editing.workerIds,
        includeCar: editing.includeCar,
        locationText: editing.locationText ?? "",
      });
    } else {
      setForm(emptyJobForm(initialDate, initialStartTime));
    }
    setError(null);
  }, [open, editing, initialDate, initialStartTime]);

  const plannedHours = useMemo(
    () => computeHours(form.startTime, form.endTime),
    [form.startTime, form.endTime],
  );

  const previewQuote = useMemo(() => {
    const client = clients?.find((c) => c._id === form.clientId);
    if (!client || form.workerIds.length === 0 || plannedHours <= 0) return null;
    if (form.includeCar && (!form.cityId || !cityRates)) return null;
    const rule = billingRule
      ? {
          minBillableHours: billingRule.minBillableHours,
          bands: billingRule.bands,
          saturdayMultiplier: billingRule.saturdayMultiplier,
        }
      : DEFAULT_BILLING_RULE;
    return computeJobQuote({
      workHours: plannedHours,
      workersCount: form.workerIds.length,
      shiftType: form.shiftType,
      hourlyRate: client.hourlyRate ?? 100,
      rule,
      commuteRateOneWay: cityRates?.commuteRate ?? 0,
      includeCar: form.includeCar,
      carRate: cityRates?.carRate ?? 0,
    });
  }, [
    clients,
    form,
    plannedHours,
    billingRule,
    cityRates,
  ]);

  function toggleWorker(id: string) {
    setForm((f) => ({
      ...f,
      workerIds: f.workerIds.includes(id)
        ? f.workerIds.filter((x) => x !== id)
        : [...f.workerIds, id],
    }));
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.clientId || form.workerIds.length === 0 || plannedHours <= 0) {
      setError("missing");
      return;
    }
    if (form.includeCar && !form.cityId) {
      setError("city");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        notes: form.notes.trim() || undefined,
        date: form.date,
        startTime: form.startTime,
        endTime: form.endTime,
        clientId: form.clientId as Id<"clients">,
        cityId: form.includeCar
          ? (form.cityId as Id<"cities">)
          : undefined,
        plannedWorkHours: plannedHours,
        shiftType: form.shiftType,
        workerIds: form.workerIds as Id<"workers">[],
        includeCar: form.includeCar,
        locationText: form.locationText.trim() || undefined,
      };
      if (editing) {
        await update({
          id: editing._id,
          ...payload,
          clearCity: !form.includeCar,
        });
      } else {
        await create(payload);
      }
      onOpenChange(false);
      onSaved?.();
    } catch (err) {
      console.error(err);
      setError("save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-xl" showClose>
          <DialogHeader>
            <DialogTitle>
              {editing ? t("calendar.edit") : t("calendar.add")}
            </DialogTitle>
            <DialogDescription>
              {editing?.status
                ? `${t("calendar.quoteHint")} · ${t(`calendar.status.${editing.status}`)}`
                : t("calendar.quoteHint")}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onSave} className="flex min-h-0 flex-1 flex-col">
            <DialogBody className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>{t("calendar.eventTitle")}</Label>
                <Input
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>
              <div>
                <Label>{t("calendar.date")}</Label>
                <Input
                  type="date"
                  required
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </div>
              <div>
                <Label>{t("entries.shiftType")}</Label>
                <Select
                  value={form.shiftType}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      shiftType: e.target.value as "normal" | "saturday",
                    })
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
                <Label>{t("calendar.start")}</Label>
                <Input
                  type="time"
                  required
                  value={form.startTime}
                  onChange={(e) =>
                    setForm({ ...form, startTime: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>{t("calendar.end")}</Label>
                <Input
                  type="time"
                  required
                  value={form.endTime}
                  onChange={(e) =>
                    setForm({ ...form, endTime: e.target.value })
                  }
                />
              </div>
              <div className="sm:col-span-2 rounded-xl bg-brand-soft px-3 py-2 text-sm text-brand-dark">
                {t("calendar.plannedHours")}:{" "}
                <strong>{plannedHours || "—"}</strong>
              </div>

              <div className="sm:col-span-2">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <Label>{t("entries.client")}</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setQuickClient(true)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {t("calendar.quickAdd")}
                  </Button>
                </div>
                <Select
                  required
                  value={form.clientId}
                  onChange={(e) =>
                    setForm({ ...form, clientId: e.target.value })
                  }
                >
                  <option value="">—</option>
                  {(clients ?? []).map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="sm:col-span-2">
                <QuickAddLocationField
                  value={form.locationText}
                  onChange={(locationText) =>
                    setForm({ ...form, locationText })
                  }
                />
              </div>

              <div className="sm:col-span-2">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <Label>{t("calendar.workers")}</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setQuickWorker(true)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {t("calendar.quickAdd")}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(workers ?? []).map((w) => {
                    const on = form.workerIds.includes(w._id);
                    return (
                      <button
                        key={w._id}
                        type="button"
                        onClick={() => toggleWorker(w._id)}
                        className={cn(
                          "rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
                          on
                            ? "border-brand bg-brand-soft text-brand-dark"
                            : "border-border bg-white text-zinc-700 hover:bg-zinc-50",
                        )}
                      >
                        {w.displayName}
                      </button>
                    );
                  })}
                  {!workers?.length && (
                    <p className="text-xs text-muted">{t("workers.empty")}</p>
                  )}
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.includeCar}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      includeCar: e.target.checked,
                      cityId: e.target.checked ? form.cityId : "",
                    })
                  }
                />
                {t("calendar.includeCar")}
              </label>

              {form.includeCar && (
                <div className="sm:col-span-2">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <Label>{t("calendar.city")}</Label>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setQuickCity(true)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {t("calendar.quickAdd")}
                    </Button>
                  </div>
                  <Select
                    required
                    value={form.cityId}
                    onChange={(e) =>
                      setForm({ ...form, cityId: e.target.value })
                    }
                  >
                    <option value="">—</option>
                    {(cities ?? []).map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </div>
              )}

              <div className="sm:col-span-2">
                <Label>{t("calendar.notes")}</Label>
                <Input
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>

              {previewQuote && (
                <div className="sm:col-span-2 space-y-1 rounded-xl border border-border bg-zinc-50 px-3 py-2 text-sm">
                  <p className="font-medium">{t("calendar.quotePreview")}</p>
                  <p>
                    {t("calendar.labor")}:{" "}
                    {formatMoney(previewQuote.laborTotal, locale)}
                  </p>
                  <p>
                    {t("calendar.commute")}:{" "}
                    {formatMoney(previewQuote.commuteCost, locale)}
                  </p>
                  <p>
                    {t("calendar.car")}:{" "}
                    {formatMoney(previewQuote.carCost, locale)}
                  </p>
                  <p className="font-semibold text-brand">
                    {t("calendar.grandTotal")}:{" "}
                    {formatMoney(previewQuote.grandTotal, locale)}
                  </p>
                </div>
              )}

              {error && (
                <p className="text-sm text-red-700 sm:col-span-2">
                  {error === "city"
                    ? t("calendar.cityRequired")
                    : t("common.error")}
                </p>
              )}
            </DialogBody>
            <DialogFooter>
              {editing && (
                <Button
                  type="button"
                  variant="ghost"
                  className="me-auto"
                  onClick={() => {
                    void remove({ id: editing._id });
                    onOpenChange(false);
                  }}
                >
                  {t("calendar.cancelEvent")}
                </Button>
              )}
              {editing?.status === "booked" && (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={saving}
                  onClick={async () => {
                    setSaving(true);
                    try {
                      await setStatus({
                        id: editing._id,
                        status: "approved",
                      });
                      onOpenChange(false);
                      onSaved?.();
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  {t("calendar.approve")}
                </Button>
              )}
              {editing?.status === "approved" && (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={saving}
                  onClick={async () => {
                    if (!window.confirm(t("calendar.markDoneConfirm"))) return;
                    setSaving(true);
                    try {
                      await setStatus({ id: editing._id, status: "done" });
                      onOpenChange(false);
                      onSaved?.();
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  {t("calendar.markDone")}
                </Button>
              )}
              <Button
                type="button"
                variant="secondary"
                onClick={() => onOpenChange(false)}
              >
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? t("common.loading") : t("common.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <QuickAddWorkerDialog
        open={quickWorker}
        onOpenChange={setQuickWorker}
        onCreated={(id) =>
          setForm((f) => ({ ...f, workerIds: [...f.workerIds, id] }))
        }
      />
      <QuickAddClientDialog
        open={quickClient}
        onOpenChange={setQuickClient}
        onCreated={(id) => setForm((f) => ({ ...f, clientId: id }))}
      />
      <QuickAddCityDialog
        open={quickCity}
        onOpenChange={setQuickCity}
        onCreated={(id) =>
          setForm((f) => ({ ...f, cityId: id, includeCar: true }))
        }
      />
    </>
  );
}
