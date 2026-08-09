import { useEffect, useMemo, useRef, useState } from "react";
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
import { JobEventDialog } from "@/components/calendar/JobEventDialog";
import { cn } from "@/lib/utils";
import type { Id } from "../../convex/_generated/dataModel";

import "temporal-polyfill/global";
import "@fullcalendar/react/skeleton.css";
import "@fullcalendar/react/themes/monarch/theme.css";
import "@fullcalendar/react/themes/monarch/palettes/blue.css";
import "@/styles/fullcalendar-moshko.css";

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

type CalView = "dayGridMonth" | "timeGridWeek" | "timeGridDay";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toISODate(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
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

export function CalendarPage() {
  const { t, i18n } = useTranslation();
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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CalEvent | null>(null);
  const [createDate, setCreateDate] = useState<string | undefined>();
  const [createStart, setCreateStart] = useState<string | undefined>();

  const events = useQuery(api.calendar.listInRange, {
    fromDate: range.from,
    toDate: range.to,
  });

  const fcEvents = useMemo(() => {
    return ((events ?? []) as CalEvent[]).map((e) => ({
      id: e._id,
      title: e.title,
      start: `${e.date}T${e.startTime}:00`,
      end: `${e.date}T${e.endTime}:00`,
      classNames: [
        e.shiftType === "saturday"
          ? "moshko-event-saturday"
          : "moshko-event-normal",
      ],
      extendedProps: { raw: e },
    }));
  }, [events]);

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

  function onDatesSet(arg: DatesSetInfo) {
    setTitle(arg.view.title);
    setActiveView(arg.view.type as CalView);
    const from = toISODate(arg.start);
    const end = new Date(arg.end);
    end.setDate(end.getDate() - 1);
    setRange({ from, to: toISODate(end) });
  }

  function onSelect(arg: DateSelectInfo) {
    // On mobile, creating is double-tap only (avoid accidental opens while scrolling).
    if (isMobile) {
      calendarRef.current?.getApi().unselect();
      return;
    }
    const date = toISODate(arg.start);
    const time =
      arg.view.type === "dayGridMonth"
        ? undefined
        : `${pad2(arg.start.getHours())}:${pad2(arg.start.getMinutes())}`;
    openCreate(date, time);
    calendarRef.current?.getApi().unselect();
  }

  function onEventClick(arg: EventClickInfo) {
    const raw = arg.event.extendedProps.raw as CalEvent | undefined;
    if (raw) openEdit(raw);
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
        openCreate(date, time);
      } else {
        lastTapRef.current = { key, at: now };
      }
      return;
    }

    openCreate(date, time);
  }

  function renderEventContent(arg: EventDisplayInfo) {
    const raw = arg.event.extendedProps.raw as CalEvent | undefined;
    const clientName = raw?.client?.name?.trim();
    return (
      <div className="moshko-event-content">
        {arg.timeText ? (
          <div className="moshko-event-time">{arg.timeText}</div>
        ) : null}
        <div className="moshko-event-title">{arg.event.title}</div>
        {clientName ? (
          <div className="moshko-event-client">{clientName}</div>
        ) : null}
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
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="h-9 w-9"
            onClick={() => calendarRef.current?.getApi().prev()}
            aria-label="prev"
          >
            {isHe ? "›" : "‹"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="h-9 w-9"
            onClick={() => calendarRef.current?.getApi().next()}
            aria-label="next"
          >
            {isHe ? "‹" : "›"}
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

        <Button size="sm" onClick={() => openCreate(toISODate(new Date()))}>
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">{t("calendar.add")}</span>
        </Button>
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
          locale={isHe ? heLocale : "en"}
          firstDay={0}
          nowIndicator
          editable={false}
          selectable={!isMobile}
          selectMirror={!isMobile}
          dayMaxEvents={4}
          weekends
          slotMinTime="00:00:00"
          slotMaxTime="24:00:00"
          scrollTime="07:00:00"
          scrollTimeReset={false}
          allDaySlot={false}
          events={fcEvents}
          datesSet={onDatesSet}
          select={onSelect}
          eventClick={onEventClick}
          dateClick={onDateClick}
          eventContent={renderEventContent}
          eventTimeFormat={{
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }}
          slotHeaderFormat={{
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }}
        />
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
