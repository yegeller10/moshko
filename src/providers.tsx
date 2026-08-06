import { AuthKitProvider, useAuth } from "@workos-inc/authkit-react";
import { ConvexProviderWithAuth, ConvexReactClient } from "convex/react";
import { useCallback, useMemo } from "react";
import { App } from "./App";

const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;
const workosClientId = import.meta.env.VITE_WORKOS_CLIENT_ID as
  | string
  | undefined;
const apiHostname =
  (import.meta.env.VITE_WORKOS_API_HOSTNAME as string | undefined) ||
  "api.workos.com";

/**
 * Without a WorkOS custom auth domain, AuthKit cannot use HTTP-only cookies on
 * api.workos.com (third-party cookie blocked). devMode stores the refresh token
 * in localStorage so authenticate / getAccessToken work on localhost and Pages.
 * Set VITE_WORKOS_DEV_MODE=false only after a custom auth domain is configured.
 */
const workosDevMode =
  import.meta.env.VITE_WORKOS_DEV_MODE !== "false";

const convex = new ConvexReactClient(
  convexUrl || "https://placeholder.convex.cloud",
);

function useConvexWorkOSAuth() {
  const { isLoading, user, getAccessToken } = useAuth();

  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      try {
        const token = await getAccessToken({
          forceRefresh: forceRefreshToken,
        });
        return token ?? null;
      } catch (err) {
        console.warn("[auth] getAccessToken failed", err);
        return null;
      }
    },
    [getAccessToken],
  );

  return useMemo(
    () => ({
      isLoading,
      isAuthenticated: !!user,
      fetchAccessToken,
    }),
    [isLoading, user, fetchAccessToken],
  );
}

export function Root() {
  const configOk =
    Boolean(convexUrl) &&
    Boolean(workosClientId) &&
    !convexUrl?.includes("your-deployment") &&
    !workosClientId?.includes("your_workos");

  if (!configOk) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-4">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-xl font-bold text-ink">Moshko</h1>
          <p className="mt-3 text-sm text-slate-600">
            Missing WorkOS / Convex config. Copy <code>.env.example</code> to{" "}
            <code>.env.local</code> and set real values, then run{" "}
            <code>npx convex dev</code>.
          </p>
        </div>
      </div>
    );
  }

  // Match the current origin so localhost and Pages both work (both must be
  // registered in the WorkOS dashboard Redirects).
  const redirectUri = `${window.location.origin}/auth/callback`;

  return (
    <AuthKitProvider
      clientId={workosClientId!}
      redirectUri={redirectUri}
      apiHostname={apiHostname}
      devMode={workosDevMode}
      onRedirectCallback={() => {
        // AuthKit already cleaned the URL; send user into the app shell.
        if (window.location.pathname.startsWith("/auth/")) {
          window.history.replaceState({}, "", "/");
        }
      }}
    >
      <ConvexProviderWithAuth client={convex} useAuth={useConvexWorkOSAuth}>
        <App />
      </ConvexProviderWithAuth>
    </AuthKitProvider>
  );
}
