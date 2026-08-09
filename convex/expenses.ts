import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireAdmin } from "./lib/auth";
import { round2 } from "./lib/costs";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

async function getRates(ctx: QueryCtx | MutationCtx) {
  const rules = await ctx.db
    .query("rateRules")
    .withIndex("by_key", (q) => q.eq("key", "default"))
    .unique();
  return {
    carHourlyRate: rules?.carHourlyRate ?? 0,
    parkingRate: rules?.parkingRate ?? 0,
    rules,
  };
}

async function requireAttachableJob(
  ctx: QueryCtx | MutationCtx,
  calendarEventId: Id<"calendarEvents">,
) {
  const job = await ctx.db.get(calendarEventId);
  if (!job) throw new ConvexError("Job not found");
  if (job.status !== "approved" && job.status !== "done") {
    throw new ConvexError("Job must be approved before adding expenses");
  }
  return job;
}

export const list = query({
  args: {
    clientId: v.optional(v.id("clients")),
    calendarEventId: v.optional(v.id("calendarEvents")),
    type: v.optional(
      v.union(v.literal("car"), v.literal("parking"), v.literal("other")),
    ),
    fromDate: v.optional(v.string()),
    toDate: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    let rows = args.calendarEventId
      ? await ctx.db
          .query("expenses")
          .withIndex("by_event", (q) =>
            q.eq("calendarEventId", args.calendarEventId!),
          )
          .collect()
      : args.clientId
        ? await ctx.db
            .query("expenses")
            .withIndex("by_client_date", (q) =>
              q.eq("clientId", args.clientId!),
            )
            .collect()
        : await ctx.db.query("expenses").withIndex("by_date").collect();

    if (args.type) rows = rows.filter((r) => r.type === args.type);
    if (args.fromDate) rows = rows.filter((r) => r.date >= args.fromDate!);
    if (args.toDate) rows = rows.filter((r) => r.date <= args.toDate!);
    rows.sort(
      (a, b) =>
        b.date.localeCompare(a.date) || b._creationTime - a._creationTime,
    );
    const limited = rows.slice(0, args.limit ?? 200);
    return await Promise.all(
      limited.map(async (row) => ({
        ...row,
        client: await ctx.db.get(row.clientId),
        job: await ctx.db.get(row.calendarEventId),
      })),
    );
  },
});

export const create = mutation({
  args: {
    calendarEventId: v.id("calendarEvents"),
    type: v.union(v.literal("car"), v.literal("parking"), v.literal("other")),
    date: v.optional(v.string()),
    location: v.optional(v.string()),
    quantity: v.number(),
    unitRate: v.optional(v.number()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireAdmin(ctx);
    if (args.quantity <= 0) throw new ConvexError("Quantity must be positive");

    const job = await requireAttachableJob(ctx, args.calendarEventId);
    const { carHourlyRate, parkingRate } = await getRates(ctx);
    let unitRate = args.unitRate;
    if (unitRate === undefined) {
      if (args.type === "car") unitRate = carHourlyRate;
      else if (args.type === "parking") unitRate = parkingRate;
      else throw new ConvexError("unitRate required for other expenses");
    }
    if (unitRate < 0) throw new ConvexError("Invalid rate");

    const total = round2(args.quantity * unitRate);
    return await ctx.db.insert("expenses", {
      calendarEventId: args.calendarEventId,
      type: args.type,
      clientId: job.clientId,
      date: args.date ?? job.date,
      location: args.location?.trim() || job.locationText || undefined,
      quantity: args.quantity,
      unitRate,
      total,
      note: args.note?.trim() || undefined,
      createdBy: user._id,
      createdAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("expenses") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.id);
  },
});

export const getServiceRates = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const { carHourlyRate, parkingRate, rules } = await getRates(ctx);
    return {
      carHourlyRate,
      parkingRate,
      overtimeConfigured: rules?.overtimeConfigured ?? false,
      bands: rules?.bands ?? [],
    };
  },
});

export const setServiceRates = mutation({
  args: {
    carHourlyRate: v.number(),
    parkingRate: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db
      .query("rateRules")
      .withIndex("by_key", (q) => q.eq("key", "default"))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        carHourlyRate: args.carHourlyRate,
        parkingRate: args.parkingRate,
      });
      return existing._id;
    }
    return await ctx.db.insert("rateRules", {
      key: "default",
      overtimeConfigured: false,
      bands: [
        { label: "100%", multiplier: 1, thresholdHours: null },
        { label: "125%", multiplier: 1.25, thresholdHours: null },
        { label: "150%", multiplier: 1.5, thresholdHours: null },
        { label: "175%", multiplier: 1.75, thresholdHours: null },
        { label: "200%", multiplier: 2, thresholdHours: null },
      ],
      carHourlyRate: args.carHourlyRate,
      parkingRate: args.parkingRate,
    });
  },
});
