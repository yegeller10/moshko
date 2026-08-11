import { useMemo, useState } from "react";
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
import { cn } from "@/lib/utils";

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
  hourlyRate: "",
  minimumHours: "6",
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
  const [search, setSearch] = useState("");
  const [filterCar, setFilterCar] = useState(false);
  const [filterHeight, setFilterHeight] = useState(false);

  const filtered = useMemo(() => {
    if (!workers) return [];
    const q = search.trim().toLowerCase();
    return workers.filter((w) => {
      if (filterCar && !w.carLicense) return false;
      if (filterHeight && !w.heightWorkLicense) return false;
      if (!q) return true;
      return (w.displayName ?? "").toLowerCase().includes(q);
    });
  }, [workers, search, filterCar, filterHeight]);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    const isEmployee = form.type === "employee";
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
      hourlyRate:
        isEmployee && form.hourlyRate !== ""
          ? Number(form.hourlyRate)
          : undefined,
      minimumHours: isEmployee
        ? Number(form.minimumHours) || 6
        : undefined,
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

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFilterCar((v) => !v)}
          className={cn(
            "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
            filterCar
              ? "border-sky-300 bg-sky-100 text-sky-900"
              : "border-border bg-white text-muted",
          )}
        >
          {t("workers.carLicense")}
        </button>
        <button
          type="button"
          onClick={() => setFilterHeight((v) => !v)}
          className={cn(
            "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
            filterHeight
              ? "border-violet-300 bg-violet-100 text-violet-900"
              : "border-border bg-white text-muted",
          )}
        >
          {t("workers.heightWorkLicense")}
        </button>
      </div>

      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t("common.search")}
        className="max-w-md"
      />

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
                onChange={(e) => {
                  const type = e.target.value as WorkerType;
                  setForm({
                    ...form,
                    type,
                    minimumHours:
                      type === "employee" && !form.minimumHours
                        ? "6"
                        : form.minimumHours,
                  });
                }}
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
            <div>
              <Label>{t("workers.hourlyRate")}</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                disabled={form.type !== "employee"}
                value={form.hourlyRate}
                onChange={(e) =>
                  setForm({ ...form, hourlyRate: e.target.value })
                }
                placeholder={
                  form.type === "employee" ? undefined : t("workers.employeeOnly")
                }
              />
            </div>
            <div>
              <Label>{t("workers.minimumHours")}</Label>
              <Input
                type="number"
                min="0"
                step="0.25"
                disabled={form.type !== "employee"}
                value={form.minimumHours}
                onChange={(e) =>
                  setForm({ ...form, minimumHours: e.target.value })
                }
              />
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
      ) : filtered.length === 0 ? (
        <Card className="text-sm text-muted">{t("common.noResults")}</Card>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((w) => (
            <li key={w._id}>
              <Card
                className="flex items-start justify-between gap-2"
                onDoubleClick={() => navigate(`/workers/${w._id}`)}
              >
                <div className="min-w-0 space-y-1.5">
                  <p className="font-medium">{w.displayName}</p>
                  {w.type && (
                    <p className="text-xs text-muted">
                      {t(`workers.types.${w.type}`)}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    {w.carLicense && (
                      <span className="rounded-md bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-900">
                        {t("workers.carLicenseShort")}
                      </span>
                    )}
                    {w.heightWorkLicense && (
                      <span className="rounded-md bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-900">
                        {t("workers.heightLicenseShort")}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => navigate(`/workers/${w._id}`)}
                  >
                    {t("workers.open")}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      void update({
                        id: w._id as Id<"workers">,
                        active: !w.active,
                      })
                    }
                  >
                    {w.active ? t("common.off") : t("common.on")}
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
