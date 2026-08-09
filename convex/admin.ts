import { internalMutation, mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { requireAdmin } from "./lib/auth";

const WIPE_TABLES = [
  "timeEntries",
  "expenses",
  "calendarLabels",
  "calendarEvents",
  "cityRateVersions",
  "cities",
  "billingRules",
  "workers",
  "clients",
  "rateRules",
  "invites",
] as const;

async function wipeAll(ctx: MutationCtx) {
  const counts: Record<string, number> = {};
  for (const table of WIPE_TABLES) {
    const rows = await ctx.db.query(table).collect();
    counts[table] = rows.length;
    for (const row of rows) {
      await ctx.db.delete(row._id);
    }
  }
  return { ok: true as const, counts };
}

/** Destructive: clears all business data. Keeps users. */
export const wipeNonUserData = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await wipeAll(ctx);
  },
});

/** CLI bootstrap (no auth): `npx convex run admin:wipeNonUserDataInternal` */
export const wipeNonUserDataInternal = internalMutation({
  args: {},
  handler: async (ctx) => wipeAll(ctx),
});
