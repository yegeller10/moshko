import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { currentYearMonth } from "@/lib/utils";
import { formatMoney } from "@/lib/costs";

type Contact = { name: string; phone: string };

export function ClientDetailPage() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const client = useQuery(api.clients.get, id ? { id: id as Id<"clients"> } : "skip");
  const update = useMutation(api.clients.update);
  const [month, setMonth] = useState(currentYearMonth());
  const summary = useQuery(api.reports.clientMonthSummary, id ? { clientId: id as Id<"clients">, yearMonth: month } : "skip");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", industry: "", notes: "", hourlyRate: "100", active: true, contacts: [] as Contact[], emails: [] as string[] });
  useEffect(() => {
    if (client) setForm({ name: client.name ?? "", industry: client.industry ?? "", notes: client.notes ?? "", hourlyRate: String(client.hourlyRate ?? 100), active: client.active !== false, contacts: client.contacts?.length ? client.contacts : [{ name: "", phone: "" }], emails: client.emails?.length ? client.emails : [""] });
  }, [client]);
  if (!id) return null;
  const locale = i18n.language === "he" ? "he-IL" : "en-IL";
  async function save(e: React.FormEvent) {
    e.preventDefault();
    await update({ id: id as Id<"clients">, name: form.name, industry: form.industry, notes: form.notes, hourlyRate: Number(form.hourlyRate) || 100, active: form.active, contacts: form.contacts, emails: form.emails });
    setEditing(false);
  }
  return <div className="w-full max-w-3xl space-y-4">
    <Link className="text-sm text-brand" to="/clients">← {t("common.back")}</Link>
    <div className="flex items-center justify-between"><h2 className="text-xl font-bold md:text-2xl">{client?.name ?? "—"}</h2><Button size="sm" onClick={() => setEditing(v => !v)}>{t("clients.edit")}</Button></div>
    {editing ? <Card><form onSubmit={save} className="grid gap-3 md:grid-cols-2">
      <div><Label>{t("clients.name")}</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
      <div><Label>{t("clients.industry")}</Label><Input value={form.industry} onChange={e => setForm({ ...form, industry: e.target.value })} /></div>
      <div><Label>{t("clients.hourlyRate")}</Label><Input type="number" value={form.hourlyRate} onChange={e => setForm({ ...form, hourlyRate: e.target.value })} /></div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })}/>{t("clients.active")}</label>
      <div className="md:col-span-2 space-y-2"><Label>{t("clients.contacts")}</Label>{form.contacts.map((c, i) => <div className="grid gap-2 sm:grid-cols-2" key={i}><Input placeholder={t("clients.contactName")} value={c.name} onChange={e => { const contacts=[...form.contacts]; contacts[i]={...c,name:e.target.value}; setForm({...form,contacts}); }}/><Input placeholder={t("clients.contactPhone")} value={c.phone} onChange={e => { const contacts=[...form.contacts]; contacts[i]={...c,phone:e.target.value}; setForm({...form,contacts}); }}/></div>)}<Button type="button" variant="secondary" size="sm" onClick={() => setForm({...form,contacts:[...form.contacts,{name:"",phone:""}]})}>{t("clients.addContact")}</Button></div>
      <div className="md:col-span-2 space-y-2"><Label>{t("clients.emails")}</Label>{form.emails.map((email,i)=><Input key={i} type="email" value={email} onChange={e=>{const emails=[...form.emails];emails[i]=e.target.value;setForm({...form,emails});}}/>)}<Button type="button" variant="secondary" size="sm" onClick={()=>setForm({...form,emails:[...form.emails,""]})}>{t("clients.addEmail")}</Button></div>
      <div className="md:col-span-2"><Label>{t("clients.notes")}</Label><Textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></div><Button type="submit" className="md:col-span-2">{t("common.save")}</Button>
    </form></Card> : <Card className="space-y-2"><p>{client?.industry}</p><p>{t("clients.hourlyRate")}: {formatMoney(client?.hourlyRate ?? 100, locale)}</p>{client?.contacts?.map(c => <p key={`${c.name}-${c.phone}`} className="text-sm">{c.name} {c.phone}</p>)}{client?.emails?.map(email => <p key={email} className="text-sm">{email}</p>)}<p className="text-sm text-muted">{client?.notes}</p></Card>}
    <Card className="space-y-3"><div><Label>{t("reports.month")}</Label><Input type="month" value={month} onChange={e=>setMonth(e.target.value)}/></div><h3 className="font-semibold">{t("clients.summary")}</h3><div className="grid gap-2 text-sm sm:grid-cols-2"><p>{t("dashboard.entries")}: {summary?.jobsCount ?? 0}</p><p>{t("reports.totalHours")}: {summary?.totalHours ?? 0}</p><p>{t("reports.labor")}: {formatMoney(summary?.laborTotal ?? 0,locale)}</p><p>{t("reports.expenses")}: {formatMoney(summary?.expenseTotal ?? 0,locale)}</p><p className="font-semibold">{t("reports.monthTotal")}: {formatMoney(summary?.monthTotal ?? 0,locale)}</p></div></Card>
  </div>;
}
