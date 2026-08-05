import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@workos-inc/authkit-react";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";

/**
 * Stay on /auth/callback until AuthKit finishes exchanging ?code=.
 * Do not redirect away while the query string still has a code.
 */
export function AuthCallbackPage() {
  const { t } = useTranslation();
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading) return;
    const params = new URLSearchParams(window.location.search);
    if (params.has("code")) return; // AuthKit still handling
    navigate(user ? "/" : "/login", { replace: true });
  }, [isLoading, user, navigate]);

  return (
    <div
      className="grid min-h-dvh w-full place-items-center overflow-x-hidden px-4 py-8"
      dir="ltr"
    >
      <Card className="w-full max-w-sm space-y-3 text-center" dir="rtl">
        <h1 className="text-2xl font-bold text-ink">{t("appName")}</h1>
        <p className="text-sm text-slate-600">{t("auth.checking")}</p>
      </Card>
    </div>
  );
}
