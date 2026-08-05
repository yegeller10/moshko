import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2 } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Id } from "../../convex/_generated/dataModel";

type Contact = { name: string; phone: string };

const emptyForm = () => ({
  name: "",
  industry: "",
  notes: "",
  hourlyRate: "",
  dailyRate: "",
  extraHourRate: "",
  rateMode: "hourly" as "hourly" | "daily",
  active: true,
  contacts: [{ name: "", phone: "" }] as Contact[],
  emails: [""] as string[],
});

export function ClientsPage() {
  const { t } = useTranslation();
  const clients = useQuery(api.clients.list, { includeInactive: true });
  const create = useMutation(api.clients.create);
  const update = useMutation(api.clients.update);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    await create({
      name: form.name.trim() || undefined,
      industry: form.industry.trim() || undefined,
      notes: form.notes.trim() || undefined,
      contacts: form.contacts,
      emails: form.emails,
      hourlyRate: form.hourlyRate === "" ? undefined : Number(form.hourlyRate),
      dailyRate: form.dailyRate === "" ? undefined : Number(form.dailyRate),
      extraHourRate:
        form.extraHourRate === "" ? undefined : Number(form.extraHourRate),
      rateMode: form.rateMode,
      active: form.active,
    });
    setForm(emptyForm());
    setOpen(false);
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl font-bold md:text-2xl">{t("clients.title")}</h2>
        <Button size="sm" onClick={() => setOpen((v) => !v)}>
          {t("clients.add")}
        </Button>
      </div>

      {open && (
        <Card>
          <form
            onSubmit={onAdd}
            className="grid gap-3 md:grid-cols-2 lg:grid-cols-3"
          >
            <div>
              <Label>{t("clients.name")}</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <Label>{t("clients.industry")}</Label>
              <Input
                value={form.industry}
                onChange={(e) =>
                  setForm({ ...form, industry: e.target.value })
                }
              />
            </div>
            <div>
              <Label>{t("clients.rateMode")}</Label>
              <Select
                value={form.rateMode}
                onChange={(e) =>
                  setForm({
                    ...form,
                    rateMode: e.target.value as "hourly" | "daily",
                  })
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
                value={form.hourlyRate}
                onChange={(e) =>
                  setForm({ ...form, hourlyRate: e.target.value })
                }
              />
            </div>
            <div>
              <Label>{t("clients.dailyRate")}</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.dailyRate}
                onChange={(e) =>
                  setForm({ ...form, dailyRate: e.target.value })
                }
              />
            </div>
            <div>
              <Label>{t("clients.extraHourRate")}</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.extraHourRate}
                onChange={(e) =>
                  setForm({ ...form, extraHourRate: e.target.value })
                }
              />
            </div>

            <div className="md:col-span-2 lg:col-span-3 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="mb-0">{t("clients.contacts")}</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    setForm({
                      ...form,
                      contacts: [...form.contacts, { name: "", phone: "" }],
                    })
                  }
                >
                  <Plus className="h-4 w-4" />
                  {t("clients.addContact")}
                </Button>
              </div>
              {form.contacts.map((c, i) => (
                <div key={i} className="flex flex-wrap gap-2">
                  <Input
                    className="min-w-[10rem] flex-1"
                    placeholder={t("clients.contactName")}
                    value={c.name}
                    onChange={(e) => {
                      const contacts = [...form.contacts];
                      contacts[i] = { ...contacts[i], name: e.target.value };
                      setForm({ ...form, contacts });
                    }}
                  />
                  <Input
                    className="min-w-[10rem] flex-1"
                    placeholder={t("clients.contactPhone")}
                    value={c.phone}
                    onChange={(e) => {
                      const contacts = [...form.contacts];
                      contacts[i] = { ...contacts[i], phone: e.target.value };
                      setForm({ ...form, contacts });
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={form.contacts.length <= 1}
                    onClick={() =>
                      setForm({
                        ...form,
                        contacts: form.contacts.filter((_, j) => j !== i),
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="md:col-span-2 lg:col-span-3 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="mb-0">{t("clients.emails")}</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    setForm({ ...form, emails: [...form.emails, ""] })
                  }
                >
                  <Plus className="h-4 w-4" />
                  {t("clients.addEmail")}
                </Button>
              </div>
              {form.emails.map((email, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      const emails = [...form.emails];
                      emails[i] = e.target.value;
                      setForm({ ...form, emails });
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={form.emails.length <= 1}
                    onClick={() =>
                      setForm({
                        ...form,
                        emails: form.emails.filter((_, j) => j !== i),
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="md:col-span-2 lg:col-span-3">
              <Label>{t("clients.notes")}</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>

            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) =>
                  setForm({ ...form, active: e.target.checked })
                }
              />
              {t("clients.active")}
            </label>

            <Button type="submit" className="md:col-span-2 lg:col-span-3">
              {t("common.save")}
            </Button>
          </form>
        </Card>
      )}

      {!clients?.length ? (
        <Card className="text-sm text-muted">{t("clients.empty")}</Card>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {clients.map((c) => {
            const emails =
              c.emails?.length ? c.emails : c.email ? [c.email] : [];
            return (
              <li key={c._id}>
                <Card className="flex items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium">{c.name || "—"}</p>
                    {c.industry && (
                      <p className="text-xs text-muted">{c.industry}</p>
                    )}
                    <p className="text-xs text-muted">
                      {c.hourlyRate != null ? `${c.hourlyRate} ₪/h` : null}
                      {c.hourlyRate != null && c.dailyRate != null
                        ? " · "
                        : ""}
                      {c.dailyRate != null ? `${c.dailyRate} ₪/day` : null}
                    </p>
                    {emails.length > 0 && (
                      <p className="truncate text-xs text-muted">
                        {emails.join(", ")}
                      </p>
                    )}
                    {c.contacts?.map((ct, i) => (
                      <p key={i} className="text-xs text-muted">
                        {ct.name}
                        {ct.phone ? ` · ${ct.phone}` : ""}
                      </p>
                    ))}
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      void update({
                        id: c._id as Id<"clients">,
                        active: !(c.active !== false),
                      })
                    }
                  >
                    {c.active !== false ? "Off" : "On"}
                  </Button>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
