import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireAdmin } from "./lib/auth";
import {
  assignmentSpan,
  computeHours,
  computeJobQuoteFromAssignments,
  resolveByEffectiveFrom,
  type ShiftType,
} from "./lib/costs";
import { resolveCityRates } from "./cities";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { workerDisplayName } from "./workers";

const shiftType = v.union(v.literal("normal"), v.literal("saturday"));
const statusType = v.union(
  v.literal("booked"),
  v.literal("approved"),
  v.literal("done"),
  v.literal("cancelled"),
);

const assignmentValidator = v.object({
  workerId: v.id("workers"),
  startTime: v.string(),
  endTime: v.string(),
  shiftType,
  travelHours: v.number(),
});

const draftChargeValidator = v.object({
  title: v.string(),
  amount: v.number(),
  note: v.optional(v.string()),
  kind: v.union(v.literal("parking"), v.literal("other")),
});

type Assignment = {
  workerId: Id<"workers">;
  startTime: string;
  endTime: string;
  shiftType: ShiftType;
  travelHours: number;
};

type DraftCharge = {
  title: string;
  amount: number;
  note?: string;
  kind: "parking" | "other";
};

function assertStatusTransition(
  from: "booked" | "approved" | "done" | "cancelled",
  to: "booked" | "approved" | "done" | "cancelled",
) {
  const ok =
    (from === "booked" && (to === "approved" || to === "cancelled")) ||
    (from === "approved" &&
      (to === "done" || to === "booked" || to === "cancelled")) ||
    (from === "done" && (to === "approved" || to === "cancelled")) ||
    (from === "cancelled" && to === "booked");
  if (!ok) {
    throw new ConvexError(`Invalid status change: ${from} → ${to}`);
  }
}

export function normalizeAssignments(e: Doc<"calendarEvents">): Assignment[] {
  if (e.workerAssignments && e.workerAssignments.length > 0) {
    return e.workerAssignments.map((a) => ({
      workerId: a.workerId,
      startTime: a.startTime,
      endTime: a.endTime,
      shiftType: a.shiftType,
      travelHours: a.travelHours,
    }));
  }
  return e.workerIds.map((workerId) => ({
    workerId,
    startTime: e.startTime,
    endTime: e.endTime,
    shiftType: e.shiftType,
    travelHours: 0,
  }));
}

function validateAssignments(assignments: Assignment[]) {
  if (assignments.length === 0) {
    throw new ConvexError("Select at least one worker");
  }
  const seen = new Set<string>();
  for (const a of assignments) {
    if (seen.has(a.workerId)) {
      throw new ConvexError("Duplicate worker on job");
    }
    seen.add(a.workerId);
    if (computeHours(a.startTime, a.endTime) <= 0) {
      throw new ConvexError("Each worker needs a positive hour range");
    }
    if (a.travelHours < 0) {
      throw new ConvexError("Travel hours cannot be negative");
    }
  }
}

async function buildQuoteFromAssignments(
  ctx: QueryCtx | MutationCtx,
  args: {
    clientId: Id<"clients">;
    cityId?: Id<"cities">;
    date: string;
    assignments: Assignment[];
    includeCar: boolean;
  },
) {
  const client = await ctx.db.get(args.clientId);
  if (!client) throw new ConvexError("Client not found");

  if (args.includeCar && !args.cityId) {
    throw new ConvexError("City required when car is included");
  }

  const rules = await ctx.db.query("billingRules").collect();
  const ruleDoc = resolveByEffectiveFrom(rules, args.date);
  if (!ruleDoc) {
    throw new ConvexError(
      "No billing rule for date — add one in Settings first",
    );
  }

  let commuteRateOneWay = 0;
  let carRate = 0;
  let cityVersionId: Id<"cityRateVersions"> | undefined;

  if (args.cityId) {
    const city = await ctx.db.get(args.cityId);
    if (!city) throw new ConvexError("City not found");
    const cityRates = await resolveCityRates(ctx, args.cityId, args.date);
    if (!cityRates) {
      throw new ConvexError(
        "No city rates for this job date — edit the city on the Cities page",
      );
    }
    commuteRateOneWay = cityRates.commuteRate;
    carRate = cityRates.carRate;
    cityVersionId = cityRates._id;
  }

  const hourlyRate = client.hourlyRate ?? 100;
  const quote = computeJobQuoteFromAssignments({
    assignments: args.assignments,
    hourlyRate,
    rule: {
      minBillableHours: ruleDoc.minBillableHours,
      bands: ruleDoc.bands,
      saturdayMultiplier: ruleDoc.saturdayMultiplier,
    },
    commuteRateOneWay,
    includeCar: args.includeCar,
    carRate,
  });

  return {
    rateSnapshot: {
      clientHourlyRate: hourlyRate,
      billingRuleId: ruleDoc._id,
      cityVersionId,
      effectiveDate: args.date,
    },
    quote,
  };
}

