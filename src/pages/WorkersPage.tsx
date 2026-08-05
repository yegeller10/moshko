import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Id } from "../../convex/_generated/dataModel";

export function WorkersPage() {
  const { t } = useTranslation();
  const workers = useQuery(api.workers.list, { includeInactive: true });
  const create = useMutation(api.workers.create);
  const update = useMutation(api.workers.update);
  const [name, setName] = useState("");

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await create({ name: name.trim() });
    setName("");
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">{t("workers.title")}</h2>

      <Card>
        <form onSubmit={onAdd} className="flex gap-2">
          <div className="flex-1">
            <Label htmlFor="name" className="sr-only">
              {t("workers.name")}
            </Label>
            <Input
              id="name"
              placeholder={t("workers.name")}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <Button type="submit">{t("workers.add")}</Button>
        </form>
      </Card>

      {!workers?.length ? (
        <Card className="text-sm text-slate-500">{t("workers.empty")}</Card>
      ) : (
        <ul className="space-y-2">
          {workers.map((w) => (
            <li key={w._id}>
              <Card className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{w.name}</p>
                  <p className="text-xs text-slate-500">
                    {w.active ? t("workers.active") : "—"}
                  </p>
                </div>
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
                  {w.active ? "Off" : "On"}
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
