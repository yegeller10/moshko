import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2 } from "lucide-react";
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
  assignmentSpan,
  computeJobQuoteFromAssignments,
  DEFAULT_BILLING_RULE,
  formatMoney,
} from "@/lib/costs";
import { cn } from "@/lib/utils";
import type { Id } from "../../../convex/_generated/dataModel";

type ShiftType = "normal" | "saturday";
type JobStatus = "booked" | "approved" | "done" | "cancelled";

type AssignmentRow = {
  key: string;
  workerId: string;
  startTime: string;
  endTime: string;
  shiftType: ShiftType;
  travelHours: string;
};

type JobFormState = {
  title: string;
  notes: string;
  date: string;
  clientId: string;
  cityId: string;
  includeCar: boolean;
  locationText: string;
  assignments: AssignmentRow[];
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

function emptyJobForm(date?: string, startTime?: string): JobFormState {
  return {
    title: "",
    notes: "",
    date: date ?? new Date().toISOString().slice(0, 10),
    clientId: "",
    cityId: "",
    includeCar: false,
    locationText: "",
    assignments: [emptyAssignment(startTime)],
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
  shiftType: ShiftType;
  workerIds: Id<"workers">[];
  workerAssignments?: Array<{
    workerId: Id<"workers">;
    startTime: string;
    endTime: string;
    shiftType: ShiftType;
    travelHours: number;
  }>;
  includeCar: boolean;
  locationText?: string;
  status?: JobStatus;
  linkedEntries?: Array<{
    _id: string;
    workerName?: string;
    startTime: string;
    endTime: string;
    hours: number;
    travelHours: number;
  }>;
  linkedExpenses?: Array<{
    _id: string;
    type: "car" | "parking" | "other";
    total: number;
    quantity: number;
  }>;
};

function statusBadgeClass(status: JobStatus) {
  if (status === "approved") return "bg-emerald-100 text-emerald-800";
  if (status === "done") return "bg-zinc-200 text-zinc-700";
  if (status === "cancelled") return "bg-red-100 text-red-800";
  return "bg-sky-100 text-sky-800";
}

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
  const liveJob = useQuery(
    api.calendar.get,
    editing?._id ? { id: editing._id } : "skip",
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

  const status: JobStatus =
    liveJob?.status ?? editing?.status ?? "booked";

  useEffect(() => {
    if (!open) return;
    const source = liveJob ?? editing;
    if (source) {
      const assigns =
        source.workerAssignments && source.workerAssignments.length > 0
          ? source.workerAssignments.map((a) => ({
              key: newKey(),
              workerId: a.workerId,
              startTime: a.startTime,
              endTime: a.endTime,
              shiftType: a.shiftType,
              travelHours: String(a.travelHours),
            }))
          : source.workerIds.map((id) => ({
              key: newKey(),
              workerId: id,
              startTime: source.startTime,
              endTime: source.endTime,
              shiftType: source.shiftType,
              travelHours: "0",
            }));
      setForm({
        title: source.title,
        notes: source.notes ?? "",
        date: source.date,
        clientId: source.clientId,
        cityId: source.cityId ?? "",
        includeCar: source.includeCar,
        locationText: source.locationText ?? "",
        assignments: assigns.length ? assigns : [emptyAssignment()],
      });
    } else {
      setForm(emptyJobForm(initialDate, initialStartTime));
    }
    setError(null);
    // Rehydrate only when the dialog opens or the job identity changes —
    // not on every liveJob poll while the user is editing.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- liveJob used for initial hydrate
  }, [open, editing?._id, initialDate, initialStartTime, liveJob?._id]);

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

  function updateAssignment(key: string, patch: Partial<AssignmentRow>) {
    setForm((f) => ({
      ...f,
      assignments: f.assignments.map((a) =>
        a.key === key ? { ...a, ...patch } : a,
      ),
    }));
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const ready = form.assignments.filter((a) => a.workerId);
    if (!form.clientId || ready.length === 0) {
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
      const payload = {
        title: form.title.trim(),
        notes: form.notes.trim() || undefined,
        date: form.date,
        clientId: form.clientId as Id<"clients">,
        cityId: form.includeCar
          ? (form.cityId as Id<"cities">)
          : undefined,
        workerAssignments,
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

  const span = assignmentSpan(
    form.assignments
      .filter((a) => a.workerId)
      .map((a) => ({ startTime: a.startTime, endTime: a.endTime })),
  );

  const linkedEntries = liveJob?.linkedEntries ?? editing?.linkedEntries ?? [];
  const linkedExpenses =
    liveJob?.linkedExpenses ?? editing?.linkedExpenses ?? [];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl" showClose>
          <DialogHeader>
            <DialogTitle>
              {editing ? t("calendar.edit") : t("calendar.add")}
            </DialogTitle>
            <DialogDescription>{t("calendar.quoteHint")}</DialogDescription>
            {editing && (
              <div
                className={cn(
                  "mt-2 inline-flex rounded-lg px-3 py-1.5 text-sm font-bold",
                  statusBadgeClass(status),
                )}
              >
                {t(`calendar.status.${status}`)}
              </div>
            )}
          </DialogHeader>
          <form onSubmit={onSave} className="flex min-h-0 flex-1 flex-col">
            <DialogBody className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>{t("calendar.eventTitle")}</Label>
                <Input
                  required
                  value={form.title}
                  onChange={(e) =>
                    setForm({ ...form, title: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>{t("calendar.date")}</Label>
                <Input
                  type="date"
                  required
                  value={form.date}
                  onChange={(e) =>
                    setForm({ ...form, date: e.target.value })
                  }
                />
              </div>
              <div>
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

              <div className="sm:col-span-2 space-y-2 rounded-xl border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-base">{t("calendar.workers")}</Label>
                  <div className="flex gap-1">
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
                {form.assignments.map((row) => (
                  <div
                    key={row.key}
                    className="grid gap-2 rounded-lg bg-zinc-50 p-2 sm:grid-cols-6"
                  >
                    <div className="sm:col-span-2">
                      <Label className="text-xs">{t("entries.worker")}</Label>
                      <Select
                        required
                        value={row.workerId}
                        onChange={(e) =>
                          updateAssignment(row.key, {
                            workerId: e.target.value,
                          })
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
                    <div>
                      <Label className="text-xs">{t("calendar.start")}</Label>
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
                      <Label className="text-xs">{t("calendar.end")}</Label>
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
                      <Label className="text-xs">
                        {t("entries.shiftType")}
                      </Label>
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
                    <div className="flex items-end gap-1">
                      <div className="min-w-0 flex-1">
                        <Label className="text-xs">
                          {t("entries.travelHours")}
                        </Label>
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
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="shrink-0"
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
                  </div>
                ))}
                <p className="text-xs text-muted">
                  {t("calendar.spanHint")}: {span.startTime}–{span.endTime}
                </p>
              </div>

              <div className="sm:col-span-2">
                <QuickAddLocationField
                  value={form.locationText}
                  onChange={(v) => setForm({ ...form, locationText: v })}
                />
              </div>

              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.includeCar}
                  onChange={(e) =>
                    setForm({ ...form, includeCar: e.target.checked })
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
                  onChange={(e) =>
                    setForm({ ...form, notes: e.target.value })
                  }
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

              {editing && (linkedEntries.length > 0 || linkedExpenses.length > 0) && (
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
                      {t(`expenses.${e.type}`)}:{" "}
                      {formatMoney(e.total, locale)}
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
              {editing && status === "booked" && (
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
              {editing && status === "approved" && (
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
