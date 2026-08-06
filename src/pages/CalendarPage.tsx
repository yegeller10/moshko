import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { CalendarDays, List, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney, computeJobQuote, DEFAULT_BILLING_RULE } from "@/lib/costs";
import { cn } from "@/lib/utils";
import type { Id } from "../../convex/_generated/dataModel";

function monthBounds(year: number, month: number) {
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const last = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  return { from, to, last };
}

function daysInMonthGrid(year: number, month: number) {
  const firstDow = new Date(year, month - 1, 1).getDay(); // 0 Sun
  // Israel week often starts Sunday — keep Sunday-first
  const { last } = monthBounds(year, month);
  const cells: Array<{ date: string | null; day: number | null }> = [];
  for (let i = 0; i < firstDow; i++) cells.push({ date: null, day: null });
  for (let d = 1; d <= last; d++) {
    const date = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ date, day: d });
  }
  while (cells.length % 7 !== 0) cells.push({ date: null, day: null });
  return cells;
}

type FormState = {
  title: string;
  notes: string;
  date: string;
  startTime: string;
  endTime: string;
  clientId: string;
  cityId: string;
  plannedWorkHours: string;
  shiftType: "normal" | "saturday";
  workerIds: string[];
  includeCar: boolean;
  locationText: string;
};

const emptyForm = (): FormState => ({
  title: "",
  notes: "",
  date: new Date().toISOString().slice(0, 10),
  startTime: "08:00",
  endTime: "16:00",
  clientId: "",
  cityId: "",
  plannedWorkHours: "8",
  shiftType: "normal",
  workerIds: [],
  includeCar: false,
  locationText: "",
});

