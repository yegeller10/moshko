import { useEffect, useRef, useState } from "react";
import { useAuth } from "@workos-inc/authkit-react";
import { useConvexAuth, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type AccessState = "idle" | "checking" | "ok" | "denied" | "error";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { user, isLoading: workosLoading, signIn, signOut } = useAuth();
  const { isLoading: convexLoading, isAuthenticated } = useConvexAuth();
  const ensureAccess = useMutation(api.users.ensureAccess);
  const [access, setAccess] = useState<AccessState>("idle");
  const [reason, setReason] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const ranForUser = useRef<string | null>(null);

  useEffect(() => {
    if (workosLoading || convexLoading) return;
    if (!user) {
      ranForUser.current = null;
      setAccess("idle");
      return;
    }
    if (!isAuthenticated) {
      // WorkOS session exists but Convex JWT not ready/valid yet — do not
      // keep a stale "ok" from an earlier token.
      ranForUser.current = null;
      setAccess("checking");
      return;
    }
    if (ranForUser.current === user.id) return;

    let cancelled = false;
    setAccess("checking");

    void (async () => {
      try {
        const result = await ensureAccess({
          workosUserId: user.id,
          email: user.email,
          name:
            [user.firstName, user.lastName].filter(Boolean).join(" ") ||
            undefined,
        });
        if (cancelled) return;
        if (result.status === "ok") {
          ranForUser.current = user.id;
          setAccess("ok");
          setReason(null);
          setErrorDetail(null);
        } else {
          ranForUser.current = null;
          setAccess("denied");
          setReason(result.reason ?? "not_invited");
        }
      } catch (e) {
        if (cancelled) return;
        console.error(e);
        ranForUser.current = null;
        setAccess("error");
        setErrorDetail(e instanceof Error ? e.message : String(e));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, workosLoading, convexLoading, isAuthenticated, ensureAccess]);

  // Keep a stable shell while auth clients initialize (avoids "flash then blank")
  if (workosLoading) {
    return (
      <Centered>
        <Card className="w-full max-w-sm space-y-3 text-center">
          <h1 className="text-2xl font-bold text-ink">{t("appName")}</h1>
          <p className="text-sm text-slate-600">{t("common.loading")}</p>
        </Card>
      </Centered>
    );
  }

  if (!user) {
    return (
      <Centered>
        <Card className="w-full max-w-sm space-y-4 text-center">
          <div>
            <h1 className="text-2xl font-bold text-ink">{t("appName")}</h1>
            <p className="mt-1 text-sm text-slate-500">{t("auth.loginTitle")}</p>
          </div>
          <p className="text-sm text-slate-600">{t("auth.loginHint")}</p>
          <Button className="w-full" size="lg" onClick={() => void signIn()}>
            {t("auth.signInGoogle")}
          </Button>
        </Card>
      </Centered>
    );
  }

  if (
    convexLoading ||
    !isAuthenticated ||
    access === "checking" ||
    access === "idle"
  ) {
    return (
      <Centered>
        <Card className="w-full max-w-sm space-y-3 text-center">
          <h1 className="text-2xl font-bold text-ink">{t("appName")}</h1>
          <p className="text-sm text-slate-600">{t("auth.checking")}</p>
        </Card>
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
          {(reason || errorDetail) && (
            <p className="break-words text-xs text-slate-400">
              {reason || errorDetail}
            </p>
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
    <div
      className="grid min-h-dvh w-full place-items-center overflow-x-hidden px-4 py-8"
      dir="ltr"
    >
      <div className="w-full max-w-sm" dir="rtl">
        {children}
      </div>
    </div>
  );
}
