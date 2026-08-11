import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import FullCalendar from "@fullcalendar/react";
import type { CalendarRef } from "@fullcalendar/react";
import themePlugin from "@fullcalendar/react/themes/monarch";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import timeGridPlugin from "@fullcalendar/react/timegrid";
import interactionPlugin from "@fullcalendar/react/interaction";
import heLocale from "@fullcalendar/react/locales/he";
import type {
  DateClickInfo,
  DateSelectInfo,
  DatesSetInfo,
  EventClickInfo,
  EventDisplayInfo,
} from "@fullcalendar/react";
import { Plus } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  CalendarLabelDialog,
  type LabelDoc,
} from "@/components/calendar/CalendarLabelDialog";
import { cn } from "@/lib/utils";
import type { Id } from "../../convex/_generated/dataModel";

import "temporal-polyfill/global";
import "@fullcalendar/react/skeleton.css";
import "@fullcalendar/react/themes/monarch/theme.css";
import "@fullcalendar/react/themes/monarch/palettes/blue.css";
import "@/styles/fullcalendar-moshko.css";

type JobStatus = "booked" | "approved" | "done" | "cancelled";

type CalEvent = {
  _id: Id<"calendarEvents">;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  workerIds: Id<"workers">[];
  status: JobStatus;
  client?: { name?: string } | null;
};

type CalView = "dayGridMonth" | "timeGridWeek" | "timeGridDay";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toISODate(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function truncate(s: string, n: number) {
  const t = s.trim();
  if (t.length <= n) return t;
  return `${t.slice(0, n)}…`;
}

function useIsMobileCalendar() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(max-width: 767px), (pointer: coarse)").matches
      : false,
  );

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px), (pointer: coarse)");
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}

function jobClassName(status: JobStatus) {
  return `moshko-event-job moshko-status-${status}`;
}

function statusDotClass(status: JobStatus) {
  return `moshko-status-dot moshko-status-dot--${status}`;
}

function jobColors(status: JobStatus): { color: string; contrast: string } {
  if (status === "approved") return { color: "#86efac", contrast: "#14532d" };
  if (status === "done") return { color: "#d4d4d8", contrast: "#3f3f46" };
  if (status === "cancelled") return { color: "#fecaca", contrast: "#991b1b" };
  return { color: "#fde047", contrast: "#713f12" };
}

