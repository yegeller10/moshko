import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RtlLineItemRow, RtlMoneyRow } from "@/components/client/RtlMoneyRow";

function formatTs(ts: number, locale: string) {
  return new Date(ts).toLocaleString(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatExpiry(ts: number, locale: string) {
  return new Date(ts).toLocaleString(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

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
          <BrandHeader />
          <p className="text-sm text-red-700">{t("clientLink.invalid")}</p>
        </Card>
      </Shell>
    );
  }

  const decisionNote =
    data.offer?.clientDecisionNote ?? data.job?.clientDecisionNote;

  const decision =
    doneDecision ??
    (data.status === "accepted"
      ? "accepted"
      : data.status === "disputed"
        ? "disputed"
        : null);

  const respondedAt = data.respondedAt ?? null;

  // Closed states: accepted, disputed, expired, already used
  if (mode === "done" || !data.open) {
    return (
      <Shell>
        <Card className="w-full max-w-lg space-y-4 p-5">
          <BrandHeader />
          {decision === "accepted" && data.kind === "offer" && data.offer ? (
            <OfferApprovedSummary
              offer={data.offer}
              respondedAt={respondedAt}
              locale={locale}
              t={t}
            />
          ) : (
            <div className="space-y-2 text-center">
              <p className="text-lg font-semibold">
                {decision === "accepted"
                  ? t("clientLink.thanksAccepted")
                  : decision === "disputed"
                    ? t("clientLink.thanksDisputed")
                    : data.status === "expired"
                      ? t("clientLink.expired")
                      : t("clientLink.alreadyUsed")}
              </p>
              {respondedAt && decision && (
                <p className="text-sm text-muted">
                  {t("clientLink.approvedAt", {
                    when: formatTs(respondedAt, locale),
                  })}
                </p>
              )}
              {decisionNote && (
                <p className="text-sm text-muted">{decisionNote}</p>
              )}
            </div>
          )}
        </Card>
      </Shell>
    );
  }

  if (data.kind === "offer" && data.offer) {
    const offer = data.offer;
    return (
      <Shell>
        <Card className="w-full max-w-lg overflow-hidden p-0">
          <div className="bg-gradient-to-br from-brand to-brand-dark px-5 py-4 text-white">
            <BrandHeader light />
            <h1 className="mt-2 text-xl font-bold">{title}</h1>
            <p className="text-sm opacity-90">
              {t("offers.offerNumber", { n: offer.number })}
            </p>
          </div>
          <div className="space-y-4 p-5">
            <div className="text-sm">
              <p className="text-right font-medium">{offer.clientName}</p>
              <p className="text-right text-muted">{offer.title}</p>
              {offer.dates.length > 0 && (
                <p className="text-right text-muted">{offer.dates.join(", ")}</p>
              )}
            </div>

            <ul className="space-y-2">
              {offer.lineItems.map((l, i) => (
                <RtlLineItemRow
                  key={i}
                  description={l.description}
                  quantity={l.quantity}
                  total={l.total}
                  locale={locale}
                />
              ))}
            </ul>

            <div className="space-y-1.5 rounded-xl border border-border bg-zinc-50 px-3 py-3 text-sm">
              <RtlMoneyRow
                label={t("offers.subtotal")}
                amount={offer.subtotal}
                locale={locale}
              />
              <RtlMoneyRow
                label={t("offers.vat", {
                  pct: Math.round(offer.vatRate * 100),
                })}
                amount={offer.vatAmount}
                locale={locale}
              />
              <RtlMoneyRow
                label={t("offers.grandTotal")}
                amount={offer.grandTotal}
                locale={locale}
                bold
                accent
              />
            </div>

            <p className="text-center text-xs text-muted">
              {t("clientLink.validUntil", {
                when: formatExpiry(data.expiresAt, locale),
              })}
            </p>

            {error && <p className="text-sm text-red-700">{error}</p>}

            <Button
              className="w-full"
              disabled={saving}
              onClick={() => void onAccept()}
            >
              {saving ? t("common.loading") : t("clientLink.acceptOffer")}
            </Button>
          </div>
        </Card>
      </Shell>
    );
  }

  const job = data.job;
  if (!job) {
    return (
      <Shell>
        <Card className="space-y-2 p-6 text-center">
          <BrandHeader />
          <p className="text-sm text-red-700">{t("clientLink.invalid")}</p>
        </Card>
      </Shell>
    );
  }

  return (
    <Shell>
      <Card className="w-full max-w-lg space-y-4 p-5">
        <BrandHeader />
        <div>
          <h1 className="text-xl font-bold">{title}</h1>
          <p className="text-sm text-muted">{job.clientName}</p>
        </div>

        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <p className="text-right sm:col-span-2">
            <span className="text-muted">{t("calendar.date")}: </span>
            <span dir="ltr">{job.date}</span>
          </p>
          <p className="text-right sm:col-span-2">
            <span className="text-muted">{t("calendar.time")}: </span>
            <span dir="ltr">
              {job.startTime}–{job.endTime}
            </span>
          </p>
          <p className="text-right sm:col-span-2">
            <span className="text-muted">{t("entries.location")}: </span>
            {job.locationText || "—"}
          </p>
        </div>

        <div className="space-y-1 text-sm">
          <p className="font-semibold">{t("quotes.workers")}</p>
          {job.workers.map((w, i) => (
            <p key={`${w.name}-${i}`} className="text-right text-muted">
              {w.name}:{" "}
              <span dir="ltr">
                {w.startTime}–{w.endTime}
              </span>
              {w.travelHours
                ? ` · ${t("entries.travelHours")}: ${w.travelHours}`
                : ""}
            </p>
          ))}
        </div>

        <div className="space-y-1.5 rounded-xl border border-border bg-zinc-50 px-3 py-2 text-sm">
          <RtlMoneyRow
            label={t("calendar.labor")}
            amount={job.laborTotal}
            locale={locale}
          />
          <RtlMoneyRow
            label={t("calendar.commute")}
            amount={job.commuteCost}
            locale={locale}
          />
          <RtlMoneyRow
            label={t("calendar.car")}
            amount={job.carCost}
            locale={locale}
          />
          {job.draftCharges
            .filter((c) => c.amount > 0)
            .map((c, i) => (
              <RtlMoneyRow
                key={`${c.title}-${i}`}
                label={c.title}
                amount={c.amount}
                locale={locale}
              />
            ))}
          <RtlMoneyRow
            label={t("calendar.grandTotal")}
            amount={job.grandTotal}
            locale={locale}
            bold
            accent
          />
        </div>

        <p className="text-center text-xs text-muted">
          {t("clientLink.validUntil", {
            when: formatExpiry(data.expiresAt, locale),
          })}
        </p>

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

function OfferApprovedSummary({
  offer,
  respondedAt,
  locale,
  t,
}: {
  offer: {
    number: number;
    title: string;
    clientName: string;
    dates: string[];
    lineItems: Array<{
      quantity: number;
      description: string;
      total: number;
    }>;
    subtotal: number;
    vatRate: number;
    vatAmount: number;
    grandTotal: number;
  };
  respondedAt: number | null;
  locale: string;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-emerald-50 px-4 py-3 text-center">
        <p className="text-lg font-semibold text-emerald-800">
          {t("clientLink.offerApprovedTitle")}
        </p>
        {respondedAt && (
          <p className="mt-1 text-sm text-emerald-700">
            {t("clientLink.approvedAt", {
              when: formatTs(respondedAt, locale),
            })}
          </p>
        )}
      </div>
      <div className="text-sm">
        <p className="text-right font-medium">
          {t("offers.offerNumber", { n: offer.number })} · {offer.clientName}
        </p>
        <p className="text-right text-muted">{offer.title}</p>
        {offer.dates.length > 0 && (
          <p className="text-right text-muted" dir="ltr">
            {offer.dates.join(", ")}
          </p>
        )}
      </div>
      <ul className="space-y-2">
        {offer.lineItems.map((l, i) => (
          <RtlLineItemRow
            key={i}
            description={l.description}
            quantity={l.quantity}
            total={l.total}
            locale={locale}
          />
        ))}
      </ul>
      <div className="space-y-1.5 rounded-xl border border-border bg-zinc-50 px-3 py-3 text-sm">
        <RtlMoneyRow
          label={t("offers.subtotal")}
          amount={offer.subtotal}
          locale={locale}
        />
        <RtlMoneyRow
          label={t("offers.vat", { pct: Math.round(offer.vatRate * 100) })}
          amount={offer.vatAmount}
          locale={locale}
        />
        <RtlMoneyRow
          label={t("offers.grandTotal")}
          amount={offer.grandTotal}
          locale={locale}
          bold
          accent
        />
      </div>
    </div>
  );
}

function BrandHeader({ light = false }: { light?: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3">
      <img
        src="/logo.png"
        alt=""
        className="h-10 w-10 rounded-xl object-contain bg-white/90"
      />
      <div className="text-right">
        <p
          className={`text-sm font-bold ${light ? "text-white" : "text-brand"}`}
        >
          {t("appName")}
        </p>
        <p className={`text-xs ${light ? "text-white/80" : "text-muted"}`}>
          {t("tagline")}
        </p>
      </div>
    </div>
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
