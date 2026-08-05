import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { Trash2 } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { formatMoney, computeExpenseTotal } from "@/lib/costs";
import type { Id } from "../../convex/_generated/dataModel";

type ExpenseType = "car" | "parking" | "other";

export function ExpensesPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "he" ? "he-IL" : "en-IL";
  const clients = useQuery(api.clients.list, {});
  const rates = useQuery(api.expenses.getServiceRates);
  const expenses = useQuery(api.expenses.list, { limit: 100 });
  const create = useMutation(api.expenses.create);
  const remove = useMutation(api.expenses.remove);

  const [type, setType] = useState<ExpenseType>("car");
  const [clientId, setClientId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [location, setLocation] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitRate, setUnitRate] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const defaultRate =
    type === "car"
      ? (rates?.carHourlyRate ?? 0)
      : type === "parking"
        ? (rates?.parkingRate ?? 0)
        : 0;

  const effectiveRate = unitRate === "" ? defaultRate : Number(unitRate);
  const qty = Number(quantity) || 0;
  const previewTotal = useMemo(
    () => computeExpenseTotal(qty, effectiveRate || 0),
    [qty, effectiveRate],
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId || qty <= 0) return;
    setSaving(true);
    try {
      await create({
        type,
        clientId: clientId as Id<"clients">,
        date,
        location: location || undefined,
        quantity: qty,
        unitRate: unitRate === "" ? undefined : Number(unitRate),
        note: note || undefined,
      });
      setQuantity(type === "car" ? "1" : "1");
      setUnitRate("");
      setNote("");
      setLocation("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full space-y-5">
      <div>
        <h2 className="text-xl font-bold md:text-2xl">{t("expenses.title")}</h2>
        <p className="text-sm text-muted">{t("expenses.hint")}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <form onSubmit={onSubmit} className="space-y-3">
            <div>
              <Label>{t("expenses.type")}</Label>
              <Select
                value={type}
                onChange={(e) => {
                  setType(e.target.value as ExpenseType);
                  setUnitRate("");
                  setQuantity("1");
                }}
              >
                <option value="car">{t("expenses.car")}</option>
                <option value="parking">{t("expenses.parking")}</option>
                <option value="other">{t("expenses.other")}</option>
              </Select>
            </div>
            <div>
              <Label>{t("entries.client")}</Label>
              <Select
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
            <div>
              <Label>{t("entries.date")}</Label>
              <Input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div>
              <Label>{t("entries.location")}</Label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>
                  {type === "car"
                    ? t("expenses.hours")
                    : t("expenses.quantity")}
                </Label>
                <Input
                  type="number"
                  min="0.25"
                  step="0.25"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
              <div>
                <Label>
                  {type === "car"
                    ? t("expenses.carRate")
                    : t("expenses.unitRate")}
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder={String(defaultRate)}
                  value={unitRate}
                  onChange={(e) => setUnitRate(e.target.value)}
                />
              </div>
            </div>
            <p className="text-sm font-semibold text-brand">
              {t("expenses.total")}: {formatMoney(previewTotal, locale)}
            </p>
            <div>
              <Label>{t("entries.note")}</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? t("common.loading") : t("expenses.save")}
            </Button>
          </form>
        </Card>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-zinc-700">
            {t("expenses.recent")}
          </h3>
          {!expenses?.length ? (
            <Card className="text-sm text-muted">{t("expenses.empty")}</Card>
          ) : (
            <ul className="space-y-2">
              {expenses.map((e) => (
                <li key={e._id}>
                  <Card className="flex items-start justify-between gap-2 py-3">
                    <div>
                      <p className="font-medium">
                        {e.type === "car"
                          ? t("expenses.car")
                          : e.type === "parking"
                            ? t("expenses.parking")
                            : t("expenses.other")}{" "}
                        · {e.client?.name}
                      </p>
                      <p className="text-xs text-muted">
                        {e.date}
                        {e.location ? ` · ${e.location}` : ""} · {e.quantity}
                        {e.type === "car" ? "h" : ""} × {e.unitRate}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-brand">
                        {formatMoney(e.total, locale)}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          void remove({ id: e._id as Id<"expenses"> })
                        }
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
