import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireAdmin } from "./lib/auth";
import { israelHolidays } from "./lib/israelHolidays";

export const listInRange = query({
  args: {
    fromDate: v.string(),
    toDate: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("calendarLabels").collect();
    return rows
      .filter((r) => r.date >= args.fromDate && r.date <= args.toDate)
      .sort((a, b) => a.date.localeCompare(b.date));
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    date: v.string(),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    allDay: v.boolean(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireAdmin(ctx);
    const title = args.title.trim();
    if (!title) throw new ConvexError("Title required");
    if (!args.allDay && (!args.startTime || !args.endTime)) {
      throw new ConvexError("Start and end time required");
    }
    return await ctx.db.insert("calendarLabels", {
      title,
      date: args.date,
      startTime: args.allDay ? undefined : args.startTime,
      endTime: args.allDay ? undefined : args.endTime,
      allDay: args.allDay,
      kind: "personal",
      notes: args.notes?.trim() || undefined,
      createdBy: user._id,
      createdAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("calendarLabels"),
    title: v.optional(v.string()),
    date: v.optional(v.string()),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    allDay: v.optional(v.boolean()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new ConvexError("Event not found");
    if (existing.kind === "holiday") {
      throw new ConvexError("Holidays cannot be edited");
    }
    const allDay = args.allDay ?? existing.allDay;
    await ctx.db.patch(args.id, {
      title: args.title !== undefined ? args.title.trim() : existing.title,
      date: args.date ?? existing.date,
      allDay,
      startTime: allDay
        ? undefined
        : (args.startTime ?? existing.startTime),
      endTime: allDay ? undefined : (args.endTime ?? existing.endTime),
      notes:
        args.notes !== undefined
          ? args.notes.trim() || undefined
          : existing.notes,
    });
  },
});

export const remove = mutation({
  args: { id: v.id("calendarLabels") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) return;
    if (existing.kind === "holiday") {
      throw new ConvexError("Holidays cannot be deleted");
    }
    await ctx.db.delete(args.id);
  },
});

/** Upsert Israel holidays for the static list (idempotent by holidayKey). */
export const seedHolidays = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await seedHolidaysImpl(ctx);
  },
});

export const seedHolidaysInternal = internalMutation({
  args: {},
  handler: async (ctx) => seedHolidaysImpl(ctx),
});

async function seedHolidaysImpl(ctx: MutationCtx) {
  let inserted = 0;
  for (const h of israelHolidays()) {
    const existing = await ctx.db
      .query("calendarLabels")
      .withIndex("by_holidayKey", (q) => q.eq("holidayKey", h.key))
      .unique();
    if (existing) continue;
    await ctx.db.insert("calendarLabels", {
      title: h.titleHe,
      date: h.date,
      allDay: true,
      kind: "holiday",
      holidayKey: h.key,
      notes: h.titleEn,
      createdAt: Date.now(),
    });
    inserted += 1;
  }
  return { inserted };
}
