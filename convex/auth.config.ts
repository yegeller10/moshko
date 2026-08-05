import type { AuthConfig } from "convex/server";

/**
 * WorkOS AuthKit (User Management) JWTs.
 * Set WORKOS_CLIENT_ID in the Convex dashboard environment variables.
 * In WorkOS dashboard: enable Google only; disable other auth methods.
 */
export default {
  providers: [
    {
      type: "customJwt",
      applicationID: process.env.WORKOS_CLIENT_ID!,
      issuer: `https://api.workos.com/user_management/${process.env.WORKOS_CLIENT_ID}`,
      jwks: `https://api.workos.com/sso/jwks/${process.env.WORKOS_CLIENT_ID}`,
      algorithm: "RS256",
    },
  ],
} satisfies AuthConfig;
