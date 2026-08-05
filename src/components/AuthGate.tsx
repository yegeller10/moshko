import { useEffect, useState } from "react";
import { useAuth } from "@workos-inc/authkit-react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type AccessState = "checking" | "ok" | "denied" | "error";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { user, isLoading, signIn, signOut } = useAuth();
  const ensureAccess = useMutation(api.users.ensureAccess);
  const [access, setAccess] = useState<AccessState>("checking");
  const [reason, setReason] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (isLoading) return;
      if (!user) {
        setAccess("checking");
        return;
      }
      setAccess("checking");
      try {
        const result = await ensureAccess({
          workosUserId: user.id,
          email: user.email,
          name:
            [user.firstName, user.lastName].filter(Boolean).join(" ") ||
            undefined,
        });
        if (cancelled) return;
        if (result.status === "ok") setAccess("ok");
        else {
          setAccess("denied");
          setReason(result.reason ?? "not_invited");
        }
      } catch (e) {
        if (cancelled) return;
        console.error(e);
        setAccess("error");
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [user, isLoading, ensureAccess]);

  if (isLoading) {
    return (
      <Centered>
        <p className="text-slate-600">{t("common.loading")}</p>
      </Centered>
    );
  }

  if (!user) {
    return (
      <Centered>
        <Card className="w-full max-w-sm space-y-4 text-center">
          <div>
            <h1 className="text-2xl font-bold text-teal-800">{t("appName")}</h1>
            <p className="mt-1 text-sm text-slate-500">{t("auth.loginTitle")}</p>
          </div>
          <p className="text-sm text-slate-600">{t("auth.loginHint")}</p>
          <Button
            className="w-full"
            size="lg"
            onClick={() => void signIn()}
          >
            {t("auth.signInGoogle")}
          </Button>
        </Card>
      </Centered>
    );
  }

  if (access === "checking") {
    return (
      <Centered>
        <p className="text-slate-600">{t("auth.checking")}</p>
      </Centered>
    );
  }

  if (access === "denied" || access === "error") {
    return (
      <Centered>
        <Card className="w-full max-w-sm space-y-4 text-center">
          <p className="text-slate-700">
            {access === "denied" ? t("auth.notInvited") : t("common.error")}
          </p>
          {reason && (
            <p className="text-xs text-slate-400">{reason}</p>
          )}
          <Button variant="secondary" onClick={() => void signOut()}>
            {t("auth.signOut")}
          </Button>
        </Card>
      </Centered>
    );
  }

  return <>{children}</>;
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      {children}
    </div>
  );
}