export function CalendarPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "he" ? "he-IL" : "en-IL";
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [view, setView] = useState<"list" | "grid">("list");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [openForm, setOpenForm] = useState(false);
  const [editingId, setEditingId] = useState<Id<"calendarEvents"> | null>(
    null,
  );
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { from, to } = monthBounds(year, month);
  const events = useQuery(api.calendar.listInRange, { fromDate: from, toDate: to });
  const clients = useQuery(api.clients.list, {});
  const cities = useQuery(api.cities.list, {});
  const workers = useQuery(api.workers.list, {});
  const billingRule = useQuery(api.billing.forDate, { date: form.date });
  const cityRates = useQuery(
    api.cities.ratesForDate,
    form.cityId
      ? { cityId: form.cityId as Id<"cities">, date: form.date }
      : "skip",
  );
  const create = useMutation(api.calendar.create);
  const update = useMutation(api.calendar.update);
  const remove = useMutation(api.calendar.remove);

  const byDate = useMemo(() => {
    const map = new Map<string, NonNullable<typeof events>>();
    for (const e of events ?? []) {
      const list = map.get(e.date) ?? [];
      list.push(e);
      map.set(e.date, list);
    }
    return map;
  }, [events]);

  const previewQuote = useMemo(() => {
    const client = clients?.find((c) => c._id === form.clientId);
    if (!client || !form.cityId || !cityRates) return null;
    const rule = billingRule
      ? {
          minBillableHours: billingRule.minBillableHours,
          bands: billingRule.bands,
          saturdayMultiplier: billingRule.saturdayMultiplier,
        }
      : DEFAULT_BILLING_RULE;
    return computeJobQuote({
      workHours: Number(form.plannedWorkHours) || 0,
      workersCount: form.workerIds.length,
      shiftType: form.shiftType,
      hourlyRate: client.hourlyRate ?? 100,
      rule,
      commuteRateOneWay: cityRates.commuteRate,
      includeCar: form.includeCar,
      carRate: cityRates.carRate,
    });
  }, [
    clients,
    form,
    billingRule,
    cityRates,
  ]);

  const grid = daysInMonthGrid(year, month);

  function shiftMonth(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setMonth(m);
    setYear(y);
    setSelectedDate(null);
  }

  function openCreate(date?: string) {
    setEditingId(null);
    setForm({ ...emptyForm(), date: date ?? form.date });
    setOpenForm(true);
    setError(null);
  }

  function openEdit(e: NonNullable<typeof events>[number]) {
    setEditingId(e._id);
    setForm({
      title: e.title,
      notes: e.notes ?? "",
      date: e.date,
      startTime: e.startTime,
      endTime: e.endTime,
      clientId: e.clientId,
      cityId: e.cityId,
      plannedWorkHours: String(e.plannedWorkHours),
      shiftType: e.shiftType,
      workerIds: e.workerIds,
      includeCar: e.includeCar,
      locationText: e.locationText ?? "",
    });
    setOpenForm(true);
    setError(null);
  }

  async function onSave(ev: React.FormEvent) {
    ev.preventDefault();
    setError(null);
    if (!form.clientId || !form.cityId || form.workerIds.length === 0) {
      setError("missing");
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
        cityId: form.cityId as Id<"cities">,
        plannedWorkHours: Number(form.plannedWorkHours) || 0,
        shiftType: form.shiftType,
        workerIds: form.workerIds as Id<"workers">[],
        includeCar: form.includeCar,
        locationText: form.locationText.trim() || undefined,
      };
      if (editingId) {
        await update({ id: editingId, ...payload });
      } else {
        await create(payload);
      }
      setOpenForm(false);
      setEditingId(null);
      setForm(emptyForm());
    } catch (err) {
      console.error(err);
      setError("save");
    } finally {
      setSaving(false);
    }
  }

  function toggleWorker(id: string) {
    setForm((f) => ({
      ...f,
      workerIds: f.workerIds.includes(id)
        ? f.workerIds.filter((x) => x !== id)
        : [...f.workerIds, id],
    }));
  }

  const listDates = selectedDate
    ? [selectedDate]
    : [...(byDate.keys())].sort();

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="w-full space-y-4 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold md:text-2xl">{t("calendar.title")}</h2>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-border bg-white p-0.5">
            <Button
              type="button"
              size="sm"
              variant={view === "list" ? "default" : "ghost"}
              onClick={() => setView("list")}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant={view === "grid" ? "default" : "ghost"}
              onClick={() => setView("grid")}
            >
              <CalendarDays className="h-4 w-4" />
            </Button>
          </div>
          <Button size="sm" onClick={() => openCreate()}>
            <Plus className="h-4 w-4" />
            {t("calendar.add")}
          </Button>
        </div>
      </div>

      <Card className="flex items-center justify-between gap-2">
        <Button type="button" variant="secondary" size="icon" onClick={() => shiftMonth(-1)}>
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
        </Button>
        <p className="font-semibold capitalize">{monthLabel}</p>
        <Button type="button" variant="secondary" size="icon" onClick={() => shiftMonth(1)}>
          <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
        </Button>
      </Card>

      <p className="text-xs text-muted">{t("calendar.googleLater")}</p>

      {view === "grid" && (
        <div className="grid grid-cols-7 gap-1">
          {["א", "ב", "ג", "ד", "ה", "ו", "ש"].map((d) => (
            <div key={d} className="py-1 text-center text-[10px] font-medium text-muted">
              {d}
            </div>
          ))}
          {grid.map((cell, i) => {
            const count = cell.date ? (byDate.get(cell.date)?.length ?? 0) : 0;
            const selected = cell.date && cell.date === selectedDate;
            return (
              <button
                key={i}
                type="button"
                disabled={!cell.date}
                onClick={() => {
                  if (!cell.date) return;
                  setSelectedDate(cell.date);
                  setView("list");
                }}
                className={cn(
                  "min-h-14 rounded-xl border p-1 text-start transition-colors",
                  cell.date
                    ? "border-zinc-100 bg-white hover:border-brand/40"
                    : "border-transparent bg-transparent",
                  selected && "border-brand bg-brand-soft",
                )}
              >
                {cell.day != null && (
                  <>
                    <span className="text-xs font-semibold">{cell.day}</span>
                    {count > 0 && (
                      <span className="mt-1 block h-1.5 w-1.5 rounded-full bg-brand" />
                    )}
                    {count > 1 && (
                      <span className="text-[9px] text-muted">{count}</span>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </div>
      )}

      {view === "list" && (
        <div className="space-y-3">
          {selectedDate && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setSelectedDate(null)}
            >
              {t("calendar.showAllMonth")}
            </Button>
          )}
          {!listDates.length ? (
            <Card className="text-sm text-muted">{t("calendar.empty")}</Card>
          ) : (
            listDates.map((date) => (
              <div key={date} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-zinc-700">{date}</h3>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => openCreate(date)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <ul className="space-y-2">
                  {(byDate.get(date) ?? []).map((e) => (
                    <li key={e._id}>
                      <Card
                        className={cn(
                          "cursor-pointer space-y-1 transition-colors hover:border-brand/30",
                          e.shiftType === "saturday" && "border-amber-200",
                        )}
                        onClick={() => openEdit(e)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium">{e.title}</p>
                            <p className="text-xs text-muted">
                              {e.startTime}–{e.endTime} · {e.client?.name} ·{" "}
                              {e.city?.name}
                            </p>
                            <p className="text-xs text-brand">
                              {formatMoney(e.quote.grandTotal, locale)}
                            </p>
                          </div>
                          <span className="rounded-lg bg-zinc-100 px-2 py-0.5 text-[10px]">
                            {t(`calendar.status.${e.status}`)}
                          </span>
                        </div>
                      </Card>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      )}

      {openForm && (
        <Card className="space-y-3">
          <h3 className="font-semibold">
            {editingId ? t("calendar.edit") : t("calendar.add")}
          </h3>
          <form onSubmit={onSave} className="grid gap-3 sm:grid-cols-2">
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
                <option value="normal">{t("entries.shiftTypes.normal")}</option>
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
                onChange={(e) => setForm({ ...form, endTime: e.target.value })}
              />
            </div>
            <div>
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
            <div>
              <Label>{t("calendar.city")}</Label>
              <Select
                required
                value={form.cityId}
                onChange={(e) => setForm({ ...form, cityId: e.target.value })}
              >
                <option value="">—</option>
                {(cities ?? []).map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>{t("calendar.plannedHours")}</Label>
              <Input
                type="number"
                min="0.25"
                step="0.25"
                required
                value={form.plannedWorkHours}
                onChange={(e) =>
                  setForm({ ...form, plannedWorkHours: e.target.value })
                }
              />
            </div>
            <div>
              <Label>{t("calendar.location")}</Label>
              <Input
                value={form.locationText}
                onChange={(e) =>
                  setForm({ ...form, locationText: e.target.value })
                }
              />
            </div>
            <div className="sm:col-span-2">
              <Label>{t("calendar.workers")}</Label>
              <div className="mt-1 flex flex-wrap gap-2">
                {(workers ?? []).map((w) => {
                  const on = form.workerIds.includes(w._id);
                  return (
                    <button
                      key={w._id}
                      type="button"
                      onClick={() => toggleWorker(w._id)}
                      className={cn(
                        "rounded-xl border px-3 py-1.5 text-sm",
                        on
                          ? "border-brand bg-brand-soft text-brand-dark"
                          : "border-border bg-white text-zinc-700",
                      )}
                    >
                      {w.displayName}
                    </button>
                  );
                })}
              </div>
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
            <div className="sm:col-span-2">
              <Label>{t("calendar.notes")}</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>

            {previewQuote && (
              <Card className="sm:col-span-2 space-y-1 bg-zinc-50 text-sm">
                <p className="font-medium">{t("calendar.quotePreview")}</p>
                <p>
                  {t("calendar.labor")}:{" "}
                  {formatMoney(previewQuote.laborTotal, locale)}
                </p>
                <p>
                  {t("calendar.commute")}:{" "}
                  {formatMoney(previewQuote.commuteCost, locale)} (
                  {previewQuote.commuteHoursTotal}h)
                </p>
                <p>
                  {t("calendar.car")}:{" "}
                  {formatMoney(previewQuote.carCost, locale)}
                </p>
                <p className="font-semibold text-brand">
                  {t("calendar.grandTotal")}:{" "}
                  {formatMoney(previewQuote.grandTotal, locale)}
                </p>
              </Card>
            )}

            {error && (
              <p className="text-sm text-red-700 sm:col-span-2">
                {t("common.error")}
              </p>
            )}

            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <Button type="submit" disabled={saving}>
                {saving ? t("common.loading") : t("common.save")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setOpenForm(false);
                  setEditingId(null);
                }}
              >
                {t("common.cancel")}
              </Button>
              {editingId && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    void remove({ id: editingId });
                    setOpenForm(false);
                    setEditingId(null);
                  }}
                >
                  {t("calendar.cancelEvent")}
                </Button>
              )}
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
