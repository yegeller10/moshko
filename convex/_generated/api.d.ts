/* eslint-disable */
/**
 * Generated stub for CI / local typecheck without `npx convex dev`.
 * Replace by running `npx convex dev` once a deployment is linked.
 */
import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as clients from "../clients";
import type * as entries from "../entries";
import type * as importMod from "../import";
import type * as reports from "../reports";
import type * as users from "../users";
import type * as workers from "../workers";

declare const fullApi: ApiFromModules<{
  clients: typeof clients;
  entries: typeof entries;
  import: typeof importMod;
  reports: typeof reports;
  users: typeof users;
  workers: typeof workers;
}>;

export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
