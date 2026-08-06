import { Link } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2 } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Id } from "../../convex/_generated/dataModel";

export function EntriesPage() {
  const { t } = useTranslation();
  const entries = useQuery(api.entries.list, { limit: 100 });
  const remove = useMutation(api.entries.remove);

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl font-bold md:text-2xl">{t("entries.title")}</h2>
        <Button asChild size="sm">
          <Link to="/entries/new">
            <Plus className="h-4 w-4" />
            {t("entries.new")}
          </Link>
        </Button>
      </div>

      {!entries?.length ? (
        <Card className="text-sm text-muted">{t("entries.empty")}</Card>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2">
          {entries.map((e) => (
            <li key={e._id}>
              <Card className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {e.worker?.name} → {e.client?.name}
                  </p>
                  <p className="text-xs text-muted">
                    {e.date} ·{" "}
                    {t(
                      `entries.shiftTypes.${e.shiftType === "saturday" ? "saturday" : "normal"}`,
                    )}{" "}
                    · {e.location} · {e.startTime}–{e.endTime} · {e.hours}h
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("entries.delete")}
                  onClick={() =>
                    void remove({ id: e._id as Id<"timeEntries"> })
                  }
                >
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
