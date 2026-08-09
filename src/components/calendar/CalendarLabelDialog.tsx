import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Id } from "../../../convex/_generated/dataModel";

export type LabelDoc = {
  _id: Id<"calendarLabels">;
  title: string;
  date: string;
  startTime?: string;
  endTime?: string;
  allDay: boolean;
  kind: "holiday" | "personal";
  notes?: string;
};

export function CalendarLabelDialog({
  open,
  onOpenChange,
  editing,
  initialDate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: LabelDoc | null;
  initialDate?: string;
}) {
  const { t } = useTranslation();
  const create = useMutation(api.calendarLabels.create);
  const update = useMutation(api.calendarLabels.update);
  const remove = useMutation(api.calendarLabels.remove);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [allDay, setAllDay] = useState(true);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const isHoliday = editing?.kind === "holiday";

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setTitle(editing.title);
      setDate(editing.date);
      setAllDay(editing.allDay);
      setStartTime(editing.startTime ?? "09:00");
      setEndTime(editing.endTime ?? "17:00");
      setNotes(editing.notes ?? "");
    } else {
      setTitle("");
      setDate(initialDate ?? new Date().toISOString().slice(0, 10));
      setAllDay(true);
      setStartTime("09:00");
      setEndTime("17:00");
      setNotes("");
    }
  }, [open, editing, initialDate]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (isHoliday) return;
    setSaving(true);
    try {
      if (editing) {
        await update({
          id: editing._id,
          title,
          date,
          allDay,
          startTime: allDay ? undefined : startTime,
          endTime: allDay ? undefined : endTime,
          notes: notes || undefined,
        });
      } else {
        await create({
          title,
          date,
          allDay,
          startTime: allDay ? undefined : startTime,
          endTime: allDay ? undefined : endTime,
          notes: notes || undefined,
        });
      }
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" showClose>
        <DialogHeader>
          <DialogTitle>
            {isHoliday
              ? t("calendar.holiday")
              : editing
                ? t("calendar.editEvent")
                : t("calendar.addEvent")}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={onSave} className="flex min-h-0 flex-1 flex-col">
          <DialogBody className="grid gap-3">
            <div>
              <Label>{t("calendar.eventTitle")}</Label>
              <Input
                required
                disabled={isHoliday}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div>
              <Label>{t("calendar.date")}</Label>
              <Input
                type="date"
                required
                disabled={isHoliday}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                disabled={isHoliday}
                checked={allDay}
                onChange={(e) => setAllDay(e.target.checked)}
              />
              {t("calendar.allDay")}
            </label>
            {!allDay && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>{t("calendar.start")}</Label>
                  <Input
                    type="time"
                    disabled={isHoliday}
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div>
                  <Label>{t("calendar.end")}</Label>
                  <Input
                    type="time"
                    disabled={isHoliday}
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
              </div>
            )}
            <div>
              <Label>{t("calendar.notes")}</Label>
              <Textarea
                disabled={isHoliday}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            {editing && !isHoliday && (
              <Button
                type="button"
                variant="ghost"
                className="me-auto"
                onClick={async () => {
                  await remove({ id: editing._id });
                  onOpenChange(false);
                }}
              >
                {t("common.delete")}
              </Button>
            )}
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
            >
              {t("common.cancel")}
            </Button>
            {!isHoliday && (
              <Button type="submit" disabled={saving}>
                {saving ? t("common.loading") : t("common.save")}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
