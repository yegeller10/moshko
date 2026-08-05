import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireAdmin } from "./lib/auth";
import type { Id } from "./_generated/dataModel";

export function computeHours(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const start = sh * 60 + sm;
  let end = eh * 60 + em;
  if (end < start) end += 24 * 60; // overnight
  return Math.round(((end - start) / 60) * 100) / 100;
}

const addonValidator = v.object({
  type: v.union(
    v.literal("car_drive"),
    v.literal("parking"),
    v.literal("other"),
  ),
  amount: v.number(),
  note: v.optional(v.string()),
});

export const list = query({
  args: {
    clientId: v.optional(v.id("clients")),
    workerId: v.optional(v.id("workers")),
    fromDate: v.optional(v.string()),
    toDate: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    let entries;
    if (args.clientId) {
      entries = await ctx.db
        .query("timeEntries")
        .withIndex("by_client_date", (q) => q.eq("clientId", args.clientId!))
        .collect();
    } else {
      entries = await ctx.db.query("timeEntries").withIndex("by_date").collect();
    }

    if (args.workerId) {
      entries = entries.filter((e) => e.workerId === args.workerId);
    }
    if (args.fromDate) {
      entries = entries.filter((e) => e.date >= args.fromDate!);
    }
    if (args.toDate) {
      entries = entries.filter((e) => e.date <= args.toDate!);
    }

    entries.sort((a, b) => b.date.localeCompare(a.date) || b._creationTime - a._creationTime);
    const limited = entries.slice(0, args.limit ?? 200);

    return await Promise.all(
      limited.map(async (entry) => {
        const [worker, client, addons] = await Promise.all([
          ctx.db.get(entry.workerId),
          ctx.db.get(entry.clientId),
          ctx.db
            .query("entryAddons")
            .withIndex("by_entry", (q) => q.eq("entryId", entry._id))
            .collect(),
        ]);
        return { ...entry, worker, client, addons };
      }),
    );
  },
});

export const recent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const entries = await ctx.db
      .query("timeEntries")
      .order("desc")
      .take(args.limit ?? 8);

    return await Promise.all(
      entries.map(async (entry) => {
        const [worker, client] = await Promise.all([
          ctx.db.get(entry.workerId),
          ctx.db.get(entry.clientId),
        ]);
        return { ...entry, worker, client };
      }),
    );
  },
});

export const create = mutation({
  args: {
    workerId: v.id("workers"),
    clientId: v.id("clients"),
    location: v.string(),
    date: v.string(),
    startTime: v.string(),
    endTime: v.string(),
    note: v.optional(v.string()),
    addons: v.optional(v.array(addonValidator)),
  },
  handler: async (ctx, args) => {
    const { user } = await requireAdmin(ctx);
    const hours = computeHours(args.startTime, args.endTime);
    if (hours <= 0) throw new ConvexError("End time must be after start time");

    const entryId = await ctx.db.insert("timeEntries", {
      workerId: args.workerId,
      clientId: args.clientId,
      location: args.location.trim(),
      date: args.date,
      startTime: args.startTime,
      endTime: args.endTime,
      hours,
      note: args.note?.trim() || undefined,
      createdBy: user._id,
      createdAt: Date.now(),
    });

    for (const addon of args.addons ?? []) {
      if (addon.amount <= 0) continue;
      await ctx.db.insert("entryAddons", {
        entryId,
        type: addon.type,
        amount: addon.amount,
        note: addon.note?.trim() || undefined,
      });
    }

    return entryId;
  },
});

export const remove = mutation({
  args: { id: v.id("timeEntries") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const addons = await ctx.db
      .query("entryAddons")
      .withIndex("by_entry", (q) => q.eq("entryId", args.id))
      .collect();
    for (const a of addons) await ctx.db.delete(a._id);
    await ctx.db.delete(args.id);
  },
});

export const createMany = mutation({
  args: {
    rows: v.array(
      v.object({
        workerId: v.id("workers"),
        clientId: v.id("clients"),
        location: v.string(),
        date: v.string(),
        startTime: v.string(),
        endTime: v.string(),
        note: v.optional(v.string()),
        addons: v.optional(v.array(addonValidator)),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { user } = await requireAdmin(ctx);
    const ids: Id<"timeEntries">[] = [];
    for (const row of args.rows) {
      const hours = computeHours(row.startTime, row.endTime);
      if (hours <= 0) continue;
      const entryId = await ctx.db.insert("timeEntries", {
        workerId: row.workerId,
        clientId: row.clientId,
        location: row.location.trim(),
        date: row.date,
        startTime: row.startTime,
        endTime: row.endTime,
        hours,
        note: row.note?.trim() || undefined,
        createdBy: user._id,
        createdAt: Date.now(),
      });
      for (const addon of row.addons ?? []) {
        if (addon.amount <= 0) continue;
        await ctx.db.insert("entryAddons", {
          entryId,
          type: addon.type,
          amount: addon.amount,
          note: addon.note?.trim() || undefined,
        });
      }
      ids.push(entryId);
    }
    return ids;
  },
});
