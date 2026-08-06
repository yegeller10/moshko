import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireAdmin } from "./lib/auth";
import type { Id } from "./_generated/dataModel";
import { workerDisplayName } from "./workers";

export function computeHours(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const start = sh * 60 + sm;
  let end = eh * 60 + em;
  if (end < start) end += 24 * 60;
  return Math.round(((end - start) / 60) * 100) / 100;
}

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

    entries.sort(
      (a, b) =>
        b.date.localeCompare(a.date) || b._creationTime - a._creationTime,
    );
    const limited = entries.slice(0, args.limit ?? 200);

    return await Promise.all(
      limited.map(async (entry) => {
        const [workerDoc, client] = await Promise.all([
          ctx.db.get(entry.workerId),
          ctx.db.get(entry.clientId),
        ]);
        const worker = workerDoc
          ? { ...workerDoc, name: workerDisplayName(workerDoc) }
          : null;
        return { ...entry, worker, client };
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
        const [workerDoc, client] = await Promise.all([
          ctx.db.get(entry.workerId),
          ctx.db.get(entry.clientId),
        ]);
        const worker = workerDoc
          ? { ...workerDoc, name: workerDisplayName(workerDoc) }
          : null;
        return { ...entry, worker, client };
      }),
    );
  },
});

const shiftType = v.union(v.literal("normal"), v.literal("saturday"));

export const create = mutation({
  args: {
    workerId: v.id("workers"),
    clientId: v.id("clients"),
    location: v.string(),
    date: v.string(),
    startTime: v.string(),
    endTime: v.string(),
    shiftType,
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireAdmin(ctx);
    const hours = computeHours(args.startTime, args.endTime);
    if (hours <= 0) throw new ConvexError("End time must be after start time");

    return await ctx.db.insert("timeEntries", {
      workerId: args.workerId,
      clientId: args.clientId,
      location: args.location.trim(),
      date: args.date,
      startTime: args.startTime,
      endTime: args.endTime,
      hours,
      shiftType: args.shiftType,
      note: args.note?.trim() || undefined,
      createdBy: user._id,
      createdAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("timeEntries") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
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
      ids.push(entryId);
    }
    return ids;
  },
});
