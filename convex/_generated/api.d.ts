/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as billing from "../billing.js";
import type * as bootstrap from "../bootstrap.js";
import type * as calendar from "../calendar.js";
import type * as calendarLabels from "../calendarLabels.js";
import type * as cities from "../cities.js";
import type * as clients from "../clients.js";
import type * as entries from "../entries.js";
import type * as expenses from "../expenses.js";
import type * as import_ from "../import.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_costs from "../lib/costs.js";
import type * as lib_israelHolidays from "../lib/israelHolidays.js";
import type * as reports from "../reports.js";
import type * as users from "../users.js";
import type * as workers from "../workers.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  billing: typeof billing;
  bootstrap: typeof bootstrap;
  calendar: typeof calendar;
  calendarLabels: typeof calendarLabels;
  cities: typeof cities;
  clients: typeof clients;
  entries: typeof entries;
  expenses: typeof expenses;
  import: typeof import_;
  "lib/auth": typeof lib_auth;
  "lib/costs": typeof lib_costs;
  "lib/israelHolidays": typeof lib_israelHolidays;
  reports: typeof reports;
  users: typeof users;
  workers: typeof workers;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
