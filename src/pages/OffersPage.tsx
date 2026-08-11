import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatMoney } from "@/lib/costs";
import { cn } from "@/lib/utils";

function statusClass(status: string) {
  if (status === "accepted") return "bg-emerald-100 text-emerald-800";
  if (status === "sent") return "bg-sky-100 text-sky-800";
  if (status === "disputed") return "bg-amber-100 text-amber-900";
  if (status === "cancelled") return "bg-red-100 text-red-800";
  return "bg-zinc-100 text-zinc-700";
}

export function OffersPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "he" ? "he-IL" : "en-IL";
  const offers = useQuery(api.offers.list, { limit: 100 });

  return (
    <div className="w-full max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold md:text-2xl">{t("offers.titleList")}</h2>
        <Button asChild variant="secondary">
          <Link to="/quotes">{t("nav.quotes")}</Link>
        </Button>
      </div>

      {offers === undefined ? (
        <p className="text-sm text-muted">{t("common.loading")}</p>
      ) : offers.length === 0 ? (
        <Card className="p-6 text-sm text-muted">{t("offers.empty")}</Card>
      ) : (
        <ul className="space-y-2">
          {offers.map((o) => (
            <li key={o._id}>
              <Link
                to={`/offers/${o._id}`}
                className="block rounded-2xl border border-border bg-white px-4 py-3 transition hover:border-brand/40"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">
                    #{o.number} · {o.clientName}
                  </p>
                  <span
                    className={cn(
                      "rounded-lg px-2 py-0.5 text-xs font-semibold",
                      statusClass(o.status),
                    )}
                  >
                    {t(`offers.status.${o.status}`)}
                  </span>
                </div>
                <p className="text-sm text-muted">{o.title}</p>
                <p className="text-sm text-muted">
                  {o.dates.join(", ") || "—"} ·{" "}
                  {formatMoney(o.grandTotal, locale)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