async function materializeAssignments(
  ctx: MutationCtx,
  job: Doc<"calendarEvents">,
  assignments: Assignment[],
  userId: Id<"users">,
) {
  const existing = await ctx.db
    .query("timeEntries")
    .withIndex("by_event", (q) => q.eq("calendarEventId", job._id))
    .collect();
  const byWorker = new Map(existing.map((e) => [e.workerId, e]));
  const location = job.locationText?.trim() || "—";

  for (const a of assignments) {
    const hours = computeHours(a.startTime, a.endTime);
    const prev = byWorker.get(a.workerId);
    if (prev) {
      await ctx.db.patch(prev._id, {
        date: job.date,
        clientId: job.clientId,
        location: prev.location || location,
        startTime: a.startTime,
        endTime: a.endTime,
        hours,
        travelHours: a.travelHours,
        shiftType: a.shiftType,
      });
      byWorker.delete(a.workerId);
    } else {
      await ctx.db.insert("timeEntries", {
        calendarEventId: job._id,
        workerId: a.workerId,
        clientId: job.clientId,
        location,
        date: job.date,
        startTime: a.startTime,
        endTime: a.endTime,
        hours,
        travelHours: a.travelHours,
        shiftType: a.shiftType,
        createdBy: userId,
        createdAt: Date.now(),
      });
    }
  }
}

async function materializeDraftCharges(
  ctx: MutationCtx,
  job: Doc<"calendarEvents">,
  charges: DraftCharge[],
  userId: Id<"users">,
) {
  if (!charges.length) return;
  const existing = await ctx.db
    .query("expenses")
    .withIndex("by_event", (q) => q.eq("calendarEventId", job._id))
    .collect();
  // Only add draft charges once (skip if any parking/other already from drafts)
  const hasDrafted = existing.some(
    (e) => e.type === "parking" || e.type === "other",
  );
  if (hasDrafted) return;

  for (const c of charges) {
    const amount = Math.max(0, c.amount);
    if (amount <= 0) continue;
    const title =
      c.title.trim() || (c.kind === "parking" ? "parking" : "other");
    await ctx.db.insert("expenses", {
      calendarEventId: job._id,
      type: c.kind,
      clientId: job.clientId,
      date: job.date,
      location: job.locationText || undefined,
      quantity: 1,
      unitRate: amount,
      total: amount,
      note: [title, c.note?.trim()].filter(Boolean).join(" — ") || undefined,
      createdBy: userId,
      createdAt: Date.now(),
    });
  }
}

async function materializeJob(
  ctx: MutationCtx,
  job: Doc<"calendarEvents">,
  assignments: Assignment[],
  userId: Id<"users">,
) {
  await materializeAssignments(ctx, job, assignments, userId);
  await materializeDraftCharges(
    ctx,
    job,
    (job.draftCharges ?? []) as DraftCharge[],
    userId,
  );
}

async function enrichJob(ctx: QueryCtx, e: Doc<"calendarEvents">) {
  const assignments = normalizeAssignments(e);
  const [client, city, workers, timeEntries, expenses] = await Promise.all([
    ctx.db.get(e.clientId),
    e.cityId ? ctx.db.get(e.cityId) : null,
    Promise.all(assignments.map((a) => ctx.db.get(a.workerId))),
    ctx.db
      .query("timeEntries")
      .withIndex("by_event", (q) => q.eq("calendarEventId", e._id))
      .collect(),
    ctx.db
      .query("expenses")
      .withIndex("by_event", (q) => q.eq("calendarEventId", e._id))
      .collect(),
  ]);

  const entriesEnriched = await Promise.all(
    timeEntries.map(async (entry) => {
      const w = await ctx.db.get(entry.workerId);
      return {
        ...entry,
        workerName: w ? workerDisplayName(w) : "—",
      };
    }),
  );

  return {
    ...e,
    workerAssignments: assignments,
    workerIds: assignments.map((a) => a.workerId),
    client,
    city,
    workers: workers.filter(Boolean),
    linkedEntries: entriesEnriched,
    linkedExpenses: expenses,
  };
}

