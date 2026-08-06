import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireAdmin } from "./lib/auth";
import { DEFAULT_BILLING_RULE, resolveByEffectiveFrom } from "./lib/costs";

const bandValidator = v.object({
  upToHours: v.union(v.number(), v.null()),
  multiplier: v.number(),
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const all = await ctx.db.query("billingRules").collect();
    return all.sort((a, b) =>
      b.effectiveFrom.localeCompare(a.effectiveFrom),
    );
  },
});

export const forDate = query({
  args: { date: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const all = await ctx.db.query("billingRules").collect();
    return resolveByEffectiveFrom(all, args.date);
  },
});

export const createVersion = mutation({
  args: {
    effectiveFrom: v.string(),
    minBillableHours: v.number(),
    bands: v.array(bandValidator),
    saturdayMultiplier: v.number(),
  },
  handler: async (ctx, args) => {
    const { user } = await requireAdmin(ctx);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.effectiveFrom)) {
      throw new ConvexError("Invalid effectiveFrom date");
    }
    if (args.minBillableHours <= 0) {
      throw new ConvexError("minBillableHours must be positive");
    }
    if (args.bands.length === 0) {
      throw new ConvexError("At least one band required");
    }
    return await ctx.db.insert("billingRules", {
      effectiveFrom: args.effectiveFrom,
      minBillableHours: args.minBillableHours,
      bands: args.bands,
      saturdayMultiplier: args.saturdayMultiplier,
      createdAt: Date.now(),
      createdBy: user._id,
    });
  },
});

export const seedIfEmpty = mutation({
  args: {},
  handler: async (ctx) => {
    const { user } = await requireAdmin(ctx);
    const existing = await ctx.db.query("billingRules").collect();
    if (existing.length > 0) return { created: false };
    await ctx.db.insert("billingRules", {
      effectiveFrom: "1970-01-01",
      minBillableHours: DEFAULT_BILLING_RULE.minBillableHours,
      bands: DEFAULT_BILLING_RULE.bands,
      saturdayMultiplier: DEFAULT_BILLING_RULE.saturdayMultiplier,
      createdAt: Date.now(),
      createdBy: user._id,
    });
    return { created: true };
  },
});
