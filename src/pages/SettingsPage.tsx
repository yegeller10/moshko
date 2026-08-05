import { useState } from "react";
import { useAuth } from "@workos-inc/authkit-react";
import { useMutation, useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Id } from "../../convex/_generated/dataModel";

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const { signOut, user } = useAuth();
  const admins = useQuery(api.users.listAdmins);
  const invites = useQuery(api.users.listInvites);
  const rateRules = useQuery(api.reports.getRateRules);
  const inviteAdmin = useMutation(api.users.inviteAdmin);
  const revokeInvite = useMutation(api.users.revokeInvite);
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function onInvite(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      await inviteAdmin({ email: email.trim() });
      setEmail("");
      setMsg("ok");
    } catch {
      setMsg("error");
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">{t("settings.title")}</h2>

      <Card className="space-y-3">
        <Label>{t("settings.language")}</Label>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant={i18n.language === "he" ? "default" : "secondary"}
            onClick={() => void i18n.changeLanguage("he")}
          >
            {t("settings.hebrew")}
          </Button>
          <Button
            type="button"
            variant={i18n.language === "en" ? "default" : "secondary"}
            onClick={() => void i18n.changeLanguage("en")}
          >
            {t("settings.english")}
          </Button>
        </div>
        <p className="text-xs text-slate-500">{user?.email}</p>
        <Button variant="secondary" onClick={() => void signOut()}>
          {t("auth.signOut")}
        </Button>
      </Card>

      <Card className="space-y-3">
        <h3 className="font-semibold">{t("settings.invite")}</h3>
        <form onSubmit={onInvite} className="flex gap-2">
          <Input
            type="email"
            required
            placeholder={t("settings.inviteEmail")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button type="submit">{t("settings.sendInvite")}</Button>
        </form>
        {msg === "ok" && (
          <p className="text-xs text-teal-700">{t("entries.saved")}</p>
        )}
        {msg === "error" && (
          <p className="text-xs text-red-700">{t("common.error")}</p>
        )}
        <div>
          <p className="mb-1 text-sm font-medium">
            {t("settings.pendingInvites")}
          </p>
          <ul className="space-y-1 text-sm">
            {(invites ?? [])
              .filter((i) => i.status === "pending")
              .map((i) => (
                <li
                  key={i._id}
                  className="flex items-center justify-between gap-2"
                >
                  <span>{i.email}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      void revokeInvite({ inviteId: i._id as Id<"invites"> })
                    }
                  >
                    ×
                  </Button>
                </li>
              ))}
          </ul>
        </div>
        <div>
          <p className="mb-1 text-sm font-medium">{t("settings.admins")}</p>
          <ul className="space-y-1 text-sm text-slate-700">
            {(admins ?? []).map((a) => (
              <li key={a._id}>
                {a.email}
                {a.name ? ` (${a.name})` : ""}
              </li>
            ))}
          </ul>
        </div>
      </Card>

      <Card className="space-y-2">
        <h3 className="font-semibold">{t("settings.overtime")}</h3>
        <p className="text-sm text-slate-600">{t("settings.overtimeHint")}</p>
        <ul className="text-sm text-slate-700">
          {(rateRules?.bands ?? [
            { label: "100%", multiplier: 1 },
            { label: "125%", multiplier: 1.25 },
            { label: "150%", multiplier: 1.5 },
            { label: "175%", multiplier: 1.75 },
            { label: "200%", multiplier: 2 },
          ]).map((b) => (
            <li key={b.label}>
              {b.label} × {b.multiplier}
              {"thresholdHours" in b && b.thresholdHours != null
                ? ` @ ${b.thresholdHours}h`
                : " — threshold TBD"}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
