import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAction, useMutation, useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney } from "@/lib/costs";

type LineItem = {
  quantity: number;
  description: string;
  unitPrice: number;
  total: number;
};

export function OfferComposerPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "he" ? "he-IL" : "en-IL";
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const seedJobId = params.get("jobId") as Id<"calendarEvents"> | null;

  const siblings = useQuery(
    api.offers.listSiblingBooked,
    seedJobId ? { jobId: seedJobId } : "skip",
  );
  const [selected, setSelected] = useState<Id<"calendarEvents">[]>([]);
  const [title, setTitle] = useState("");
  const [attention, setAttention] = useState("");
  const [toEmail, setToEmail] = useState("");
  const [lines, setLines] = useState<LineItem[]>([]);
  const [linesReady, setLinesReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!siblings?.length || selected.length) return;
    const seed =
      seedJobId && siblings.some((s) => s._id === seedJobId)
        ? seedJobId
        : siblings[0]!._id;
    setSelected([seed]);
  }, [siblings, seedJobId, selected.length]);

  const preview = useQuery(
    api.offers.previewFromJobs,
    selected.length ? { jobIds: selected } : "skip",
  );

  useEffect(() => {
    if (!preview || linesReady) return;
    setLines(preview.lineItems.map((l) => ({ ...l })));
    if (!title) {
      setTitle(
        preview.jobs.map((j) => j.date).join(", ") ||
          t("offers.defaultTitle"),
      );
    }
    if (!toEmail && preview.clientEmails[0]) {
      setToEmail(preview.clientEmails[0]!);
    }
    setLinesReady(true);
  }, [preview, linesReady, title, toEmail, t]);

  const selectedKey = selected.join(",");

  useEffect(() => {
    setLinesReady(false);
  }, [selectedKey]);

  const createDraft = useMutation(api.offers.createDraft);
  const sendOffer = useAction(api.offerPdf.sendOffer);
  const ensureSettings = useMutation(api.offers.ensureSettings);

  useEffect(() => {
    void ensureSettings({});
  }, [ensureSettings]);

  const totals = useMemo(() => {
    const vatPercent = preview?.vatPercent ?? 18;
    const subtotal = lines.reduce(
      (s, l) => s + Math.round(l.quantity * l.unitPrice * 100) / 100,
      0,
    );
    const vatAmount = Math.round(subtotal * (vatPercent / 100) * 100) / 100;
    return {
      subtotal,
      vatAmount,
      grandTotal: Math.round((subtotal + vatAmount) * 100) / 100,
      vatPercent,
    };
  }, [lines, preview?.vatPercent]);

  function toggleJob(id: Id<"calendarEvents">) {
    setSelected((prev) => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev;
        return prev.filter((x) => x !== id);
      }
      return [...prev, id];
    });
  }

  function updateLine(index: number, patch: Partial<LineItem>) {
    setLines((prev) =>
      prev.map((l, i) => {
        if (i !== index) return l;
        const next = { ...l, ...patch };
        next.total =
          Math.round(next.quantity * next.unitPrice * 100) / 100;
        return next;
      }),
    );
  }

  function addLine() {
    setLines((prev) => [
      ...prev,
      { quantity: 1, description: "", unitPrice: 0, total: 0 },
    ]);
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (!selected.length) throw new Error(t("offers.needJobs"));
      if (!toEmail.trim()) throw new Error(t("jobs.emailMissing"));
      const offerId = await createDraft({
        jobIds: selected,
        title: title.trim() || t("offers.defaultTitle"),
        attention: attention.trim() || undefined,
        lineItems: lines,
      });
      await sendOffer({
        offerId,
        toEmail: toEmail.trim(),
        appOrigin: window.location.origin,
      });
      navigate(`/offers/${offerId}`);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  if (!seedJobId) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-red-700">{t("offers.needSeedJob")}</p>
        <Button asChild variant="secondary">
          <Link to="/quotes">{t("common.back")}</Link>
        </Button>
      </div>
    );
  }

  if (siblings === undefined || (selected.length > 0 && preview === undefined)) {
    return <p className="text-sm text-muted">{t("common.loading")}</p>;
  }

  return (
    <form onSubmit={onSend} className="w-full max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold md:text-2xl">{t("offers.composerTitle")}</h2>
        <Button type="button" variant="secondary" asChild>
          <Link to={`/jobs/${seedJobId}`}>{t("common.back")}</Link>
        </Button>
      </div>

      <Card className="space-y-3">
        <p className="text-sm font-semibold">{t("offers.pickJobs")}</p>
        <p className="text-xs text-muted">
          {t("offers.client")}: {preview?.clientName ?? "—"} · #
          {preview?.nextNumber ?? "—"}
        </p>
        <ul className="space-y-2">
          {(siblings ?? []).map((j) => (
            <li key={j._id}>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={selected.includes(j._id)}
                  onChange={() => toggleJob(j._id)}
                />
                <span>
                  <span className="font-medium">{j.date}</span>
                  {j.locationText ? ` · ${j.locationText}` : ""}
                  <span className="block text-muted">
                    {j.workers} {t("quotes.workers").toLowerCase()} ·{" "}
                    {formatMoney(j.quoteTotal, locale)}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="space-y-3">
        <div>
          <Label>{t("offers.title")}</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>
        <div>
          <Label>{t("offers.attention")}</Label>
          <Input
            value={attention}
            onChange={(e) => setAttention(e.target.value)}
            placeholder={t("offers.attentionPlaceholder")}
          />
        </div>
        <div>
          <Label>{t("jobs.emailTo")}</Label>
          {(preview?.clientEmails.length ?? 0) > 0 ? (
            <Select
              value={toEmail || preview!.clientEmails[0]}
              onChange={(e) => setToEmail(e.target.value)}
            >
              {preview!.clientEmails.map((em) => (
                <option key={em} value={em}>
                  {em}
                </option>
              ))}
            </Select>
          ) : (
            <Input
              type="email"
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
              required
            />
          )}
        </div>
      </Card>

      <Card className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold">{t("offers.lineItems")}</p>
          <Button type="button" variant="secondary" size="sm" onClick={addLine}>
            {t("offers.addLine")}
          </Button>
        </div>
        {lines.map((line, i) => (
          <div
            key={i}
            className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-[4rem_1fr_6rem_auto]"
          >
            <div>
              <Label>{t("offers.qty")}</Label>
              <Input
                type="number"
                min="0"
                step="1"
                value={line.quantity}
                onChange={(e) =>
                  updateLine(i, { quantity: Number(e.target.value) || 0 })
                }
              />
            </div>
            <div>
              <Label>{t("offers.description")}</Label>
              <Textarea
                value={line.description}
                onChange={(e) => updateLine(i, { description: e.target.value })}
                rows={2}
              />
            </div>
            <div>
              <Label>{t("offers.unitPrice")}</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={line.unitPrice}
                onChange={(e) =>
                  updateLine(i, { unitPrice: Number(e.target.value) || 0 })
                }
              />
            </div>
            <div className="flex flex-col justify-between">
              <p className="text-sm font-medium">
                {formatMoney(line.total, locale)}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeLine(i)}
              >
                ×
              </Button>
            </div>
          </div>
        ))}
        <div className="space-y-1 border-t border-border pt-3 text-sm">
          <p>
            {t("offers.subtotal")}: {formatMoney(totals.subtotal, locale)}
          </p>
          <p>
            {t("offers.vat", { pct: totals.vatPercent })}:{" "}
            {formatMoney(totals.vatAmount, locale)}
          </p>
          <p className="font-semibold text-brand">
            {t("offers.grandTotal")}: {formatMoney(totals.grandTotal, locale)}
          </p>
        </div>
      </Card>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <Button type="submit" disabled={busy || !lines.length}>
        {busy ? t("common.loading") : t("offers.createAndSend")}
      </Button>
    </form>
  );
}
