import { useState } from "react";
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
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    type: "employee" as WorkerType,
    phone: "",
    carLicense: false,
    heightWorkLicense: false,
  });

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const id = await create({
        firstName: form.firstName.trim() || undefined,
        lastName: form.lastName.trim() || undefined,
        type: form.type,
        phone: form.phone.trim() || undefined,
        carLicense: form.carLicense,
        heightWorkLicense: form.heightWorkLicense,
        active: true,
      });
      onCreated(id);
      onOpenChange(false);
      setForm({
        firstName: "",
        lastName: "",
        type: "employee",
        phone: "",
        carLicense: false,
        heightWorkLicense: false,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" showClose>
        <DialogHeader>
          <DialogTitle>{t("calendar.quickAddWorker")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSave}>
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
            <div className="sm:col-span-2">
              <Label>{t("workers.type")}</Label>
              <Select
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
            <div className="sm:col-span-2">
              <Label>{t("workers.phone")}</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.carLicense}
                onChange={(e) =>
                  setForm({ ...form, carLicense: e.target.checked })
                }
              />
              {t("workers.carLicense")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.heightWorkLicense}
                onChange={(e) =>
                  setForm({ ...form, heightWorkLicense: e.target.checked })
                }
              />
              {t("workers.heightWorkLicense")}
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
  const [name, setName] = useState("");
  const [hourlyRate, setHourlyRate] = useState("100");
  const [phone, setPhone] = useState("");

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const id = await create({
        name: name.trim() || undefined,
        hourlyRate: Number(hourlyRate) || 100,
        contacts: phone.trim()
          ? [{ name: name.trim() || "—", phone: phone.trim() }]
          : undefined,
        active: true,
      });
      onCreated(id);
      onOpenChange(false);
      setName("");
      setHourlyRate("100");
      setPhone("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" showClose>
        <DialogHeader>
          <DialogTitle>{t("calendar.quickAddClient")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSave}>
          <DialogBody className="grid gap-3">
            <div>
              <Label>{t("clients.name")}</Label>
              <Input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <Label>{t("clients.hourlyRate")}</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
              />
            </div>
            <div>
              <Label>{t("clients.contactPhone")}</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
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

export function QuickAddCityDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: Id<"cities">) => void;
}) {
  const { t } = useTranslation();
  const create = useMutation(api.cities.create);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [carRate, setCarRate] = useState("0");
  const [commuteRate, setCommuteRate] = useState("0");
  const [effectiveFrom, setEffectiveFrom] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const id = await create({
        name: name.trim(),
        effectiveFrom,
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
      <DialogContent className="max-w-md" showClose>
        <DialogHeader>
          <DialogTitle>{t("calendar.quickAddCity")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSave}>
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
