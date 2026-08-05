import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { computeHours } from "@/lib/costs";
import type { Id } from "../../convex/_generated/dataModel";

export function NewEntryPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const workers = useQuery(api.workers.list, {});
  const clients = useQuery(api.clients.list, {});
  const create = useMutation(api.entries.create);

  const [workerId, setWorkerId] = useState("");
  const [clientId, setClientId] = useState("");
  const [location, setLocation] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("16:00");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hours = useMemo(
    () => computeHours(startTime, endTime),
    [startTime, endTime],
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!workerId || !clientId || !location.trim()) {
      setError("missing");
      return;
    }
    setSaving(true);
    try {
      await create({
        workerId: workerId as Id<"workers">,
        clientId: clientId as Id<"clients">,
        location: location.trim(),
        date,
        startTime,
        endTime,
        note: note || undefined,
      });
      navigate("/entries");
    } catch (err) {
      console.error(err);
      setError("save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="w-full max-w-2xl space-y-4 pb-8"
    >
      <h2 className="text-xl font-bold md:text-2xl">{t("entries.new")}</h2>

      <Card className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="worker">{t("entries.worker")}</Label>
            <Select
              id="worker"
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
          <div>
            <Label htmlFor="client">{t("entries.client")}</Label>
            <Select
              id="client"
              required
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            >
              <option value="">—</option>
              {(clients ?? []).map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div>
          <Label htmlFor="location">{t("entries.location")}</Label>
          <Input
            id="location"
            required
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="date">{t("entries.date")}</Label>
          <Input
            id="date"
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="start">{t("entries.start")}</Label>
            <Input
              id="start"
              type="time"
              required
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="end">{t("entries.end")}</Label>
            <Input
              id="end"
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
          <Label htmlFor="note">{t("entries.note")}</Label>
          <Textarea
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </Card>

      {error && <p className="text-sm text-red-700">{t("common.error")}</p>}

      <Button type="submit" className="w-full" size="lg" disabled={saving}>
        {saving ? t("common.loading") : t("entries.save")}
      </Button>
    </form>
  );
}