export function CalendarPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isMobile = useIsMobileCalendar();
  const calendarRef = useRef<CalendarRef>(null);
  const lastTapRef = useRef<{ key: string; at: number } | null>(null);
  const [range, setRange] = useState(() => {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { from: toISODate(from), to: toISODate(to) };
  });
  const [title, setTitle] = useState("");
  const [activeView, setActiveView] = useState<CalView>("dayGridMonth");
  const [labelOpen, setLabelOpen] = useState(false);
  const [editingLabel, setEditingLabel] = useState<LabelDoc | null>(null);
  const [labelDate, setLabelDate] = useState<string | undefined>();

  const events = useQuery(api.calendar.listInRange, {
    fromDate: range.from,
    toDate: range.to,
  });
  const labels = useQuery(api.calendarLabels.listInRange, {
    fromDate: range.from,
    toDate: range.to,
  });

  const fcEvents = useMemo(() => {
    const jobs = ((events ?? []) as CalEvent[]).map((e) => {
      const colors = jobColors(e.status);
      return {
        id: e._id,
        title: e.title,
        start: `${e.date}T${e.startTime}:00`,
        end: `${e.date}T${e.endTime}:00`,
        className: jobClassName(e.status),
        display: "block" as const,
        color: colors.color,
        contrastColor: colors.contrast,
        extendedProps: { kind: "job" as const, raw: e },
      };
    });

    const marks = (labels ?? []).map((l) => {
      const isHoliday = l.kind === "holiday";
      const base = {
        id: `label-${l._id}`,
        title: l.title,
        className: isHoliday
          ? "moshko-label-holiday"
          : "moshko-label-personal",
        color: isHoliday ? "#0b6fc2" : "#7c3aed",
        contrastColor: "#ffffff",
        display: "block" as const,
        extendedProps: { kind: "label" as const, raw: l },
      };
      if (l.allDay || !l.startTime || !l.endTime) {
        return { ...base, start: l.date, allDay: true };
      }
      return {
        ...base,
        start: `${l.date}T${l.startTime}:00`,
        end: `${l.date}T${l.endTime}:00`,
        allDay: false,
      };
    });

    return [...marks, ...jobs];
  }, [events, labels]);

  const jobCountByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of events ?? []) {
      map.set(e.date, (map.get(e.date) ?? 0) + 1);
    }
    return map;
  }, [events]);

  function openCreate(date: string) {
    navigate(`/jobs/new?date=${encodeURIComponent(date)}`);
  }

  function onDatesSet(arg: DatesSetInfo) {
    setTitle(arg.view.title);
    setActiveView(arg.view.type as CalView);
    const from = toISODate(arg.start);
    const end = new Date(arg.end);
    end.setDate(end.getDate() - 1);
    setRange({ from, to: toISODate(end) });
  }

  function onSelect(arg: DateSelectInfo) {
    if (isMobile) {
      calendarRef.current?.getApi().unselect();
      return;
    }
    openCreate(toISODate(arg.start));
    calendarRef.current?.getApi().unselect();
  }

  function onEventClick(arg: EventClickInfo) {
    const kind = arg.event.extendedProps.kind as "job" | "label";
    if (kind === "label") {
      setEditingLabel(arg.event.extendedProps.raw as LabelDoc);
      setLabelDate(undefined);
      setLabelOpen(true);
      return;
    }
    const raw = arg.event.extendedProps.raw as CalEvent | undefined;
    if (raw) navigate(`/jobs/${raw._id}`);
  }

  function onDateClick(arg: DateClickInfo) {
    const date = arg.dateStr.slice(0, 10);
    const time =
      arg.view.type === "dayGridMonth"
        ? undefined
        : `${pad2(arg.date.getHours())}:${pad2(arg.date.getMinutes())}`;
    const key = `${date}|${time ?? "allday"}|${arg.view.type}`;

    if (isMobile) {
      const now = Date.now();
      const prev = lastTapRef.current;
      if (prev && prev.key === key && now - prev.at < 400) {
        lastTapRef.current = null;
        openCreate(date);
      } else {
        lastTapRef.current = { key, at: now };
      }
      return;
    }

    openCreate(date);
  }

  function renderEventContent(arg: EventDisplayInfo) {
    const kind = arg.event.extendedProps.kind as "job" | "label" | undefined;
    if (kind === "label") {
      return (
        <div className="moshko-event-content moshko-label-content">
          <div className="moshko-event-title">{arg.event.title}</div>
        </div>
      );
    }
    const raw = arg.event.extendedProps.raw as CalEvent | undefined;
    const status = raw?.status ?? "booked";
    const fullClient = raw?.client?.name?.trim() ?? raw?.title ?? "";
    const workerCount = raw?.workerIds?.length ?? 0;
    const dateKey = raw?.date ?? arg.event.startStr.slice(0, 10);
    const dayCount = jobCountByDate.get(dateKey) ?? 0;
    const condense = isMobile && dayCount > 3;
    const slideText = `${fullClient || "—"} ×${workerCount}`;
    const shortText = truncate(slideText, 12);

    return (
      <div
        className={cn(
          "moshko-event-content moshko-event-pill",
          condense && "moshko-event-pill--condensed",
        )}
      >
        <span className={statusDotClass(status)} aria-hidden />
        <span className="moshko-event-marquee">
          <span className="moshko-event-marquee-track">
            <span className="moshko-event-marquee-text">
              {condense ? shortText : slideText}
            </span>
            {!condense && (
              <span className="moshko-event-marquee-text" aria-hidden>
                {slideText}
              </span>
            )}
          </span>
        </span>
      </div>
    );
  }

  function changeView(viewName: CalView) {
    calendarRef.current?.getApi().changeView(viewName);
    setActiveView(viewName);
  }

  const isHe = i18n.language === "he";

  return (
    <div className="moshko-calendar flex h-full min-h-0 flex-col bg-white">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-2 md:px-4">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => calendarRef.current?.getApi().today()}
          >
            {t("calendar.today")}
          </Button>
          {/* In RTL, visual “previous” should still call api.prev(); show ‹ on the start side */}
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="h-9 w-9"
            onClick={() => calendarRef.current?.getApi().prev()}
            aria-label="prev"
          >
            ‹
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="h-9 w-9"
            onClick={() => calendarRef.current?.getApi().next()}
            aria-label="next"
          >
            ›
          </Button>
        </div>

        <h2 className="min-w-0 flex-1 truncate text-base font-semibold capitalize md:text-lg">
          {title || t("calendar.title")}
        </h2>

        <div className="flex rounded-xl border border-border bg-zinc-50 p-0.5">
          {(
            [
              ["dayGridMonth", "month"],
              ["timeGridWeek", "week"],
              ["timeGridDay", "day"],
            ] as const
          ).map(([viewName, key]) => (
            <button
              key={viewName}
              type="button"
              onClick={() => changeView(viewName)}
              className={cn(
                "rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors md:px-3",
                activeView === viewName
                  ? "bg-white text-ink shadow-sm"
                  : "text-muted hover:bg-white/70 hover:text-ink",
              )}
            >
              {t(`calendar.views.${key}`)}
            </button>
          ))}
        </div>

        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            setEditingLabel(null);
            setLabelDate(toISODate(new Date()));
            setLabelOpen(true);
          }}
        >
          {t("calendar.addEvent")}
        </Button>
        <Button
          size="sm"
          onClick={() =>
            navigate(`/jobs/new?date=${toISODate(new Date())}`)
          }
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">{t("jobs.newJob")}</span>
        </Button>
      </div>

      <div className="flex shrink-0 flex-wrap gap-3 border-b border-border px-3 py-1.5 text-[11px] text-muted md:px-4">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-3.5 rounded-sm bg-amber-300 ring-1 ring-amber-500/50" />
          {t("calendar.status.booked")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-3.5 rounded-sm bg-emerald-300 ring-1 ring-emerald-600/40" />
          {t("calendar.status.approved")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-3.5 rounded-sm bg-zinc-300 ring-1 ring-zinc-500/40" />
          {t("calendar.status.done")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-3.5 rounded-sm bg-rose-100 ring-1 ring-rose-300/60" />
          {t("calendar.sundayLegend")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-3.5 rounded-sm bg-sky-600 ring-1 ring-sky-800/40" />
          {t("calendar.holiday")}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden p-2 md:p-3">
        <FullCalendar
          ref={calendarRef}
          plugins={[
            themePlugin,
            dayGridPlugin,
            timeGridPlugin,
            interactionPlugin,
          ]}
          initialView="dayGridMonth"
          headerToolbar={false}
          height="100%"
          direction={isHe ? "rtl" : "ltr"}
          locale={isHe ? heLocale : undefined}
          events={fcEvents}
          selectable={!isMobile}
          selectMirror
          dateClick={onDateClick}
          select={onSelect}
          eventClick={onEventClick}
          datesSet={onDatesSet}
          eventContent={renderEventContent}
          dayMaxEvents={false}
          nowIndicator
          slotMinTime="00:00:00"
          slotMaxTime="24:00:00"
          firstDay={0}
          dayCellClass={(arg) =>
            arg.date.getDay() === 0 ? "moshko-sunday" : undefined
          }
        />
      </div>

      <CalendarLabelDialog
        open={labelOpen}
        onOpenChange={setLabelOpen}
        editing={editingLabel}
        initialDate={labelDate}
      />
    </div>
  );
}
