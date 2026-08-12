import { Link, useParams } from "react-router-dom";
import { useAction, useQuery } from "convex/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/costs";

export function OfferDetailPage() {
  const { id } = useParams();
  const offerId = id as Id<"offers"> | undefined;
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "he" ? "he-IL" : "en-IL";
  const offer = useQuery(
    api.offers.get,
    offerId ? { id: offerId } : "skip",
  );
  const sendOffer = useAction(api.offerPdf.sendOffer);
  const regenerateOfferPdf = useAction(api.offerRegen.rebuild);
  const [toEmail, setToEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!offerId) {
    return <p className="text-sm text-red-700">{t("common.error")}</p>;
  }
  if (offer === undefined) {
    return <p className="text-sm text-muted">{t("common.loading")}</p>;
  }
  if (offer === null) {
    return <p className="text-sm text-red-700">{t("common.error")}</p>;
  }

  const emails = [
    ...(offer.client?.emails ?? []),
    ...(offer.client?.email ? [offer.client.email] : []),
    ...(offer.sentToEmail ? [offer.sentToEmail] : []),
  ].filter(Boolean);

  async function onDownloadPdf() {
    setPdfBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await regenerateOfferPdf({ offerId: offerId! });
      if (!result.pdfBase64) {
        setError(t("common.error"));
        return;
      }
      const binary = atob(result.pdfBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename || `offer-${offer.number}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMessage(t("offers.pdfReady"));
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setPdfBusy(false);
    }
  }

  async function onResend() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const email = (toEmail || emails[0] || "").trim();
      if (!email) {
        setError(t("jobs.emailMissing"));
        return;
      }
      const result = await sendOffer({
        offerId: offerId!,
        toEmail: email,
        appOrigin: window.location.origin,
      });
      setMessage(t("jobs.emailSent", { email: result.toEmail }));
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold md:text-2xl">
          {t("offers.offerNumber", { n: offer.number })}
        </h2>
        <div className="flex gap-2">
          <Button asChild variant="secondary">
            <Link to="/offers">{t("offers.titleList")}</Link>
          </Button>
          {offer.status !== "cancelled" && (
            <Button
              type="button"
              disabled={pdfBusy}
              onClick={() => void onDownloadPdf()}
            >
              {pdfBusy ? t("common.loading") : t("offers.downloadPdf")}
            </Button>
          )}
        </div>
      </div>

      <Card className="space-y-2 text-sm">
        <p>
          <span className="text-muted">{t("offers.client")}: </span>
          {offer.client?.name ?? "—"}
        </p>
        <p>
          <span className="text-muted">{t("offers.title")}: </span>
          {offer.title}
        </p>
        <p>
          <span className="text-muted">{t("offers.statusLabel")}: </span>
          {t(`offers.status.${offer.status}`)}
        </p>
        {offer.attention && (
          <p>
            <span className="text-muted">{t("offers.attention")}: </span>
            {offer.attention}
          </p>
        )}
        {offer.contentHash && (
          <p className="break-all text-xs text-muted">
            {t("offers.hash")}: {offer.contentHash}
          </p>
        )}
        {message && <p className="text-sm text-emerald-800">{message}</p>}
        {error && <p className="text-sm text-red-700">{error}</p>}
      </Card>

      <Card className="space-y-2">
        <p className="font-semibold">{t("offers.lineItems")}</p>
        <ul className="space-y-2 text-sm">
          {offer.lineItems.map((l, i) => (
            <li key={i} className="rounded-xl border border-border px-3 py-2">
              <p>
                {l.quantity} × {l.description}
              </p>
              <p className="text-muted">
                {formatMoney(l.unitPrice, locale)} →{" "}
                {formatMoney(l.total, locale)}
              </p>
            </li>
          ))}
        </ul>
        <div className="border-t border-border pt-2 text-sm">
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
      </Card>

      <Card className="space-y-2">
        <p className="font-semibold">{t("quotes.workers")}</p>
        <ul className="space-y-1 text-sm">
          {offer.jobs.map((j) =>
            j ? (
              <li key={j._id}>
                <Link className="text-brand underline" to={`/jobs/${j._id}`}>
                  {j.date}
                </Link>
                {j.locationText ? ` · ${j.locationText}` : ""}
              </li>
            ) : null,
          )}
        </ul>
      </Card>

      {offer.status !== "cancelled" && (
        <Card className="space-y-3">
          <p className="font-semibold">{t("offers.sendEmailTitle")}</p>
          <p className="text-sm text-muted">{t("offers.sendEmailHint")}</p>
          <Label>{t("jobs.emailTo")}</Label>
          <Input
            type="email"
            value={toEmail || emails[0] || ""}
            onChange={(e) => setToEmail(e.target.value)}
            placeholder={emails[0] || ""}
          />
          <Button type="button" disabled={busy} onClick={() => void onResend()}>
            {busy ? t("common.loading") : t("offers.sendEmail")}
          </Button>
          {message && <p className="text-sm text-emerald-800">{message}</p>}
          {error && <p className="text-sm text-red-700">{error}</p>}
        </Card>
      )}
    </div>
  );
}
