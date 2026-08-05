import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { Id } from "../../convex/_generated/dataModel";

export function ClientsPage() {
  const { t } = useTranslation();
  const clients = useQuery(api.clients.list, { includeInactive: true });
  const create = useMutation(api.clients.create);
  const update = useMutation(api.clients.update);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [rateMode, setRateMode] = useState<"hourly" | "daily">("hourly");
  const [hourlyRate, setHourlyRate] = useState("100");
  const [dailyRate, setDailyRate] = useState("");
  const [extraHourRate, setExtraHourRate] = useState("");
  const [carHourlyRate, setCarHourlyRate] = useState("");

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    await create({
      name: name.trim(),
      email: email.trim() || undefined,
      rateMode,
      hourlyRate: Number(hourlyRate) || 0,
      dailyRate: dailyRate ? Number(dailyRate) : undefined,
      extraHourRate: extraHourRate ? Number(extraHourRate) : undefined,
      carHourlyRate: carHourlyRate ? Number(carHourlyRate) : undefined,
    });
    setName("");
    setEmail("");
    setOpen(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">{t("clients.title")}</h2>
        <Button size="sm" onClick={() => setOpen((v) => !v)}>
          {t("clients.add")}
        </Button>
      </div>

      {open && (
        <Card>
          <form onSubmit={onAdd} className="space-y-3">
            <div>
              <Label>{t("clients.name")}</Label>
              <Input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <Label>{t("clients.email")}</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <Label>{t("clients.rateMode")}</Label>
              <Select
                value={rateMode}
                onChange={(e) =>
                  setRateMode(e.target.value as "hourly" | "daily")
                }
              >
                <option value="hourly">{t("clients.hourly")}</option>
                <option value="daily">{t("clients.daily")}</option>
              </Select>
            </div>
            <div>
              <Label>{t("clients.hourlyRate")}</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                required
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
              />
            </div>
            {rateMode === "daily" && (
              <div>
                <Label>{t("clients.dailyRate")}</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={dailyRate}
                  onChange={(e) => setDailyRate(e.target.value)}
                />
              </div>
            )}
            <div>
              <Label>{t("clients.extraHourRate")}</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={extraHourRate}
                onChange={(e) => setExtraHourRate(e.target.value)}
              />
            </div>
            <div>
              <Label>{t("clients.carHourlyRate")}</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={carHourlyRate}
                onChange={(e) => setCarHourlyRate(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full">
              {t("common.save")}
            </Button>
          </form>
        </Card>
      )}

      {!clients?.length ? (
        <Card className="text-sm text-slate-500">{t("clients.empty")}</Card>
      ) : (
        <ul className="space-y-2">
          {clients.map((c) => (
            <li key={c._id}>
              <Card className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-slate-500">
                    {c.rateMode === "hourly"
                      ? `${c.hourlyRate} ₪/h`
                      : `${c.dailyRate ?? "—"} ₪/day`}
                    {c.email ? ` · ${c.email}` : ""}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    void update({
                      id: c._id as Id<"clients">,
                      active: !c.active,
                    })
                  }
                >
                  {c.active ? "Off" : "On"}
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
