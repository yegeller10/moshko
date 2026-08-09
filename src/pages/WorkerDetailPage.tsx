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
import { Select } from "@/components/ui/select";
import { currentYearMonth } from "@/lib/utils";

type WorkerType = "owner" | "employee" | "independent";
const blank = { firstName:"", lastName:"", type:"employee" as WorkerType, idNumber:"", birthDate:"", address:"", phone:"", carLicense:false, heightWorkLicense:false, active:true };

export function WorkerDetailPage() {
  const { id } = useParams();
  const { t } = useTranslation();
  const worker = useQuery(api.workers.get, id ? { id: id as Id<"workers"> } : "skip");
  const update = useMutation(api.workers.update);
  const [month, setMonth] = useState(currentYearMonth());
  const summary = useQuery(api.reports.workerMonthSummary, id ? { workerId:id as Id<"workers">, yearMonth:month } : "skip");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(blank);
  useEffect(() => { if (worker) setForm({ firstName:worker.firstName ?? "",lastName:worker.lastName ?? "",type:worker.type ?? "employee",idNumber:worker.idNumber ?? "",birthDate:worker.birthDate ?? "",address:worker.address ?? "",phone:worker.phone ?? "",carLicense:worker.carLicense ?? false,heightWorkLicense:worker.heightWorkLicense ?? false,active:worker.active !== false }); }, [worker]);
  if (!id) return null;
  async function save(e: React.FormEvent) { e.preventDefault(); await update({ id:id as Id<"workers">, ...form }); setEditing(false); }
  return <div className="w-full max-w-3xl space-y-4"><Link className="text-sm text-brand" to="/workers">← {t("common.back")}</Link>
    <div className="flex items-center justify-between"><h2 className="text-xl font-bold md:text-2xl">{worker?.displayName ?? "—"}</h2><Button size="sm" onClick={()=>setEditing(v=>!v)}>{t("workers.edit")}</Button></div>
    {editing ? <Card><form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
      <div><Label>{t("workers.firstName")}</Label><Input value={form.firstName} onChange={e=>setForm({...form,firstName:e.target.value})}/></div><div><Label>{t("workers.lastName")}</Label><Input value={form.lastName} onChange={e=>setForm({...form,lastName:e.target.value})}/></div>
      <div><Label>{t("workers.type")}</Label><Select value={form.type} onChange={e=>setForm({...form,type:e.target.value as WorkerType})}><option value="owner">{t("workers.types.owner")}</option><option value="employee">{t("workers.types.employee")}</option><option value="independent">{t("workers.types.independent")}</option></Select></div>
      <div><Label>{t("workers.idNumber")}</Label><Input value={form.idNumber} onChange={e=>setForm({...form,idNumber:e.target.value})}/></div><div><Label>{t("workers.birthDate")}</Label><Input type="date" value={form.birthDate} onChange={e=>setForm({...form,birthDate:e.target.value})}/></div><div><Label>{t("workers.phone")}</Label><Input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></div>
      <div className="sm:col-span-2"><Label>{t("workers.address")}</Label><Input value={form.address} onChange={e=>setForm({...form,address:e.target.value})}/></div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.carLicense} onChange={e=>setForm({...form,carLicense:e.target.checked})}/>{t("workers.carLicense")}</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.heightWorkLicense} onChange={e=>setForm({...form,heightWorkLicense:e.target.checked})}/>{t("workers.heightWorkLicense")}</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={e=>setForm({...form,active:e.target.checked})}/>{t("workers.active")}</label><Button type="submit" className="sm:col-span-2">{t("common.save")}</Button>
    </form></Card> : <Card className="space-y-1 text-sm"><p>{t(`workers.types.${worker?.type ?? "employee"}`)}</p><p>{worker?.phone}</p><p>{worker?.address}</p><p>{t("workers.idNumber")}: {worker?.idNumber}</p></Card>}
    <Card className="space-y-3"><div><Label>{t("reports.month")}</Label><Input type="month" value={month} onChange={e=>setMonth(e.target.value)}/></div><h3 className="font-semibold">{t("workers.summary")}</h3><div className="grid gap-2 text-sm sm:grid-cols-3"><p>{t("dashboard.entries")}: {summary?.entriesCount ?? 0}</p><p>{t("reports.totalHours")}: {summary?.workHours ?? 0}</p><p>{t("entries.travelHours")}: {summary?.travelHours ?? 0}</p></div></Card>
  </div>;
}
