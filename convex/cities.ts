import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireAdmin } from "./lib/auth";
import { resolveByEffectiveFrom } from "./lib/costs";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

export async function resolveCityRates(
  ctx: QueryCtx | MutationCtx,
  cityId: Id<"cities">,
  date: string,
) {
  const versions = await ctx.db
    .query("cityRateVersions")
    .withIndex("by_city", (q) => q.eq("cityId", cityId))
    .collect();
  const forDate = resolveByEffectiveFrom(versions, date);
  if (forDate) return forDate;
  // Fallback: earliest version (covers quick-add cities whose effectiveFrom
  // was after the job date).
  if (versions.length === 0) return null;
  return [...versions].sort((a, b) =>
    a.effectiveFrom.localeCompare(b.effectiveFrom),
  )[0];
}

export const list = query({
  args: { includeInactive: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const cities = await ctx.db.query("cities").collect();
    const filtered = args.includeInactive
      ? cities
      : cities.filter((c) => c.active);
    const today = new Date().toISOString().slice(0, 10);
    return await Promise.all(
      filtered
        .sort((a, b) => a.name.localeCompare(b.name, "he"))
        .map(async (city) => {
          const rates = await resolveCityRates(ctx, city._id, today);
          return { ...city, currentRates: rates };
        }),
    );
  },
});

export const listVersions = query({
  args: { cityId: v.id("cities") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const versions = await ctx.db
      .query("cityRateVersions")
      .withIndex("by_city", (q) => q.eq("cityId", args.cityId))
      .collect();
    return versions.sort((a, b) =>
      b.effectiveFrom.localeCompare(a.effectiveFrom),
    );
  },
});

export const ratesForDate = query({
  args: { cityId: v.id("cities"), date: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await resolveCityRates(ctx, args.cityId, args.date);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    effectiveFrom: v.string(),
    carRate: v.number(),
    commuteRate: v.number(),
  },
  handler: async (ctx, args) => {
    const { user } = await requireAdmin(ctx);
    const name = args.name.trim();
    if (!name) throw new ConvexError("City name required");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.effectiveFrom)) {
      throw new ConvexError("Invalid effectiveFrom date");
    }
    const cityId = await ctx.db.insert("cities", { name, active: true });
    await ctx.db.insert("cityRateVersions", {
      cityId,
      effectiveFrom: args.effectiveFrom,
      carRate: args.carRate,
      commuteRate: args.commuteRate,
      createdAt: Date.now(),
      createdBy: user._id,
    });
    return cityId;
  },
});

export const addRateVersion = mutation({
  args: {
    cityId: v.id("cities"),
    effectiveFrom: v.string(),
    carRate: v.number(),
    commuteRate: v.number(),
  },
  handler: async (ctx, args) => {
    const { user } = await requireAdmin(ctx);
    const city = await ctx.db.get(args.cityId);
    if (!city) throw new ConvexError("City not found");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.effectiveFrom)) {
      throw new ConvexError("Invalid effectiveFrom date");
    }
    return await ctx.db.insert("cityRateVersions", {
      cityId: args.cityId,
      effectiveFrom: args.effectiveFrom,
      carRate: args.carRate,
      commuteRate: args.commuteRate,
      createdAt: Date.now(),
      createdBy: user._id,
    });
  },
});

export const setActive = mutation({
  args: { id: v.id("cities"), active: v.boolean() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.id, { active: args.active });
  },
});

export const rename = mutation({
  args: { id: v.id("cities"), name: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const name = args.name.trim();
    if (!name) throw new ConvexError("City name required");
    await ctx.db.patch(args.id, { name });
  },
});
