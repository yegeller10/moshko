import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireAdmin } from "./lib/auth";
import type { Doc, Id } from "./_generated/dataModel";
import { workerDisplayName } from "./workers";
import { resolveCityRates } from "./cities";

export function computeHours(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const start = sh * 60 + sm;
  let end = eh * 60 + em;
  if (end < start) end += 24 * 60;
  return Math.round(((end - start) / 60) * 100) / 100;
}

async function requireAttachableJob(
  ctx: QueryCtx | MutationCtx,
  calendarEventId: Id<"calendarEvents">,
): Promise<Doc<"calendarEvents">> {
  const job = await ctx.db.get(calendarEventId);
  if (!job) throw new ConvexError("Job not found");
  if (job.status !== "approved" && job.status !== "done") {
    throw new ConvexError("Job must be approved before adding hours");
  }
  return job;
}

export const list = query({
  args: {
    clientId: v.optional(v.id("clients")),
    workerId: v.optional(v.id("workers")),
    calendarEventId: v.optional(v.id("calendarEvents")),
    fromDate: v.optional(v.string()),
    toDate: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    let entries;
    if (args.calendarEventId) {
      entries = await ctx.db
        .query("timeEntries")
        .withIndex("by_event", (q) =>
          q.eq("calendarEventId", args.calendarEventId!),
        )
        .collect();
    } else if (args.clientId) {
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
        const [workerDoc, client, job] = await Promise.all([
          ctx.db.get(entry.workerId),
          ctx.db.get(entry.clientId),
          ctx.db.get(entry.calendarEventId),
        ]);
        const worker = workerDoc
          ? { ...workerDoc, name: workerDisplayName(workerDoc) }
          : null;
        return { ...entry, worker, client, job };
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
    calendarEventId: v.id("calendarEvents"),
    workerId: v.id("workers"),
    location: v.optional(v.string()),
    date: v.optional(v.string()),
    startTime: v.string(),
    endTime: v.string(),
    shiftType: v.optional(shiftType),
    travelHours: v.optional(v.number()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireAdmin(ctx);
    const job = await requireAttachableJob(ctx, args.calendarEventId);
    const hours = computeHours(args.startTime, args.endTime);
    if (hours <= 0) throw new ConvexError("End time must be after start time");

    let travelHours = args.travelHours;
    if (travelHours === undefined) {
      travelHours = 0;
      if (job.cityId) {
        const rates = await resolveCityRates(
          ctx,
          job.cityId,
          args.date ?? job.date,
        );
        if (rates) travelHours = rates.commuteRate * 2;
      }
    }

    return await ctx.db.insert("timeEntries", {
      calendarEventId: args.calendarEventId,
      workerId: args.workerId,
      clientId: job.clientId,
      location: (args.location ?? job.locationText ?? "").trim() || "—",
      date: args.date ?? job.date,
      startTime: args.startTime,
      endTime: args.endTime,
      hours,
      travelHours: Math.max(0, travelHours),
      shiftType: args.shiftType ?? job.shiftType,
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
        calendarEventId: v.id("calendarEvents"),
        workerId: v.id("workers"),
        location: v.optional(v.string()),
        date: v.optional(v.string()),
        startTime: v.string(),
        endTime: v.string(),
        travelHours: v.optional(v.number()),
        shiftType: v.optional(shiftType),
        note: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { user } = await requireAdmin(ctx);
    const ids: Id<"timeEntries">[] = [];
    for (const row of args.rows) {
      const job = await requireAttachableJob(ctx, row.calendarEventId);
      const hours = computeHours(row.startTime, row.endTime);
      if (hours <= 0) continue;
      let travelHours = row.travelHours ?? 0;
      if (row.travelHours === undefined && job.cityId) {
        const rates = await resolveCityRates(
          ctx,
          job.cityId,
          row.date ?? job.date,
        );
        if (rates) travelHours = rates.commuteRate * 2;
      }
      const entryId = await ctx.db.insert("timeEntries", {
        calendarEventId: row.calendarEventId,
        workerId: row.workerId,
        clientId: job.clientId,
        location: (row.location ?? job.locationText ?? "").trim() || "—",
        date: row.date ?? job.date,
        startTime: row.startTime,
        endTime: row.endTime,
        hours,
        travelHours: Math.max(0, travelHours),
        shiftType: row.shiftType ?? job.shiftType,
        note: row.note?.trim() || undefined,
        createdBy: user._id,
        createdAt: Date.now(),
      });
      ids.push(entryId);
    }
    return ids;
  },
});
