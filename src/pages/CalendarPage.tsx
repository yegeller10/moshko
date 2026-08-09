import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { JobEventDialog } from "@/components/calendar/JobEventDialog";
import { cn } from "@/lib/utils";
import type { Id } from "../../convex/_generated/dataModel";

type CalView = "month" | "week" | "day";

type CalEvent = {
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
  client?: { name?: string } | null;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toISODate(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseISODate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDays(iso: string, days: number) {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

function startOfWeekSunday(iso: string) {
  const d = parseISODate(iso);
  d.setDate(d.getDate() - d.getDay());
  return toISODate(d);
}

function monthGrid(year: number, month: number) {
  const first = new Date(year, month - 1, 1);
  const startPad = first.getDay();
  const lastDay = new Date(year, month, 0).getDate();
  const cells: Array<{ date: string | null; inMonth: boolean }> = [];
  for (let i = 0; i < startPad; i++) {
    const d = new Date(year, month - 1, -startPad + i + 1);
    cells.push({ date: toISODate(d), inMonth: false });
  }
  for (let day = 1; day <= lastDay; day++) {
    cells.push({
      date: `${year}-${pad2(month)}-${pad2(day)}`,
      inMonth: true,
    });
  }
  while (cells.length % 7 !== 0 || cells.length < 35) {
    const last = cells[cells.length - 1]?.date;
    cells.push({ date: last ? addDays(last, 1) : null, inMonth: false });
    if (cells.length >= 42) break;
  }
  return cells;
}

function minutesFromMidnight(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

const HOUR_START = 6;
const HOUR_END = 22;
const HOURS = Array.from(
  { length: HOUR_END - HOUR_START },
  (_, i) => HOUR_START + i,
);

export function CalendarPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "he" ? "he-IL" : "en-IL";
  const today = toISODate(new Date());
  const [cursor, setCursor] = useState(today);
  const [view, setView] = useState<CalView>("month");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CalEvent | null>(null);
  const [createDate, setCreateDate] = useState<string | undefined>(today);
  const [createStart, setCreateStart] = useState<string | undefined>();

  const cursorDate = parseISODate(cursor);
  const year = cursorDate.getFullYear();
  const month = cursorDate.getMonth() + 1;

  const range = useMemo(() => {
    if (view === "day") return { from: cursor, to: cursor };
    if (view === "week") {
      const from = startOfWeekSunday(cursor);
      return { from, to: addDays(from, 6) };
    }
    const from = `${year}-${pad2(month)}-01`;
    const last = new Date(year, month, 0).getDate();
    // include padded week days for month edges
    const gridStart = startOfWeekSunday(from);
    const gridEnd = addDays(startOfWeekSunday(`${year}-${pad2(month)}-${pad2(last)}`), 6);
    return { from: gridStart, to: gridEnd };
  }, [view, cursor, year, month]);

  const events = useQuery(api.calendar.listInRange, {
    fromDate: range.from,
    toDate: range.to,
  });

  const byDate = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const e of (events ?? []) as CalEvent[]) {
      const list = map.get(e.date) ?? [];
      list.push(e);
      map.set(e.date, list);
    }
    return map;
  }, [events]);

  const weekDays = useMemo(() => {
    const start = startOfWeekSunday(cursor);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [cursor]);

  const headerLabel = useMemo(() => {
    if (view === "day") {
      return parseISODate(cursor).toLocaleDateString(locale, {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    }
    if (view === "week") {
      const a = parseISODate(weekDays[0]).toLocaleDateString(locale, {
        day: "numeric",
        month: "short",
      });
      const b = parseISODate(weekDays[6]).toLocaleDateString(locale, {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
      return `${a} – ${b}`;
    }
    return parseISODate(`${year}-${pad2(month)}-01`).toLocaleDateString(
      locale,
      { month: "long", year: "numeric" },
    );
  }, [view, cursor, weekDays, locale, year, month]);

  function navigate(delta: number) {
    if (view === "day") setCursor(addDays(cursor, delta));
    else if (view === "week") setCursor(addDays(cursor, delta * 7));
    else {
      const d = new Date(year, month - 1 + delta, 1);
      setCursor(toISODate(d));
    }
  }

  function openCreate(date: string, time?: string) {
    setEditing(null);
    setCreateDate(date);
    setCreateStart(time);
    setDialogOpen(true);
  }

  function openEdit(e: CalEvent) {
    setEditing(e);
    setCreateDate(e.date);
    setCreateStart(undefined);
    setDialogOpen(true);
  }

  const weekdayLabels = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(2024, 0, i); // Sun-start week of Jan 2024
      return d.toLocaleDateString(locale, { weekday: "short" });
    });
  }, [locale]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      {/* Toolbar */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-2 md:px-4">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="h-9 w-9"
            onClick={() => navigate(-1)}
            aria-label="prev"
          >
            <ChevronRight className="h-4 w-4 rtl:hidden" />
            <ChevronLeft className="hidden h-4 w-4 rtl:block" />
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setCursor(today)}
          >
            {t("calendar.today")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="h-9 w-9"
            onClick={() => navigate(1)}
            aria-label="next"
          >
            <ChevronLeft className="h-4 w-4 rtl:hidden" />
            <ChevronRight className="hidden h-4 w-4 rtl:block" />
          </Button>
        </div>

        <h2 className="min-w-0 flex-1 truncate text-base font-semibold capitalize md:text-lg">
          {headerLabel}
        </h2>

        <div className="flex rounded-xl border border-border bg-zinc-50 p-0.5">
          {(["month", "week", "day"] as CalView[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={cn(
                "rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors md:px-3",
                view === v
                  ? "bg-white text-ink shadow-sm"
                  : "text-muted hover:text-ink",
              )}
            >
              {t(`calendar.views.${v}`)}
            </button>
          ))}
        </div>

        <Button
          size="sm"
          onClick={() => openCreate(view === "month" ? today : cursor)}
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">{t("calendar.add")}</span>
        </Button>
      </div>

      {/* Views */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {view === "month" && (
          <MonthView
            year={year}
            month={month}
            today={today}
            weekdayLabels={weekdayLabels}
            byDate={byDate}
            onCreate={openCreate}
            onEdit={openEdit}
          />
        )}
        {view === "week" && (
          <TimeGridView
            dates={weekDays}
            today={today}
            locale={locale}
            byDate={byDate}
            onCreate={openCreate}
            onEdit={openEdit}
            onSelectDay={(d) => {
              setCursor(d);
              setView("day");
            }}
          />
        )}
        {view === "day" && (
          <TimeGridView
            dates={[cursor]}
            today={today}
            locale={locale}
            byDate={byDate}
            onCreate={openCreate}
            onEdit={openEdit}
            single
          />
        )}
      </div>

      <JobEventDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        initialDate={createDate}
        initialStartTime={createStart}
      />
    </div>
  );
}

function MonthView({
  year,
  month,
  today,
  weekdayLabels,
  byDate,
  onCreate,
  onEdit,
}: {
  year: number;
  month: number;
  today: string;
  weekdayLabels: string[];
  byDate: Map<string, CalEvent[]>;
  onCreate: (date: string) => void;
  onEdit: (e: CalEvent) => void;
}) {
  const cells = monthGrid(year, month);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="grid shrink-0 grid-cols-7 border-b border-border bg-zinc-50">
        {weekdayLabels.map((label) => (
          <div
            key={label}
            className="px-1 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted"
          >
            {label}
          </div>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-7" style={{ gridTemplateRows: `repeat(${Math.ceil(cells.length / 7)}, minmax(0, 1fr))` }}>
        {cells.map((cell, i) => {
          if (!cell.date) return <div key={i} />;
          const dayEvents = byDate.get(cell.date) ?? [];
          const isToday = cell.date === today;
          return (
            <div
              key={cell.date + i}
              className={cn(
                "flex min-h-0 flex-col border-b border-e border-border p-1",
                !cell.inMonth && "bg-zinc-50/70",
              )}
            >
              <button
                type="button"
                onClick={() => onCreate(cell.date!)}
                className="mb-0.5 flex items-center justify-between gap-1 rounded-md px-0.5 hover:bg-zinc-100"
              >
                <span
                  className={cn(
                    "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                    isToday && "bg-brand text-white",
                    !cell.inMonth && !isToday && "text-zinc-400",
                  )}
                >
                  {Number(cell.date.slice(8))}
                </span>
              </button>
              <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto">
                {dayEvents.slice(0, 4).map((e) => (
                  <button
                    key={e._id}
                    type="button"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onEdit(e);
                    }}
                    className={cn(
                      "block w-full truncate rounded-md px-1.5 py-0.5 text-start text-[11px] font-medium leading-tight",
                      e.shiftType === "saturday"
                        ? "bg-amber-100 text-amber-950"
                        : "bg-brand-soft text-brand-dark",
                    )}
                    title={`${e.startTime} ${e.title}`}
                  >
                    <span className="opacity-70">{e.startTime}</span> {e.title}
                  </button>
                ))}
                {dayEvents.length > 4 && (
                  <p className="px-1 text-[10px] text-muted">
                    +{dayEvents.length - 4}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TimeGridView({
  dates,
  today,
  locale,
  byDate,
  onCreate,
  onEdit,
  onSelectDay,
  single,
}: {
  dates: string[];
  today: string;
  locale: string;
  byDate: Map<string, CalEvent[]>;
  onCreate: (date: string, time?: string) => void;
  onEdit: (e: CalEvent) => void;
  onSelectDay?: (date: string) => void;
  single?: boolean;
}) {
  const totalMinutes = (HOUR_END - HOUR_START) * 60;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div
        className="grid shrink-0 border-b border-border bg-zinc-50"
        style={{
          gridTemplateColumns: `3.5rem repeat(${dates.length}, minmax(0, 1fr))`,
        }}
      >
        <div />
        {dates.map((date) => {
          const d = parseISODate(date);
          const isToday = date === today;
          return (
            <button
              key={date}
              type="button"
              onClick={() => onSelectDay?.(date)}
              className="px-1 py-2 text-center"
            >
              <div className="text-[10px] font-semibold uppercase text-muted">
                {d.toLocaleDateString(locale, { weekday: "short" })}
              </div>
              <div
                className={cn(
                  "mx-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold",
                  isToday && "bg-brand text-white",
                )}
              >
                {d.getDate()}
              </div>
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div
          className="grid relative"
          style={{
            gridTemplateColumns: `3.5rem repeat(${dates.length}, minmax(0, 1fr))`,
            minHeight: `${(HOUR_END - HOUR_START) * 3.25}rem`,
          }}
        >
          {/* hour labels + lines */}
          <div className="relative border-e border-border">
            {HOURS.map((h) => (
              <div
                key={h}
                className="absolute end-1 -translate-y-1/2 text-[10px] text-muted"
                style={{
                  top: `${((h - HOUR_START) / (HOUR_END - HOUR_START)) * 100}%`,
                }}
              >
                {pad2(h)}:00
              </div>
            ))}
          </div>

          {dates.map((date) => {
            const dayEvents = byDate.get(date) ?? [];
            return (
              <div
                key={date}
                className={cn(
                  "relative border-e border-border",
                  single && "min-w-0",
                )}
                onDoubleClick={() => onCreate(date)}
              >
                {HOURS.map((h) => (
                  <button
                    key={h}
                    type="button"
                    className="absolute inset-x-0 border-t border-zinc-100 hover:bg-brand-soft/40"
                    style={{
                      top: `${((h - HOUR_START) / (HOUR_END - HOUR_START)) * 100}%`,
                      height: `${(1 / (HOUR_END - HOUR_START)) * 100}%`,
                    }}
                    onClick={() =>
                      onCreate(date, `${pad2(h)}:00`)
                    }
                    aria-label={`${date} ${h}:00`}
                  />
                ))}

                {dayEvents.map((e) => {
                  const start = Math.max(
                    minutesFromMidnight(e.startTime),
                    HOUR_START * 60,
                  );
                  const end = Math.min(
                    minutesFromMidnight(e.endTime),
                    HOUR_END * 60,
                  );
                  if (end <= start) return null;
                  const top =
                    ((start - HOUR_START * 60) / totalMinutes) * 100;
                  const height =
                    ((end - start) / totalMinutes) * 100;
                  return (
                    <button
                      key={e._id}
                      type="button"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onEdit(e);
                      }}
                      className={cn(
                        "absolute inset-x-1 z-10 overflow-hidden rounded-lg border px-1.5 py-1 text-start shadow-sm",
                        e.shiftType === "saturday"
                          ? "border-amber-200 bg-amber-50 text-amber-950"
                          : "border-brand/20 bg-brand-soft text-brand-dark",
                      )}
                      style={{
                        top: `${top}%`,
                        height: `max(${height}%, 1.5rem)`,
                      }}
                    >
                      <div className="truncate text-[11px] font-semibold">
                        {e.title}
                      </div>
                      <div className="truncate text-[10px] opacity-80">
                        {e.startTime}–{e.endTime}
                        {e.client?.name ? ` · ${e.client.name}` : ""}
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
