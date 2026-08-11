import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function OfferSettingsCard() {
  const { t } = useTranslation();
  const settings = useQuery(api.offers.getSettings, {});
  const ensureSettings = useMutation(api.offers.ensureSettings);
  const updateSettings = useMutation(api.offers.updateSettings);
  const resetTemplates = useMutation(api.offers.resetTemplates);

  const [form, setForm] = useState({
    nextNumber: "",
    vatPercent: "",
    companyName: "",
    companyVatId: "",
    companyAddress: "",
    companyEmails: "",
    bankPayee: "",
    bankName: "",
    bankBranch: "",
    bankAccount: "",
    paymentTerms: "",
    workerLineTemplate: "",
    carLineTemplate: "",
    emailSubjectTemplate: "",
    emailBodyTemplate: "",
  });
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    void ensureSettings({});
  }, [ensureSettings]);

  useEffect(() => {
    if (!settings) return;
    setForm({
      nextNumber: String(settings.nextNumber),
      vatPercent: String(settings.vatPercent),
      companyName: settings.companyName,
      companyVatId: settings.companyVatId,
      companyAddress: settings.companyAddress,
      companyEmails: settings.companyEmails,
      bankPayee: settings.bankPayee,
      bankName: settings.bankName,
      bankBranch: settings.bankBranch,
      bankAccount: settings.bankAccount,
      paymentTerms: settings.paymentTerms,
      workerLineTemplate: settings.workerLineTemplate,
      carLineTemplate: settings.carLineTemplate,
      emailSubjectTemplate: settings.emailSubjectTemplate,
      emailBodyTemplate: settings.emailBodyTemplate,
    });
  }, [settings]);

  function setField(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      await updateSettings({
        nextNumber: Number(form.nextNumber) || undefined,
        vatPercent: Number(form.vatPercent) || undefined,
        companyName: form.companyName,
        companyVatId: form.companyVatId,
        companyAddress: form.companyAddress,
        companyEmails: form.companyEmails,
        bankPayee: form.bankPayee,
        bankName: form.bankName,
        bankBranch: form.bankBranch,
        bankAccount: form.bankAccount,
        paymentTerms: form.paymentTerms,
        workerLineTemplate: form.workerLineTemplate,
        carLineTemplate: form.carLineTemplate,
        emailSubjectTemplate: form.emailSubjectTemplate,
        emailBodyTemplate: form.emailBodyTemplate,
      });
      setMsg("ok");
    } catch {
      setMsg("error");
    }
  }

  async function onReset() {
    setMsg(null);
    try {
      await resetTemplates({});
      setMsg("ok");
    } catch {
      setMsg("error");
    }
  }

  if (settings === undefined) {
    return (
      <Card className="p-4 text-sm text-muted">{t("common.loading")}</Card>
    );
  }

  return (
    <Card className="space-y-3">
      <h3 className="font-semibold">{t("settings.offerTemplates")}</h3>
      <p className="text-sm text-muted">{t("settings.offerTemplatesHint")}</p>
      <p className="text-xs text-muted">{t("settings.offerPlaceholders")}</p>
      <form onSubmit={onSave} className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>{t("settings.offerNextNumber")}</Label>
          <Input
            type="number"
            min="1"
            value={form.nextNumber}
            onChange={(e) => setField("nextNumber", e.target.value)}
          />
        </div>
        <div>
          <Label>{t("settings.offerVatPercent")}</Label>
          <Input
            type="number"
            min="0"
            step="0.1"
            value={form.vatPercent}
            onChange={(e) => setField("vatPercent", e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <Label>{t("settings.offerCompanyName")}</Label>
          <Input
            value={form.companyName}
            onChange={(e) => setField("companyName", e.target.value)}
          />
        </div>
        <div>
          <Label>{t("settings.offerCompanyVatId")}</Label>
          <Input
            value={form.companyVatId}
            onChange={(e) => setField("companyVatId", e.target.value)}
          />
        </div>
        <div>
          <Label>{t("settings.offerCompanyEmails")}</Label>
          <Input
            value={form.companyEmails}
            onChange={(e) => setField("companyEmails", e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <Label>{t("settings.offerCompanyAddress")}</Label>
          <Input
            value={form.companyAddress}
            onChange={(e) => setField("companyAddress", e.target.value)}
          />
        </div>
        <div>
          <Label>{t("settings.offerBankPayee")}</Label>
          <Input
            value={form.bankPayee}
            onChange={(e) => setField("bankPayee", e.target.value)}
          />
        </div>
        <div>
          <Label>{t("settings.offerBankName")}</Label>
          <Input
            value={form.bankName}
            onChange={(e) => setField("bankName", e.target.value)}
          />
        </div>
        <div>
          <Label>{t("settings.offerBankBranch")}</Label>
          <Input
            value={form.bankBranch}
            onChange={(e) => setField("bankBranch", e.target.value)}
          />
        </div>
        <div>
          <Label>{t("settings.offerBankAccount")}</Label>
          <Input
            value={form.bankAccount}
            onChange={(e) => setField("bankAccount", e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <Label>{t("settings.offerPaymentTerms")}</Label>
          <Textarea
            rows={3}
            value={form.paymentTerms}
            onChange={(e) => setField("paymentTerms", e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <Label>{t("settings.offerWorkerLine")}</Label>
          <Textarea
            rows={2}
            value={form.workerLineTemplate}
            onChange={(e) => setField("workerLineTemplate", e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <Label>{t("settings.offerCarLine")}</Label>
          <Input
            value={form.carLineTemplate}
            onChange={(e) => setField("carLineTemplate", e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <Label>{t("settings.offerEmailSubject")}</Label>
          <Input
            value={form.emailSubjectTemplate}
            onChange={(e) => setField("emailSubjectTemplate", e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <Label>{t("settings.offerEmailBody")}</Label>
          <Textarea
            rows={8}
            value={form.emailBodyTemplate}
            onChange={(e) => setField("emailBodyTemplate", e.target.value)}
            className="font-mono text-xs"
          />
        </div>
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <Button type="submit">{t("common.save")}</Button>
          <Button type="button" variant="secondary" onClick={() => void onReset()}>
            {t("settings.offerResetTemplates")}
          </Button>
        </div>
      </form>
      {msg === "ok" && (
        <p className="text-xs text-brand">{t("entries.saved")}</p>
      )}
      {msg === "error" && (
        <p className="text-xs text-red-700">{t("common.error")}</p>
      )}
    </Card>
  );
}
