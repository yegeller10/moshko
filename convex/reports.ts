import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./lib/auth";
import {
  buildReportBands,
  DEFAULT_BILLING_RULE,
  type BillingRule,
} from "./lib/costs";
import { workerDisplayName } from "./workers";

function monthRange(yearMonth: string): { from: string; to: string } {
  const [y, m] = yearMonth.split("-").map(Number);
  const from = `${y}-${String(m).padStart(2, "0")}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const to = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

function expenseLabel(type: "car" | "parking" | "other") {
  if (type === "car") return "רכב";
  if (type === "parking") return "חניה";
  return "אחר";
}

export const monthlyClientReport = query({
  args: {
    clientId: v.id("clients"),
    yearMonth: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const client = await ctx.db.get(args.clientId);
    if (!client) return null;

    const { from, to } = monthRange(args.yearMonth);
    const billingRules = await ctx.db.query("billingRules").collect();

    const doneJobs = (
      await ctx.db
        .query("calendarEvents")
        .withIndex("by_client_date", (q) => q.eq("clientId", args.clientId))
        .collect()
    ).filter(
      (e) => e.date >= from && e.date <= to && e.status === "done",
    );

    type LineRow = {
      kind: "worker" | "expense";
      id: string;
      date: string;
      name: string;
      location: string;
      enter: string | null;
      exit: string | null;
      h100: number | null;
      h125: number | null;
      h150: number | null;
      h200: number | null;
      travelH: number | null;
      travelCost: number | null;
      totalH: number | null;
      rate: number | null;
      payment: number;
      jobId: string;
      jobTitle: string;
    };

    const lines: LineRow[] = [];

    for (const job of doneJobs) {
      const ruleDoc =
        billingRules
          .filter((r) => r.effectiveFrom <= job.date)
          .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0] ??
        null;
      const rule: BillingRule = ruleDoc
        ? {
            minBillableHours: ruleDoc.minBillableHours,
            bands: ruleDoc.bands,
            saturdayMultiplier: ruleDoc.saturdayMultiplier,
          }
        : DEFAULT_BILLING_RULE;
      const rate = job.rateSnapshot.clientHourlyRate;

      const entries = await ctx.db
        .query("timeEntries")
        .withIndex("by_event", (q) => q.eq("calendarEventId", job._id))
        .collect();

      for (const entry of entries) {
        const worker = await ctx.db.get(entry.workerId);
        const bands = buildReportBands(
          entry.hours,
          entry.travelHours,
          entry.shiftType,
          rule,
          rate,
        );
        lines.push({
          kind: "worker",
          id: entry._id,
          date: entry.date,
          name: worker ? workerDisplayName(worker) : "—",
          location: entry.location,
          enter: entry.startTime,
          exit: entry.endTime,
          h100: bands.h100,
          h125: bands.h125,
          h150: bands.h150,
          h200: bands.h200,
          travelH: bands.travelHours,
          travelCost: Math.round(bands.travelHours * rate * 100) / 100,
          totalH: bands.totalH,
          rate,
          payment: bands.payment,
          jobId: job._id,
          jobTitle: job.title,
        });
      }

      const expenses = await ctx.db
        .query("expenses")
        .withIndex("by_event", (q) => q.eq("calendarEventId", job._id))
        .collect();

      for (const exp of expenses) {
        lines.push({
          kind: "expense",
          id: exp._id,
          date: exp.date,
          name: expenseLabel(exp.type),
          location: exp.location ?? job.locationText ?? "—",
          enter: null,
          exit: null,
          h100: null,
          h125: null,
          h150: null,
          h200: null,
          travelH: null,
          travelCost: null,
          totalH: null,
          rate: exp.unitRate,
          payment: exp.total,
          jobId: job._id,
          jobTitle: job.title,
        });
      }
    }

    lines.sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.name.localeCompare(b.name, "he"),
    );

    const dates = [...new Set(lines.map((l) => l.date))].sort();
    const groups = dates.map((date) => ({
      date,
      rows: lines.filter((l) => l.date === date),
      dayTotal: lines
        .filter((l) => l.date === date)
        .reduce((s, l) => s + l.payment, 0),
    }));

    const monthTotal = lines.reduce((s, l) => s + l.payment, 0);
    const totalH = lines.reduce((s, l) => s + (l.totalH ?? 0), 0);
    const laborTotal = lines
      .filter((l) => l.kind === "worker")
      .reduce((s, l) => s + l.payment, 0);
    const expenseTotal = lines
      .filter((l) => l.kind === "expense")
      .reduce((s, l) => s + l.payment, 0);

    return {
      client: {
        _id: client._id,
        name: client.name,
        email: client.email,
        hourlyRate: client.hourlyRate,
      },
      yearMonth: args.yearMonth,
      groups,
      rows: lines,
      totalHours: Math.round(totalH * 100) / 100,
      laborTotal: Math.round(laborTotal * 100) / 100,
      expenseTotal: Math.round(expenseTotal * 100) / 100,
      monthTotal: Math.round(monthTotal * 100) / 100,
    };
  },
});

export const clientMonthSummary = query({
  args: {
    clientId: v.id("clients"),
    yearMonth: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const { from, to } = monthRange(args.yearMonth);
    const doneJobs = (
      await ctx.db
        .query("calendarEvents")
        .withIndex("by_client_date", (q) => q.eq("clientId", args.clientId))
        .collect()
    ).filter((e) => e.date >= from && e.date <= to && e.status === "done");

    let laborTotal = 0;
    let expenseTotal = 0;
    let totalHours = 0;
    for (const job of doneJobs) {
      const entries = await ctx.db
        .query("timeEntries")
        .withIndex("by_event", (q) => q.eq("calendarEventId", job._id))
        .collect();
      for (const e of entries) {
        const bands = buildReportBands(
          e.hours,
          e.travelHours,
          e.shiftType,
          DEFAULT_BILLING_RULE,
          job.rateSnapshot.clientHourlyRate,
        );
        laborTotal += bands.payment;
        totalHours += bands.totalH;
      }
      const expenses = await ctx.db
        .query("expenses")
        .withIndex("by_event", (q) => q.eq("calendarEventId", job._id))
        .collect();
      for (const ex of expenses) expenseTotal += ex.total;
    }
    return {
      jobsCount: doneJobs.length,
      totalHours: Math.round(totalHours * 100) / 100,
      laborTotal: Math.round(laborTotal * 100) / 100,
      expenseTotal: Math.round(expenseTotal * 100) / 100,
      monthTotal: Math.round((laborTotal + expenseTotal) * 100) / 100,
    };
  },
});

export const workerMonthSummary = query({
  args: {
    workerId: v.id("workers"),
    yearMonth: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const { from, to } = monthRange(args.yearMonth);
    const entries = (
      await ctx.db
        .query("timeEntries")
        .withIndex("by_worker", (q) => q.eq("workerId", args.workerId))
        .collect()
    ).filter((e) => e.date >= from && e.date <= to);

    let hours = 0;
    let travel = 0;
    let onDoneJobs = 0;
    for (const e of entries) {
      const job = await ctx.db.get(e.calendarEventId);
      if (!job || job.status !== "done") continue;
      onDoneJobs += 1;
      hours += e.hours;
      travel += e.travelHours;
    }
    return {
      entriesCount: onDoneJobs,
      workHours: Math.round(hours * 100) / 100,
      travelHours: Math.round(travel * 100) / 100,
    };
  },
});

export const dashboardStats = query({
  args: { yearMonth: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const { from, to } = monthRange(args.yearMonth);
    const events = (await ctx.db.query("calendarEvents").collect()).filter(
      (e) => e.date >= from && e.date <= to && e.status === "done",
    );
    const expenses = (await ctx.db.query("expenses").collect()).filter(
      (e) => e.date >= from && e.date <= to,
    );
    const entries = (await ctx.db.query("timeEntries").collect()).filter(
      (e) => e.date >= from && e.date <= to,
    );

    const clients = await ctx.db.query("clients").collect();
    const activeClients = clients.filter((c) => c.active !== false).length;

    let totalHours = 0;
    let laborCost = 0;
    for (const e of entries) {
      const job = await ctx.db.get(e.calendarEventId);
      if (!job || job.status !== "done") continue;
      const bands = buildReportBands(
        e.hours,
        e.travelHours,
        e.shiftType,
        DEFAULT_BILLING_RULE,
        job.rateSnapshot.clientHourlyRate,
      );
      totalHours += bands.totalH;
      laborCost += bands.payment;
    }

    let expenseDone = 0;
    const clientIds = new Set<string>();
    for (const e of events) clientIds.add(e.clientId);
    for (const ex of expenses) {
      const job = await ctx.db.get(ex.calendarEventId);
      if (job?.status === "done") {
        expenseDone += ex.total;
        clientIds.add(ex.clientId);
      }
    }

    return {
      yearMonth: args.yearMonth,
      entriesCount: events.length,
      expensesCount: expenses.length,
      totalHours: Math.round(totalHours * 100) / 100,
      totalCost: Math.round((laborCost + expenseDone) * 100) / 100,
      activeClients,
      clientsWithWork: clientIds.size,
    };
  },
});

export const getRateRules = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db
      .query("rateRules")
      .withIndex("by_key", (q) => q.eq("key", "default"))
      .unique();
  },
});

export const updateRateRules = mutation({
  args: {
    overtimeConfigured: v.boolean(),
    bands: v.array(
      v.object({
        label: v.string(),
        multiplier: v.number(),
        thresholdHours: v.union(v.number(), v.null()),
      }),
    ),
    carHourlyRate: v.optional(v.number()),
    parkingRate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db
      .query("rateRules")
      .withIndex("by_key", (q) => q.eq("key", "default"))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        overtimeConfigured: args.overtimeConfigured,
        bands: args.bands,
        ...(args.carHourlyRate !== undefined
          ? { carHourlyRate: args.carHourlyRate }
          : {}),
        ...(args.parkingRate !== undefined
          ? { parkingRate: args.parkingRate }
          : {}),
      });
      return existing._id;
    }
    return await ctx.db.insert("rateRules", {
      key: "default",
      overtimeConfigured: args.overtimeConfigured,
      bands: args.bands,
      carHourlyRate: args.carHourlyRate ?? 0,
      parkingRate: args.parkingRate ?? 0,
    });
  },
});