export const previewQuote = query({
  args: {
    clientId: v.id("clients"),
    cityId: v.optional(v.id("cities")),
    date: v.string(),
    workerAssignments: v.array(assignmentValidator),
    includeCar: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    try {
      return await buildQuoteFromAssignments(ctx, {
        clientId: args.clientId,
        cityId: args.cityId,
        date: args.date,
        assignments: args.workerAssignments,
        includeCar: args.includeCar,
      });
    } catch (e) {
      if (e instanceof ConvexError) return { error: e.data as string };
      throw e;
    }
  },
});

export const listInRange = query({
  args: {
    fromDate: v.string(),
    toDate: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const all = await ctx.db.query("calendarEvents").collect();
    const events = all
      .filter(
        (e) =>
          e.date >= args.fromDate &&
          e.date <= args.toDate &&
          e.status !== "cancelled",
      )
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          a.startTime.localeCompare(b.startTime),
      );

    return await Promise.all(events.map((e) => enrichJob(ctx, e)));
  },
});

export const listOpen = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const all = await ctx.db.query("calendarEvents").collect();
    const events = all
      .filter((e) => e.status === "booked" || e.status === "approved")
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          a.startTime.localeCompare(b.startTime),
      );
    return await Promise.all(events.map((e) => enrichJob(ctx, e)));
  },
});

export const get = query({
  args: { id: v.id("calendarEvents") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const e = await ctx.db.get(args.id);
    if (!e) return null;
    return await enrichJob(ctx, e);
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    notes: v.optional(v.string()),
    date: v.string(),
    allDay: v.optional(v.boolean()),
    clientId: v.id("clients"),
    cityId: v.optional(v.id("cities")),
    workerAssignments: v.array(assignmentValidator),
    includeCar: v.boolean(),
    locationText: v.optional(v.string()),
    draftCharges: v.optional(v.array(draftChargeValidator)),
    status: v.optional(statusType),
  },
  handler: async (ctx, args) => {
    const { user } = await requireAdmin(ctx);
    const title = args.title.trim();
    if (!title) throw new ConvexError("Title required");
    validateAssignments(args.workerAssignments);

    const span = assignmentSpan(args.workerAssignments);
    const { rateSnapshot, quote } = await buildQuoteFromAssignments(ctx, {
      clientId: args.clientId,
      cityId: args.cityId,
      date: args.date,
      assignments: args.workerAssignments,
      includeCar: args.includeCar,
    });

    const now = Date.now();
    const status = args.status ?? "booked";
    const draftCharges = (args.draftCharges ?? [])
      .map((c) => ({
        ...c,
        title: c.title.trim() || (c.kind === "parking" ? "parking" : "other"),
      }))
      .filter((c) => c.amount > 0);
    const id = await ctx.db.insert("calendarEvents", {
      title,
      notes: args.notes?.trim() || undefined,
      date: args.date,
      startTime: span.startTime,
      endTime: span.endTime,
      allDay: args.allDay,
      clientId: args.clientId,
      cityId: args.cityId,
      plannedWorkHours: span.plannedWorkHours,
      shiftType: args.workerAssignments[0]!.shiftType,
      workerIds: args.workerAssignments.map((a) => a.workerId),
      workerAssignments: args.workerAssignments,
      includeCar: args.includeCar,
      status,
      locationText: args.locationText?.trim() || undefined,
      draftCharges: draftCharges.length ? draftCharges : undefined,
      rateSnapshot,
      quote,
      createdBy: user._id,
      createdAt: now,
      updatedAt: now,
    });

    if (status === "approved" || status === "done") {
      const job = await ctx.db.get(id);
      if (job) {
        await materializeJob(ctx, job, args.workerAssignments, user._id);
      }
    }

    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("calendarEvents"),
    title: v.optional(v.string()),
    notes: v.optional(v.string()),
    date: v.optional(v.string()),
    allDay: v.optional(v.boolean()),
    clientId: v.optional(v.id("clients")),
    cityId: v.optional(v.id("cities")),
    clearCity: v.optional(v.boolean()),
    workerAssignments: v.optional(v.array(assignmentValidator)),
    includeCar: v.optional(v.boolean()),
    locationText: v.optional(v.string()),
    draftCharges: v.optional(v.array(draftChargeValidator)),
    status: v.optional(statusType),
    actualWorkHours: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireAdmin(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new ConvexError("Event not found");

    const cityId = args.clearCity
      ? undefined
      : (args.cityId ?? existing.cityId);

    const assignments =
      args.workerAssignments ?? normalizeAssignments(existing);
    validateAssignments(assignments);
    const span = assignmentSpan(assignments);

    const draftCharges =
      args.draftCharges !== undefined
        ? args.draftCharges
            .map((c) => ({
              ...c,
              title:
                c.title.trim() || (c.kind === "parking" ? "parking" : "other"),
            }))
            .filter((c) => c.amount > 0)
        : existing.draftCharges;

    const next = {
      title: args.title !== undefined ? args.title.trim() : existing.title,
      notes:
        args.notes !== undefined
          ? args.notes.trim() || undefined
          : existing.notes,
      date: args.date ?? existing.date,
      startTime: span.startTime,
      endTime: span.endTime,
      allDay: args.allDay ?? existing.allDay,
      clientId: args.clientId ?? existing.clientId,
      cityId,
      plannedWorkHours: span.plannedWorkHours,
      shiftType: assignments[0]!.shiftType,
      workerIds: assignments.map((a) => a.workerId),
      workerAssignments: assignments,
      includeCar: args.includeCar ?? existing.includeCar,
      locationText:
        args.locationText !== undefined
          ? args.locationText.trim() || undefined
          : existing.locationText,
      draftCharges:
        draftCharges && draftCharges.length > 0 ? draftCharges : undefined,
      status: args.status ?? existing.status,
      actualWorkHours:
        args.actualWorkHours !== undefined
          ? args.actualWorkHours
          : existing.actualWorkHours,
    };

    if (!next.title) throw new ConvexError("Title required");

    const { rateSnapshot, quote } = await buildQuoteFromAssignments(ctx, {
      clientId: next.clientId,
      cityId: next.cityId,
      date: next.date,
      assignments,
      includeCar: next.includeCar,
    });

    await ctx.db.patch(args.id, {
      ...next,
      rateSnapshot,
      quote,
      updatedAt: Date.now(),
    });

    if (next.status === "approved" || next.status === "done") {
      const job = await ctx.db.get(args.id);
      if (job) {
        await materializeJob(ctx, job, assignments, user._id);
      }
    }
  },
});

export const remove = mutation({
  args: { id: v.id("calendarEvents") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.id, {
      status: "cancelled",
      updatedAt: Date.now(),
    });
  },
});

