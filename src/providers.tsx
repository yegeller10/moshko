import { AuthKitProvider, useAuth } from "@workos-inc/authkit-react";
import { ConvexProviderWithAuth, ConvexReactClient } from "convex/react";
import { App } from "./App";

const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;
const workosClientId = import.meta.env.VITE_WORKOS_CLIENT_ID as
  | string
  | undefined;
const redirectUri =
  (import.meta.env.VITE_WORKOS_REDIRECT_URI as string | undefined) ||
  `${window.location.origin}/auth/callback`;
const apiHostname =
  (import.meta.env.VITE_WORKOS_API_HOSTNAME as string | undefined) ||
  "api.workos.com";

const convex = new ConvexReactClient(
  convexUrl || "https://placeholder.convex.cloud",
);

function useConvexWorkOSAuth() {
  const { isLoading, user, getAccessToken } = useAuth();
  return {
    isLoading,
    isAuthenticated: !!user,
    fetchAccessToken: async () => {
      try {
        const token = await getAccessToken();
        return token ?? null;
      } catch {
        return null;
      }
    },
  };
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
          <h1 className="text-xl font-bold text-teal-800">Moshko</h1>
          <p className="mt-3 text-sm text-slate-600">
            Missing WorkOS / Convex config. Copy <code>.env.example</code> to{" "}
            <code>.env.local</code> and set real values, then run{" "}
            <code>npx convex dev</code>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <AuthKitProvider
      clientId={workosClientId!}
      redirectUri={redirectUri}
      apiHostname={apiHostname}
    >
      <ConvexProviderWithAuth client={convex} useAuth={useConvexWorkOSAuth}>
        <App />
      </ConvexProviderWithAuth>
    </AuthKitProvider>
  );
}
