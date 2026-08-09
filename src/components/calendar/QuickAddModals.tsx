import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Id } from "../../../convex/_generated/dataModel";

type WorkerType = "owner" | "employee" | "independent";
type Contact = { name: string; phone: string };

const emptyWorker = () => ({
  firstName: "",
  lastName: "",
  type: "employee" as WorkerType,
  idNumber: "",
  birthDate: "",
  address: "",
  phone: "",
  carLicense: false,
  heightWorkLicense: false,
  active: true,
});

const emptyClient = () => ({
  name: "",
  industry: "",
  notes: "",
  hourlyRate: "100",
  active: true,
  contacts: [{ name: "", phone: "" }] as Contact[],
  emails: [""] as string[],
});

export function QuickAddWorkerDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: Id<"workers">) => void;
}) {
  const { t } = useTranslation();
  const create = useMutation(api.workers.create);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyWorker);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const id = await create({
        firstName: form.firstName.trim() || undefined,
        lastName: form.lastName.trim() || undefined,
        type: form.type,
        idNumber: form.idNumber.trim() || undefined,
        birthDate: form.birthDate || undefined,
        address: form.address.trim() || undefined,
        phone: form.phone.trim() || undefined,
        carLicense: form.carLicense,
        heightWorkLicense: form.heightWorkLicense,
        active: form.active,
      });
      onCreated(id);
      onOpenChange(false);
      setForm(emptyWorker());
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="z-[120] max-w-xl"
        overlayClassName="z-[115]"
        showClose
      >
        <DialogHeader>
          <DialogTitle>{t("calendar.quickAddWorker")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSave} className="flex min-h-0 flex-1 flex-col">
          <DialogBody className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>{t("workers.firstName")}</Label>
              <Input
                value={form.firstName}
                onChange={(e) =>
                  setForm({ ...form, firstName: e.target.value })
                }
              />
            </div>
            <div>
              <Label>{t("workers.lastName")}</Label>
              <Input
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              />
            </div>
            <div>
              <Label>{t("workers.type")}</Label>
              <Select
                required
                value={form.type}
                onChange={(e) =>
                  setForm({ ...form, type: e.target.value as WorkerType })
                }
              >
                <option value="owner">{t("workers.types.owner")}</option>
                <option value="employee">{t("workers.types.employee")}</option>
                <option value="independent">
                  {t("workers.types.independent")}
                </option>
              </Select>
            </div>
            <div>
              <Label>{t("workers.idNumber")}</Label>
              <Input
                value={form.idNumber}
                onChange={(e) =>
                  setForm({ ...form, idNumber: e.target.value })
                }
              />
            </div>
            <div>
              <Label>{t("workers.birthDate")}</Label>
              <Input
                type="date"
                value={form.birthDate}
                onChange={(e) =>
                  setForm({ ...form, birthDate: e.target.value })
                }
              />
            </div>
            <div>
              <Label>{t("workers.phone")}</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>{t("workers.address")}</Label>
              <Input
                value={form.address}
                onChange={(e) =>
                  setForm({ ...form, address: e.target.value })
                }
              />
            </div>
            <div>
              <Label>{t("workers.carLicense")}</Label>
              <Select
                value={form.carLicense ? "yes" : "no"}
                onChange={(e) =>
                  setForm({ ...form, carLicense: e.target.value === "yes" })
                }
              >
                <option value="yes">{t("common.yes")}</option>
                <option value="no">{t("common.no")}</option>
              </Select>
            </div>
            <div>
              <Label>{t("workers.heightWorkLicense")}</Label>
              <Select
                value={form.heightWorkLicense ? "yes" : "no"}
                onChange={(e) =>
                  setForm({
                    ...form,
                    heightWorkLicense: e.target.value === "yes",
                  })
                }
              >
                <option value="yes">{t("common.yes")}</option>
                <option value="no">{t("common.no")}</option>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) =>
                  setForm({ ...form, active: e.target.checked })
                }
              />
              {t("workers.active")}
            </label>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? t("common.loading") : t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function QuickAddClientDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: Id<"clients">) => void;
}) {
  const { t } = useTranslation();
  const create = useMutation(api.clients.create);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyClient);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const id = await create({
        name: form.name.trim() || undefined,
        industry: form.industry.trim() || undefined,
        notes: form.notes.trim() || undefined,
        contacts: form.contacts,
        emails: form.emails,
        hourlyRate:
          form.hourlyRate === "" ? 100 : Number(form.hourlyRate) || 100,
        active: form.active,
      });
      onCreated(id);
      onOpenChange(false);
      setForm(emptyClient());
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="z-[120] max-w-xl"
        overlayClassName="z-[115]"
        showClose
      >
        <DialogHeader>
          <DialogTitle>{t("calendar.quickAddClient")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSave} className="flex min-h-0 flex-1 flex-col">
          <DialogBody className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>{t("clients.name")}</Label>
              <Input
                required
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
            <div className="sm:col-span-2">
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
            <div className="space-y-2 sm:col-span-2">
              <Label>{t("clients.contacts")}</Label>
              {form.contacts.map((c, i) => (
                <div key={i} className="grid gap-2 sm:grid-cols-2">
                  <Input
                    placeholder={t("clients.contactName")}
                    value={c.name}
                    onChange={(e) => {
                      const contacts = [...form.contacts];
                      contacts[i] = { ...contacts[i], name: e.target.value };
                      setForm({ ...form, contacts });
                    }}
                  />
                  <Input
                    placeholder={t("clients.contactPhone")}
                    value={c.phone}
                    onChange={(e) => {
                      const contacts = [...form.contacts];
                      contacts[i] = { ...contacts[i], phone: e.target.value };
                      setForm({ ...form, contacts });
                    }}
                  />
                </div>
              ))}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() =>
                  setForm({
                    ...form,
                    contacts: [...form.contacts, { name: "", phone: "" }],
                  })
                }
              >
                {t("clients.addContact")}
              </Button>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>{t("clients.emails")}</Label>
              {form.emails.map((em, i) => (
                <Input
                  key={i}
                  type="email"
                  value={em}
                  onChange={(e) => {
                    const emails = [...form.emails];
                    emails[i] = e.target.value;
                    setForm({ ...form, emails });
                  }}
                />
              ))}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() =>
                  setForm({ ...form, emails: [...form.emails, ""] })
                }
              >
                {t("clients.addEmail")}
              </Button>
            </div>
            <div className="sm:col-span-2">
              <Label>{t("clients.notes")}</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) =>
                  setForm({ ...form, active: e.target.checked })
                }
              />
              {t("clients.active")}
            </label>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? t("common.loading") : t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function QuickAddCityDialog({
  open,
  onOpenChange,
  onCreated,
  jobDate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: Id<"cities">) => void;
  /** Job date — rates must apply on/before this day. */
  jobDate?: string;
}) {
  const { t } = useTranslation();
  const create = useMutation(api.cities.create);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [carRate, setCarRate] = useState("0");
  const [commuteRate, setCommuteRate] = useState("0");
  const [effectiveFrom, setEffectiveFrom] = useState(
    () => jobDate ?? new Date().toISOString().slice(0, 10),
  );

  useEffect(() => {
    if (!open) return;
    const today = new Date().toISOString().slice(0, 10);
    // Rates must cover the job date — use the earlier of job/today.
    const base = jobDate && jobDate < today ? jobDate : today;
    setEffectiveFrom(base);
  }, [open, jobDate]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const from =
        jobDate && jobDate < effectiveFrom
          ? jobDate
          : effectiveFrom || today;
      const id = await create({
        name: name.trim(),
        effectiveFrom: from,
        carRate: Number(carRate) || 0,
        commuteRate: Number(commuteRate) || 0,
      });
      onCreated(id);
      onOpenChange(false);
      setName("");
      setCarRate("0");
      setCommuteRate("0");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="z-[120] max-w-md"
        overlayClassName="z-[115]"
        showClose
      >
        <DialogHeader>
          <DialogTitle>{t("calendar.quickAddCity")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSave} className="flex min-h-0 flex-1 flex-col">
          <DialogBody className="grid gap-3">
            <div>
              <Label>{t("settings.cityName")}</Label>
              <Input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <Label>{t("settings.effectiveFrom")}</Label>
              <Input
                type="date"
                required
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
              />
            </div>
            <div>
              <Label>{t("settings.cityCarRate")}</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={carRate}
                onChange={(e) => setCarRate(e.target.value)}
              />
            </div>
            <div>
              <Label>{t("settings.cityCommuteRate")}</Label>
              <Input
                type="number"
                min="0"
                step="0.25"
                value={commuteRate}
                onChange={(e) => setCommuteRate(e.target.value)}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? t("common.loading") : t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function QuickAddLocationField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div>
      <Label>{t("calendar.location")}</Label>
      <Textarea
        rows={2}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("calendar.locationPlaceholder")}
      />
    </div>
  );
}
