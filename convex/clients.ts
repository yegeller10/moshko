import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireAdmin } from "./lib/auth";

export const list = query({
  args: { includeInactive: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const all = await ctx.db.query("clients").collect();
    const filtered = args.includeInactive ? all : all.filter((c) => c.active);
    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const get = query({
  args: { id: v.id("clients") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    email: v.optional(v.string()),
    rateMode: v.union(v.literal("hourly"), v.literal("daily")),
    hourlyRate: v.number(),
    dailyRate: v.optional(v.number()),
    extraHourRate: v.optional(v.number()),
    carHourlyRate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const name = args.name.trim();
    if (!name) throw new ConvexError("Name required");
    if (args.hourlyRate < 0) throw new ConvexError("Invalid rate");
    return await ctx.db.insert("clients", {
      name,
      email: args.email?.trim() || undefined,
      rateMode: args.rateMode,
      hourlyRate: args.hourlyRate,
      dailyRate: args.dailyRate,
      extraHourRate: args.extraHourRate,
      carHourlyRate: args.carHourlyRate,
      active: true,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("clients"),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    rateMode: v.optional(v.union(v.literal("hourly"), v.literal("daily"))),
    hourlyRate: v.optional(v.number()),
    dailyRate: v.optional(v.number()),
    extraHourRate: v.optional(v.number()),
    carHourlyRate: v.optional(v.number()),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const { id, ...rest } = args;
    const patch: Record<string, unknown> = {};
    if (rest.name !== undefined) patch.name = rest.name.trim();
    if (rest.email !== undefined) patch.email = rest.email.trim() || undefined;
    if (rest.rateMode !== undefined) patch.rateMode = rest.rateMode;
    if (rest.hourlyRate !== undefined) patch.hourlyRate = rest.hourlyRate;
    if (rest.dailyRate !== undefined) patch.dailyRate = rest.dailyRate;
    if (rest.extraHourRate !== undefined)
      patch.extraHourRate = rest.extraHourRate;
    if (rest.carHourlyRate !== undefined)
      patch.carHourlyRate = rest.carHourlyRate;
    if (rest.active !== undefined) patch.active = rest.active;
    await ctx.db.patch(id, patch);
  },
});
