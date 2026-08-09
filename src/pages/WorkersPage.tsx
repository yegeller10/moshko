import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { Id } from "../../convex/_generated/dataModel";
import { useNavigate } from "react-router-dom";

type WorkerType = "owner" | "employee" | "independent";

const emptyForm = () => ({
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

export function WorkersPage() {
  const { t } = useTranslation();
  const workers = useQuery(api.workers.list, { includeInactive: true });
  const create = useMutation(api.workers.create);
  const update = useMutation(api.workers.update);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    await create({
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
    setForm(emptyForm());
    setOpen(false);
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl font-bold md:text-2xl">{t("workers.title")}</h2>
        <Button size="sm" onClick={() => setOpen((v) => !v)}>
          {t("workers.add")}
        </Button>
      </div>

      {open && (
        <Card>
          <form
            onSubmit={onAdd}
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
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
                onChange={(e) =>
                  setForm({ ...form, lastName: e.target.value })
                }
              />
            </div>
            <div>
              <Label>{t("workers.type")}</Label>
              <Select
                required
                value={form.type}
                onChange={(e) =>
                  setForm({
                    ...form,
                    type: e.target.value as WorkerType,
                  })
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
            <div className="sm:col-span-2 lg:col-span-3">
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
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) =>
                  setForm({ ...form, active: e.target.checked })
                }
              />
              {t("workers.active")}
            </label>
            <Button type="submit" className="sm:col-span-2 lg:col-span-3">
              {t("common.save")}
            </Button>
          </form>
        </Card>
      )}

      {!workers?.length ? (
        <Card className="text-sm text-muted">{t("workers.empty")}</Card>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {workers.map((w) => (
            <li key={w._id}>
              <Card
                className="flex items-start justify-between gap-2"
                onDoubleClick={() => navigate(`/workers/${w._id}`)}
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="font-medium">{w.displayName}</p>
                  {w.type && (
                    <p className="text-xs text-muted">
                      {t(`workers.types.${w.type}`)}
                    </p>
                  )}
                  {w.phone && (
                    <p className="text-xs text-muted">{w.phone}</p>
                  )}
                  {w.idNumber && (
                    <p className="text-xs text-muted">
                      {t("workers.idNumber")}: {w.idNumber}
                    </p>
                  )}
                  <p className="text-xs text-muted">
                    {t("workers.carLicense")}:{" "}
                    {w.carLicense ? t("common.yes") : t("common.no")}
                    {" · "}
                    {t("workers.heightWorkLicense")}:{" "}
                    {w.heightWorkLicense ? t("common.yes") : t("common.no")}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => navigate(`/workers/${w._id}`)}>
                    {t("workers.open")}
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => void update({ id: w._id as Id<"workers">, active: !(w.active !== false) })}>
                    {w.active !== false ? "Off" : "On"}
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
