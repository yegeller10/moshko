import { useTranslation } from "react-i18next";
import { useAuth } from "@workos-inc/authkit-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function LoginPage() {
  const { t } = useTranslation();
  const { signIn, isLoading } = useAuth();

  return (
    <div
      className="grid min-h-dvh w-full place-items-center overflow-x-hidden px-4 py-8"
      dir="ltr"
    >
      <Card className="w-full max-w-sm space-y-4 text-center" dir="rtl">
        <div>
          <h1 className="text-2xl font-bold text-ink">{t("appName")}</h1>
          <p className="mt-1 text-sm text-slate-500">{t("auth.loginTitle")}</p>
        </div>
        <p className="text-sm text-slate-600">{t("auth.loginHint")}</p>
        <Button
          className="w-full"
          size="lg"
          disabled={isLoading}
          onClick={() => void signIn()}
        >
          {t("auth.signInGoogle")}
        </Button>
      </Card>
    </div>
  );
}
