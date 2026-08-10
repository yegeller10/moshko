import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2 } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  QuickAddCityDialog,
  QuickAddClientDialog,
  QuickAddWorkerDialog,
} from "@/components/calendar/QuickAddModals";
import {
  assignmentSpan,
  computeJobQuoteFromAssignments,
  DEFAULT_BILLING_RULE,
  formatMoney,
} from "@/lib/costs";
import { cn } from "@/lib/utils";
import type { Id } from "../../../convex/_generated/dataModel";

export type JobFormMode = "quote" | "job";
export type ShiftType = "normal" | "saturday";
export type JobStatus = "booked" | "approved" | "done" | "cancelled";

export type AssignmentRow = {
  key: string;
  workerId: string;
  startTime: string;
  endTime: string;
  shiftType: ShiftType;
  travelHours: string;
};

export type DraftChargeRow = {
  key: string;
  title: string;
  amount: string;
  note: string;
  kind: "parking" | "other";
};

type FormState = {
  notes: string;
  date: string;
  clientId: string;
  cityId: string;
  includeCar: boolean;
  locationText: string;
  assignments: AssignmentRow[];
  draftCharges: DraftChargeRow[];
};

function newKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function defaultEnd(start: string) {
  const [h, m] = start.split(":").map(Number);
  const endMinutes = h * 60 + m + 8 * 60;
  const endH = Math.floor(endMinutes / 60) % 24;
  const endM = endMinutes % 60;
  return `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
}

function emptyAssignment(
  startTime?: string,
  travel = "0",
): AssignmentRow {
  const start = startTime ?? "08:00";
  return {
    key: newKey(),
    workerId: "",
    startTime: start,
    endTime: defaultEnd(start),
    shiftType: "normal",
    travelHours: travel,
  };
}

function emptyCharge(kind: "parking" | "other" = "parking"): DraftChargeRow {
  return {
    key: newKey(),
    title: kind === "parking" ? "parking" : "other",
    amount: "",
    note: "",
    kind,
  };
}

function defaultChargeTitle(kind: "parking" | "other") {
  return kind === "parking" ? "parking" : "other";
}

function resolveChargeTitle(title: string, kind: "parking" | "other") {
  const trimmed = title.trim();
  return trimmed || defaultChargeTitle(kind);
}

function emptyForm(date?: string): FormState {
  return {
    notes: "",
    date: date ?? new Date().toISOString().slice(0, 10),
    clientId: "",
    cityId: "",
    includeCar: false,
    locationText: "",
    assignments: [emptyAssignment()],
    draftCharges: [],
  };
}

function statusBadgeClass(status: JobStatus) {
  if (status === "approved") return "bg-emerald-100 text-emerald-800";
  if (status === "done") return "bg-zinc-200 text-zinc-700";
  if (status === "cancelled") return "bg-red-100 text-red-800";
  return "bg-amber-100 text-amber-900";
}

export function JobForm({
  mode,
  jobId,
  initialDate,
  onSaved,
}: {
  mode: JobFormMode;
  jobId?: Id<"calendarEvents">;
  initialDate?: string;
  onSaved?: (id: Id<"calendarEvents">) => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "he" ? "he-IL" : "en-IL";
  const [form, setForm] = useState(() => emptyForm(initialDate));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [hydratedId, setHydratedId] = useState<string | null>(null);
  const [quickWorker, setQuickWorker] = useState(false);
  const [quickClient, setQuickClient] = useState(false);
  const [quickCity, setQuickCity] = useState(false);

  const clients = useQuery(api.clients.list, {});
  const cities = useQuery(api.cities.list, {});
  const workers = useQuery(api.workers.list, {});
  const liveJob = useQuery(
    api.calendar.get,
    jobId ? { id: jobId } : "skip",
  );
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

  const status: JobStatus = liveJob?.status ?? "booked";
  const editing = Boolean(jobId);

  useEffect(() => {
    if (!jobId) {
      setForm(emptyForm(initialDate));
      setHydratedId(null);
      setError(null);
      return;
    }
    if (!liveJob || liveJob._id !== jobId) return;
    if (hydratedId === jobId) return;

    const assigns =
      liveJob.workerAssignments && liveJob.workerAssignments.length > 0
        ? liveJob.workerAssignments.map((a) => ({
            key: newKey(),
            workerId: a.workerId,
            startTime: a.startTime,
            endTime: a.endTime,
            shiftType: a.shiftType,
            travelHours: String(a.travelHours),
          }))
        : liveJob.workerIds.map((id) => ({
            key: newKey(),
            workerId: id,
            startTime: liveJob.startTime,
            endTime: liveJob.endTime,
            shiftType: liveJob.shiftType,
            travelHours: "0",
          }));

    setForm({
      notes: liveJob.notes ?? "",
      date: liveJob.date,
      clientId: liveJob.clientId,
      cityId: liveJob.cityId ?? "",
      includeCar: liveJob.includeCar,
      locationText: liveJob.locationText ?? "",
      assignments: assigns.length ? assigns : [emptyAssignment()],
      draftCharges: (liveJob.draftCharges ?? []).map((c) => ({
        key: newKey(),
        title: c.title,
        amount: String(c.amount),
        note: c.note ?? "",
        kind: c.kind,
      })),
    });
    setHydratedId(jobId);
    setError(null);
  }, [jobId, liveJob, hydratedId, initialDate]);

  useEffect(() => {
    if (!form.includeCar || !cityRates) return;
    const travel = String(cityRates.commuteRate * 2);
    setForm((f) => {
      let changed = false;
      const assignments = f.assignments.map((a) => {
        if (a.travelHours === "" || a.travelHours === "0") {
          changed = true;
          return { ...a, travelHours: travel };
        }
        return a;
      });
      return changed ? { ...f, assignments } : f;
    });
  }, [form.includeCar, cityRates]);

  const defaultTravel = useMemo(() => {
    if (!form.includeCar || !cityRates) return "0";
    return String(cityRates.commuteRate * 2);
  }, [form.includeCar, cityRates]);

  const previewQuote = useMemo(() => {
    const client = clients?.find((c) => c._id === form.clientId);
    const ready = form.assignments.filter((a) => a.workerId);
    if (!client || ready.length === 0) return null;
    if (form.includeCar && (!form.cityId || !cityRates)) return null;
    const rule = billingRule
      ? {
          minBillableHours: billingRule.minBillableHours,
          bands: billingRule.bands,
          saturdayMultiplier: billingRule.saturdayMultiplier,
        }
      : DEFAULT_BILLING_RULE;
    return computeJobQuoteFromAssignments({
      assignments: ready.map((a) => ({
        startTime: a.startTime,
        endTime: a.endTime,
        shiftType: a.shiftType,
      })),
      hourlyRate: client.hourlyRate ?? 100,
      rule,
      commuteRateOneWay: cityRates?.commuteRate ?? 0,
      includeCar: form.includeCar,
      carRate: cityRates?.carRate ?? 0,
    });
  }, [clients, form, billingRule, cityRates]);

  const draftChargesTotal = useMemo(() => {
    return form.draftCharges.reduce((sum, c) => {
      const amount = Number(c.amount) || 0;
      return sum + (amount > 0 ? amount : 0);
    }, 0);
  }, [form.draftCharges]);

  function updateAssignment(key: string, patch: Partial<AssignmentRow>) {
    setForm((f) => ({
      ...f,
      assignments: f.assignments.map((a) =>
        a.key === key ? { ...a, ...patch } : a,
      ),
    }));
  }

  function updateCharge(key: string, patch: Partial<DraftChargeRow>) {
    setForm((f) => ({
      ...f,
      draftCharges: f.draftCharges.map((c) => {
        if (c.key !== key) return c;
        const next = { ...c, ...patch };
        if (patch.kind && patch.kind !== c.kind) {
          const prevDefault = defaultChargeTitle(c.kind);
          if (!c.title.trim() || c.title.trim() === prevDefault) {
            next.title = defaultChargeTitle(patch.kind);
          }
        }
        return next;
      }),
    }));
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const client = clients?.find((c) => c._id === form.clientId);
    const ready = form.assignments.filter((a) => a.workerId);
    if (!form.clientId || !client || ready.length === 0) {
      setError("missing");
      return;
    }
    if (form.includeCar && !form.cityId) {
      setError("city");
      return;
    }
    setSaving(true);
    try {
      const workerAssignments = ready.map((a) => ({
        workerId: a.workerId as Id<"workers">,
        startTime: a.startTime,
        endTime: a.endTime,
        shiftType: a.shiftType,
        travelHours: Number(a.travelHours) || 0,
      }));
      const draftCharges = form.draftCharges
        .map((c) => ({
          title: resolveChargeTitle(c.title, c.kind),
          amount: Number(c.amount) || 0,
          note: c.note.trim() || undefined,
          kind: c.kind,
        }))
        .filter((c) => c.amount > 0);
      const title = `${client.name} · ${form.date}`;
      const payload = {
        title,
        notes: form.notes.trim() || undefined,
        date: form.date,
        clientId: form.clientId as Id<"clients">,
        cityId: form.includeCar
          ? (form.cityId as Id<"cities">)
          : undefined,
        workerAssignments,
        includeCar: form.includeCar,
        locationText: form.locationText.trim() || undefined,
        draftCharges,
      };
      if (jobId) {
        await update({
          id: jobId,
          ...payload,
          clearCity: !form.includeCar,
        });
        onSaved?.(jobId);
      } else {
        const id = await create({
          ...payload,
          status: mode === "job" ? "approved" : "booked",
        });
        onSaved?.(id);
      }
    } catch (err) {
      console.error(err);
      setError("save");
    } finally {
      setSaving(false);
    }
  }

  const span = assignmentSpan(
    form.assignments
      .filter((a) => a.workerId)
      .map((a) => ({ startTime: a.startTime, endTime: a.endTime })),
  );

  const linkedEntries = liveJob?.linkedEntries ?? [];
  const linkedExpenses = liveJob?.linkedExpenses ?? [];

  if (jobId && liveJob === undefined) {
    return <p className="text-sm text-muted">{t("common.loading")}</p>;
  }
  if (jobId && liveJob === null) {
    return <p className="text-sm text-red-700">{t("common.error")}</p>;
  }

  return (
    <>
      <form onSubmit={onSave} className="w-full max-w-3xl space-y-4 pb-10">
        {editing && (
          <Card className="space-y-3">
            <div
              className={cn(
                "inline-flex rounded-xl px-4 py-2 text-base font-bold",
                statusBadgeClass(status),
              )}
            >
              {t(`calendar.status.${status}`)}
            </div>
            <div className="flex flex-wrap gap-2">
              {status === "booked" && (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={saving}
                  onClick={async () => {
                    if (!jobId) return;
                    setSaving(true);
                    try {
                      await setStatus({ id: jobId, status: "approved" });
                      onSaved?.(jobId);
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  {t("calendar.approve")}
                </Button>
              )}
              {status === "approved" && (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={saving}
                  onClick={async () => {
                    if (!jobId) return;
                    if (!window.confirm(t("calendar.markDoneConfirm"))) return;
                    setSaving(true);
                    try {
                      await setStatus({ id: jobId, status: "done" });
                      onSaved?.(jobId);
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  {t("calendar.markDone")}
                </Button>
              )}
              {status === "done" && (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={saving}
                  onClick={async () => {
                    if (!jobId) return;
                    setSaving(true);
                    try {
                      await setStatus({ id: jobId, status: "approved" });
                      onSaved?.(jobId);
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  {t("calendar.reopen")}
                </Button>
              )}
              {status === "cancelled" && (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={saving}
                  onClick={async () => {
                    if (!jobId) return;
                    setSaving(true);
                    try {
                      await setStatus({ id: jobId, status: "booked" });
                      onSaved?.(jobId);
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  {t("calendar.undelete")}
                </Button>
              )}
              {status !== "cancelled" && (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={saving}
                  onClick={async () => {
                    if (!jobId) return;
                    setSaving(true);
                    try {
                      await remove({ id: jobId });
                      onSaved?.(jobId);
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  {t("calendar.cancelEvent")}
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-2 border-t border-border pt-3">
              <Button type="button" variant="secondary" disabled title={t("jobs.emailComingSoon")}>
                {t("jobs.sendQuoteEmail")}
              </Button>
              <Button type="button" variant="secondary" disabled title={t("jobs.emailComingSoon")}>
                {t("jobs.sendOrderConfirmation")}
              </Button>
            </div>
          </Card>
        )}

        <Card className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 grid gap-3 sm:grid-cols-[11rem_minmax(0,1fr)_auto] sm:items-end">
            <div>
              <Label>{t("calendar.date")}</Label>
              <Input
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>
            <div className="min-w-0">
              <Label>{t("entries.client")}</Label>
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
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-11 shrink-0"
              onClick={() => setQuickClient(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              {t("calendar.quickAdd")}
            </Button>
          </div>

          <div className="sm:col-span-2">
            <Label>{t("calendar.location")}</Label>
            <Input
              value={form.locationText}
              placeholder={t("calendar.locationPlaceholder")}
              onChange={(e) =>
                setForm({ ...form, locationText: e.target.value })
              }
            />
          </div>

          <div className="sm:col-span-2 space-y-3 rounded-xl border border-border p-3 sm:p-4">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border"
                checked={form.includeCar}
                onChange={(e) =>
                  setForm({ ...form, includeCar: e.target.checked })
                }
              />
              {t("calendar.includeCar")}
            </label>
            {form.includeCar && (
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <div className="min-w-0">
                  <Label>{t("calendar.city")}</Label>
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
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-11 shrink-0"
                  onClick={() => setQuickCity(true)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t("calendar.quickAdd")}
                </Button>
              </div>
            )}
          </div>

          <div className="sm:col-span-2 space-y-3 rounded-xl border border-border p-3 sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label className="mb-0 text-base">{t("calendar.workers")}</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setQuickWorker(true)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t("calendar.quickAdd")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      assignments: [
                        ...f.assignments,
                        emptyAssignment("08:00", defaultTravel),
                      ],
                    }))
                  }
                >
                  {t("calendar.addWorkerRow")}
                </Button>
              </div>
            </div>

            {form.assignments.map((row, index) => (
              <div
                key={row.key}
                className="space-y-3 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-muted">
                    {t("entries.worker")} {index + 1}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2 text-muted hover:text-red-700"
                    disabled={form.assignments.length <= 1}
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        assignments: f.assignments.filter(
                          (a) => a.key !== row.key,
                        ),
                      }))
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div>
                  <Label>{t("entries.worker")}</Label>
                  <Select
                    required
                    value={row.workerId}
                    onChange={(e) =>
                      updateAssignment(row.key, { workerId: e.target.value })
                    }
                  >
                    <option value="">—</option>
                    {(workers ?? []).map((w) => (
                      <option key={w._id} value={w._id}>
                        {w.displayName}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label>{t("calendar.start")}</Label>
                    <Input
                      type="time"
                      value={row.startTime}
                      onChange={(e) =>
                        updateAssignment(row.key, {
                          startTime: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>{t("calendar.end")}</Label>
                    <Input
                      type="time"
                      value={row.endTime}
                      onChange={(e) =>
                        updateAssignment(row.key, {
                          endTime: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>{t("entries.shiftType")}</Label>
                    <Select
                      value={row.shiftType}
                      onChange={(e) =>
                        updateAssignment(row.key, {
                          shiftType: e.target.value as ShiftType,
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
                    <Label>{t("entries.travelHours")}</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.25"
                      value={row.travelHours}
                      onChange={(e) =>
                        updateAssignment(row.key, {
                          travelHours: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            ))}

            <p className="text-xs text-muted">
              {t("calendar.spanHint")}: {span.startTime}–{span.endTime}
            </p>
          </div>

          <div className="sm:col-span-2 space-y-3 rounded-xl border border-border p-3 sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label className="mb-0 text-base">{t("jobs.otherCharges")}</Label>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    draftCharges: [...f.draftCharges, emptyCharge("parking")],
                  }))
                }
              >
                <Plus className="h-3.5 w-3.5" />
                {t("jobs.addCharge")}
              </Button>
            </div>
            {form.draftCharges.length === 0 ? (
              <p className="text-xs text-muted">{t("jobs.otherChargesHint")}</p>
            ) : (
              form.draftCharges.map((row) => (
                <div
                  key={row.key}
                  className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-3 sm:grid-cols-[minmax(0,1fr)_7rem_8rem_auto]"
                >
                  <div>
                    <Label>{t("jobs.chargeTitle")}</Label>
                    <Input
                      value={row.title}
                      onChange={(e) =>
                        updateCharge(row.key, { title: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label>{t("jobs.chargeAmount")}</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.amount}
                      onChange={(e) =>
                        updateCharge(row.key, { amount: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label>{t("jobs.chargeKind")}</Label>
                    <Select
                      value={row.kind}
                      onChange={(e) =>
                        updateCharge(row.key, {
                          kind: e.target.value as "parking" | "other",
                        })
                      }
                    >
                      <option value="parking">{t("expenses.parking")}</option>
                      <option value="other">{t("expenses.other")}</option>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-11 px-2 text-muted hover:text-red-700"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          draftCharges: f.draftCharges.filter(
                            (c) => c.key !== row.key,
                          ),
                        }))
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="sm:col-span-4">
                    <Label>{t("entries.note")}</Label>
                    <Input
                      value={row.note}
                      onChange={(e) =>
                        updateCharge(row.key, { note: e.target.value })
                      }
                    />
                  </div>
                </div>
              ))
            )}
          </div>

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
              {form.draftCharges
                .filter((c) => (Number(c.amount) || 0) > 0)
                .map((c) => (
                  <p key={c.key}>
                    {resolveChargeTitle(c.title, c.kind)}:{" "}
                    {formatMoney(Number(c.amount) || 0, locale)}
                  </p>
                ))}
              <p className="font-semibold text-brand">
                {t("calendar.grandTotal")}:{" "}
                {formatMoney(
                  previewQuote.grandTotal + draftChargesTotal,
                  locale,
                )}
              </p>
            </div>
          )}

          {editing &&
            (linkedEntries.length > 0 || linkedExpenses.length > 0) && (
              <div className="sm:col-span-2 space-y-2 rounded-xl border border-border p-3 text-sm">
                <p className="font-semibold">{t("calendar.linkedActuals")}</p>
                {linkedEntries.map((e) => (
                  <p key={e._id} className="text-muted">
                    {e.workerName}: {e.startTime}–{e.endTime} ({e.hours}h
                    {e.travelHours ? ` + ${e.travelHours} travel` : ""})
                  </p>
                ))}
                {linkedExpenses.map((e) => (
                  <p key={e._id} className="text-muted">
                    {t(`expenses.${e.type}`)}: {formatMoney(e.total, locale)}
                  </p>
                ))}
              </div>
            )}

          {error && (
            <p className="text-sm text-red-700 sm:col-span-2">
              {error === "city"
                ? t("calendar.cityRequired")
                : t("common.error")}
            </p>
          )}

          <div className="sm:col-span-2">
            <Button type="submit" className="w-full" size="lg" disabled={saving}>
              {saving ? t("common.loading") : t("common.save")}
            </Button>
          </div>
        </Card>
      </form>

      <QuickAddWorkerDialog
        open={quickWorker}
        onOpenChange={setQuickWorker}
        onCreated={(id) =>
          setForm((f) => {
            const empty = f.assignments.find((a) => !a.workerId);
            if (empty) {
              return {
                ...f,
                assignments: f.assignments.map((a) =>
                  a.key === empty.key ? { ...a, workerId: id } : a,
                ),
              };
            }
            return {
              ...f,
              assignments: [
                ...f.assignments,
                { ...emptyAssignment("08:00", defaultTravel), workerId: id },
              ],
            };
          })
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
        jobDate={form.date}
        onCreated={(id) =>
          setForm((f) => ({ ...f, cityId: id, includeCar: true }))
        }
      />
    </>
  );
}
