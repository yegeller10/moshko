import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/costs";

export function ClientActionPage({ token }: { token: string }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "he" ? "he-IL" : "en-IL";
  const [searchParams] = useSearchParams();
  const preset = searchParams.get("action");
  const data = useQuery(api.emailLinks.getByToken, { token });
  const respond = useMutation(api.emailLinks.respond);

  const [mode, setMode] = useState<"view" | "dispute" | "done">(
    preset === "dispute" ? "dispute" : "view",
  );
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneDecision, setDoneDecision] = useState<
    "accepted" | "disputed" | null
  >(null);

  const title = useMemo(() => {
    if (!data) return t("clientLink.title");
    if (data.kind === "offer") return t("clientLink.offerTitle");
    return data.kind === "quote"
      ? t("clientLink.quoteTitle")
      : t("clientLink.orderTitle");
  }, [data, t]);

  async function onAccept() {
    setSaving(true);
    setError(null);
    try {
      await respond({ token, decision: "accepted" });
      setDoneDecision("accepted");
      setMode("done");
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setSaving(false);
    }
  }

  async function onDispute(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await respond({
        token,
        decision: "disputed",
        note: note.trim() || undefined,
      });
      setDoneDecision("disputed");
      setMode("done");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setSaving(false);
    }
  }

  if (data === undefined) {
    return (
      <Shell>
        <p className="text-sm text-muted">{t("common.loading")}</p>
      </Shell>
    );
  }

  if (data === null) {
    return (
      <Shell>
        <Card className="space-y-2 p-6 text-center">
          <h1 className="text-xl font-bold">{t("appName")}</h1>
          <p className="text-sm text-red-700">{t("clientLink.invalid")}</p>
        </Card>
      </Shell>
    );
  }

  const decisionNote =
    data.offer?.clientDecisionNote ?? data.job?.clientDecisionNote;

  if (mode === "done" || !data.open) {
    const decision =
      doneDecision ??
      (data.status === "accepted"
        ? "accepted"
        : data.status === "disputed"
          ? "disputed"
          : null);
    return (
      <Shell>
        <Card className="space-y-3 p-6 text-center">
          <h1 className="text-xl font-bold text-brand">{t("appName")}</h1>
          <p className="text-lg font-semibold">
            {decision === "accepted"
              ? t("clientLink.thanksAccepted")
              : decision === "disputed"
                ? t("clientLink.thanksDisputed")
                : data.status === "expired"
                  ? t("clientLink.expired")
                  : t("clientLink.alreadyUsed")}
          </p>
          {decisionNote && (
            <p className="text-sm text-muted">{decisionNote}</p>
          )}
        </Card>
      </Shell>
    );
  }

  if (data.kind === "offer" && data.offer) {
    const offer = data.offer;
    return (
      <Shell>
        <Card className="w-full max-w-lg space-y-4 p-5">
          <div>
            <p className="text-sm font-semibold text-brand">{t("appName")}</p>
            <h1 className="text-xl font-bold">{title}</h1>
            <p className="text-sm text-muted">{offer.clientName}</p>
            <p className="text-sm font-medium">
              {t("offers.offerNumber", { n: offer.number })}
            </p>
          </div>

          <p className="text-sm">{offer.title}</p>
          {offer.dates.length > 0 && (
            <p className="text-sm text-muted">{offer.dates.join(", ")}</p>
          )}

          <ul className="space-y-2 text-sm">
            {offer.lineItems.map((l, i) => (
              <li key={i} className="rounded-xl border border-border px-3 py-2">
                <p>
                  {l.quantity} × {l.description}
                </p>
                <p className="text-muted">{formatMoney(l.total, locale)}</p>
              </li>
            ))}
          </ul>

          <div className="space-y-1 rounded-xl border border-border bg-zinc-50 px-3 py-2 text-sm">
            <p>
              {t("offers.subtotal")}: {formatMoney(offer.subtotal, locale)}
            </p>
            <p>
              {t("offers.vat", { pct: Math.round(offer.vatRate * 100) })}:{" "}
              {formatMoney(offer.vatAmount, locale)}
            </p>
            <p className="font-semibold text-brand">
              {t("offers.grandTotal")}: {formatMoney(offer.grandTotal, locale)}
            </p>
          </div>

          {error && <p className="text-sm text-red-700">{error}</p>}

          {mode === "view" && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                className="flex-1"
                disabled={saving}
                onClick={() => void onAccept()}
              >
                {t("clientLink.accept")}
              </Button>
              <Button
                className="flex-1"
                variant="secondary"
                disabled={saving}
                onClick={() => setMode("dispute")}
              >
                {t("clientLink.dispute")}
              </Button>
            </div>
          )}

          {mode === "dispute" && (
            <form onSubmit={onDispute} className="space-y-3">
              <div>
                <Label>{t("clientLink.disputeNote")}</Label>
                <Input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t("clientLink.disputePlaceholder")}
                />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setMode("view")}
                >
                  {t("common.back")}
                </Button>
                <Button type="submit" disabled={saving} className="flex-1">
                  {saving ? t("common.loading") : t("clientLink.submitDispute")}
                </Button>
              </div>
            </form>
          )}
        </Card>
      </Shell>
    );
  }

  const job = data.job;
  if (!job) {
    return (
      <Shell>
        <Card className="space-y-2 p-6 text-center">
          <h1 className="text-xl font-bold">{t("appName")}</h1>
          <p className="text-sm text-red-700">{t("clientLink.invalid")}</p>
        </Card>
      </Shell>
    );
  }

  return (
    <Shell>
      <Card className="w-full max-w-lg space-y-4 p-5">
        <div>
          <p className="text-sm font-semibold text-brand">{t("appName")}</p>
          <h1 className="text-xl font-bold">{title}</h1>
          <p className="text-sm text-muted">{job.clientName}</p>
        </div>

        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <p>
            <span className="text-muted">{t("calendar.date")}: </span>
            {job.date}
          </p>
          <p>
            <span className="text-muted">{t("calendar.time")}: </span>
            {job.startTime}–{job.endTime}
          </p>
          <p className="sm:col-span-2">
            <span className="text-muted">{t("entries.location")}: </span>
            {job.locationText || "—"}
          </p>
        </div>

        <div className="space-y-1 text-sm">
          <p className="font-semibold">{t("quotes.workers")}</p>
          {job.workers.map((w, i) => (
            <p key={`${w.name}-${i}`} className="text-muted">
              {w.name}: {w.startTime}–{w.endTime}
              {w.travelHours
                ? ` · ${t("entries.travelHours")}: ${w.travelHours}`
                : ""}
            </p>
          ))}
        </div>

        <div className="space-y-1 rounded-xl border border-border bg-zinc-50 px-3 py-2 text-sm">
          <p>
            {t("calendar.labor")}: {formatMoney(job.laborTotal, locale)}
          </p>
          <p>
            {t("calendar.commute")}: {formatMoney(job.commuteCost, locale)}
          </p>
          <p>
            {t("calendar.car")}: {formatMoney(job.carCost, locale)}
          </p>
          {job.draftCharges
            .filter((c) => c.amount > 0)
            .map((c, i) => (
              <p key={`${c.title}-${i}`}>
                {c.title}: {formatMoney(c.amount, locale)}
              </p>
            ))}
          <p className="font-semibold text-brand">
            {t("calendar.grandTotal")}: {formatMoney(job.grandTotal, locale)}
          </p>
        </div>

        {error && <p className="text-sm text-red-700">{error}</p>}

        {mode === "view" && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              className="flex-1"
              disabled={saving}
              onClick={() => void onAccept()}
            >
              {t("clientLink.accept")}
            </Button>
            <Button
              className="flex-1"
              variant="secondary"
              disabled={saving}
              onClick={() => setMode("dispute")}
            >
              {t("clientLink.dispute")}
            </Button>
          </div>
        )}

        {mode === "dispute" && (
          <form onSubmit={onDispute} className="space-y-3">
            <div>
              <Label>{t("clientLink.disputeNote")}</Label>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t("clientLink.disputePlaceholder")}
              />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setMode("view")}
              >
                {t("common.back")}
              </Button>
              <Button type="submit" disabled={saving} className="flex-1">
                {saving ? t("common.loading") : t("clientLink.submitDispute")}
              </Button>
            </div>
          </form>
        )}
      </Card>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="grid min-h-dvh w-full place-items-center bg-zinc-50 px-4 py-8"
      dir="rtl"
    >
      {children}
    </div>
  );
}
