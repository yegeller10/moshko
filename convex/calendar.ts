import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireAdmin } from "./lib/auth";
import {
  computeJobQuote,
  resolveByEffectiveFrom,
  type ShiftType,
} from "./lib/costs";
import { resolveCityRates } from "./cities";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

const shiftType = v.union(v.literal("normal"), v.literal("saturday"));
const statusType = v.union(
  v.literal("booked"),
  v.literal("approved"),
  v.literal("done"),
  v.literal("cancelled"),
);

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

async function buildQuote(
  ctx: QueryCtx | MutationCtx,
  args: {
    clientId: Id<"clients">;
    cityId?: Id<"cities">;
    date: string;
    plannedWorkHours: number;
    shiftType: ShiftType;
    workerIds: Id<"workers">[];
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
        "No city rates for this job date — edit the city in Settings or re-add rates with an earlier effective date",
      );
    }
    commuteRateOneWay = cityRates.commuteRate;
    carRate = cityRates.carRate;
    cityVersionId = cityRates._id;
  }

  const hourlyRate = client.hourlyRate ?? 100;
  const quote = computeJobQuote({
    workHours: args.plannedWorkHours,
    workersCount: args.workerIds.length,
    shiftType: args.shiftType,
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

export const previewQuote = query({
  args: {
    clientId: v.id("clients"),
    cityId: v.optional(v.id("cities")),
    date: v.string(),
    plannedWorkHours: v.number(),
    shiftType,
    workerIds: v.array(v.id("workers")),
    includeCar: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    try {
      return await buildQuote(ctx, args);
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

    return await Promise.all(
      events.map(async (e) => {
        const [client, city, workers] = await Promise.all([
          ctx.db.get(e.clientId),
          e.cityId ? ctx.db.get(e.cityId) : null,
          Promise.all(e.workerIds.map((id) => ctx.db.get(id))),
        ]);
        return {
          ...e,
          client,
          city,
          workers: workers.filter(Boolean),
        };
      }),
    );
  },
});

export const get = query({
  args: { id: v.id("calendarEvents") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const e = await ctx.db.get(args.id);
    if (!e) return null;
    const [client, city, workers] = await Promise.all([
      ctx.db.get(e.clientId),
      e.cityId ? ctx.db.get(e.cityId) : null,
      Promise.all(e.workerIds.map((id) => ctx.db.get(id))),
    ]);
    return { ...e, client, city, workers: workers.filter(Boolean) };
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    notes: v.optional(v.string()),
    date: v.string(),
    startTime: v.string(),
    endTime: v.string(),
    allDay: v.optional(v.boolean()),
    clientId: v.id("clients"),
    cityId: v.optional(v.id("cities")),
    plannedWorkHours: v.number(),
    shiftType,
    workerIds: v.array(v.id("workers")),
    includeCar: v.boolean(),
    locationText: v.optional(v.string()),
    status: v.optional(statusType),
  },
  handler: async (ctx, args) => {
    const { user } = await requireAdmin(ctx);
    const title = args.title.trim();
    if (!title) throw new ConvexError("Title required");
    if (args.plannedWorkHours <= 0) {
      throw new ConvexError("Work hours must be positive");
    }
    if (args.workerIds.length === 0) {
      throw new ConvexError("Select at least one worker");
    }

    const { rateSnapshot, quote } = await buildQuote(ctx, {
      clientId: args.clientId,
      cityId: args.cityId,
      date: args.date,
      plannedWorkHours: args.plannedWorkHours,
      shiftType: args.shiftType,
      workerIds: args.workerIds,
      includeCar: args.includeCar,
    });

    const now = Date.now();
    return await ctx.db.insert("calendarEvents", {
      title,
      notes: args.notes?.trim() || undefined,
      date: args.date,
      startTime: args.startTime,
      endTime: args.endTime,
      allDay: args.allDay,
      clientId: args.clientId,
      cityId: args.cityId,
      plannedWorkHours: args.plannedWorkHours,
      shiftType: args.shiftType,
      workerIds: args.workerIds,
      includeCar: args.includeCar,
      status: args.status ?? "booked",
      locationText: args.locationText?.trim() || undefined,
      rateSnapshot,
      quote,
      createdBy: user._id,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("calendarEvents"),
    title: v.optional(v.string()),
    notes: v.optional(v.string()),
    date: v.optional(v.string()),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    allDay: v.optional(v.boolean()),
    clientId: v.optional(v.id("clients")),
    cityId: v.optional(v.id("cities")),
    clearCity: v.optional(v.boolean()),
    plannedWorkHours: v.optional(v.number()),
    shiftType: v.optional(shiftType),
    workerIds: v.optional(v.array(v.id("workers"))),
    includeCar: v.optional(v.boolean()),
    locationText: v.optional(v.string()),
    status: v.optional(statusType),
    actualWorkHours: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new ConvexError("Event not found");

    const cityId = args.clearCity
      ? undefined
      : (args.cityId ?? existing.cityId);

    const next = {
      title: args.title !== undefined ? args.title.trim() : existing.title,
      notes:
        args.notes !== undefined
          ? args.notes.trim() || undefined
          : existing.notes,
      date: args.date ?? existing.date,
      startTime: args.startTime ?? existing.startTime,
      endTime: args.endTime ?? existing.endTime,
      allDay: args.allDay ?? existing.allDay,
      clientId: args.clientId ?? existing.clientId,
      cityId,
      plannedWorkHours: args.plannedWorkHours ?? existing.plannedWorkHours,
      shiftType: args.shiftType ?? existing.shiftType,
      workerIds: args.workerIds ?? existing.workerIds,
      includeCar: args.includeCar ?? existing.includeCar,
      locationText:
        args.locationText !== undefined
          ? args.locationText.trim() || undefined
          : existing.locationText,
      status: args.status ?? existing.status,
      actualWorkHours:
        args.actualWorkHours !== undefined
          ? args.actualWorkHours
          : existing.actualWorkHours,
    };

    if (!next.title) throw new ConvexError("Title required");
    if (next.workerIds.length === 0) {
      throw new ConvexError("Select at least one worker");
    }

    const { rateSnapshot, quote } = await buildQuote(ctx, {
      clientId: next.clientId,
      cityId: next.cityId,
      date: next.date,
      plannedWorkHours: next.plannedWorkHours,
      shiftType: next.shiftType,
      workerIds: next.workerIds,
      includeCar: next.includeCar,
    });

    await ctx.db.patch(args.id, {
      ...next,
      rateSnapshot,
      quote,
      updatedAt: Date.now(),
    });
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
    await requireAdmin(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new ConvexError("Event not found");
    assertStatusTransition(existing.status, args.status);
    await ctx.db.patch(args.id, {
      status: args.status,
      updatedAt: Date.now(),
    });
  },
});

/** Jobs available for attaching hours/expenses (approved/done, or quotes for approve-inline). */
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