export const setStatus = mutation({
  args: {
    id: v.id("calendarEvents"),
    status: statusType,
  },
  handler: async (ctx, args) => {
    const { user } = await requireAdmin(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new ConvexError("Event not found");
    assertStatusTransition(existing.status, args.status);
    await ctx.db.patch(args.id, {
      status: args.status,
      updatedAt: Date.now(),
    });
    if (args.status === "approved" || args.status === "done") {
      const job = await ctx.db.get(args.id);
      if (job) {
        await materializeJob(
          ctx,
          job,
          normalizeAssignments(job),
          user._id,
        );
      }
    }
  },
});

export const listForAttach = query({
  args: {
    clientId: v.optional(v.id("clients")),
    fromDate: v.optional(v.string()),
    toDate: v.optional(v.string()),
    includeQuotes: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    let rows = args.clientId
      ? await ctx.db
          .query("calendarEvents")
          .withIndex("by_client_date", (q) => q.eq("clientId", args.clientId!))
          .collect()
      : await ctx.db.query("calendarEvents").collect();

    const includeQuotes = args.includeQuotes !== false;
    rows = rows.filter((e) => {
      if (e.status === "cancelled") return false;
      if (e.status === "booked") return includeQuotes;
      return e.status === "approved" || e.status === "done";
    });
    if (args.fromDate) rows = rows.filter((e) => e.date >= args.fromDate!);
    if (args.toDate) rows = rows.filter((e) => e.date <= args.toDate!);
    rows.sort(
      (a, b) =>
        b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime),
    );

    return await Promise.all(
      rows.slice(0, 100).map(async (e) => {
        const client = await ctx.db.get(e.clientId);
        return {
          _id: e._id,
          title: e.title,
          date: e.date,
          startTime: e.startTime,
          endTime: e.endTime,
          status: e.status,
          clientId: e.clientId,
          clientName: client?.name ?? "—",
          locationText: e.locationText,
          cityId: e.cityId,
          workerIds: e.workerIds,
          shiftType: e.shiftType,
          rateSnapshot: e.rateSnapshot,
        };
      }),
    );
  },
});
