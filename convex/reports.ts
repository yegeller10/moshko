import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./lib/auth";

function monthRange(yearMonth: string): { from: string; to: string } {
  const [y, m] = yearMonth.split("-").map(Number);
  const from = `${y}-${String(m).padStart(2, "0")}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const to = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
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

    const events = (
      await ctx.db
        .query("calendarEvents")
        .withIndex("by_client_date", (q) => q.eq("clientId", args.clientId))
        .collect()
    )
      .filter(
        (e) =>
          e.date >= from &&
          e.date <= to &&
          e.status !== "cancelled",
      )
      .sort((a, b) => a.date.localeCompare(b.date));

    const eventRows = events.map((e) => ({
      kind: "job" as const,
      entryId: e._id,
      date: e.date,
      label: e.title,
      location: e.locationText ?? "—",
      detail: `${e.startTime}–${e.endTime} · ${e.plannedWorkHours}h · ${e.workerIds.length} workers`,
      quantity: e.quote.perWorker.billedLaborHours * e.quote.workersCount,
      unit: "h",
      lineTotal: e.quote.grandTotal,
      quote: e.quote,
    }));

    const expenses = await ctx.db
      .query("expenses")
      .withIndex("by_client_date", (q) => q.eq("clientId", args.clientId))
      .collect();

    const expenseRows = expenses
      .filter((e) => e.date >= from && e.date <= to)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((e) => ({
        kind: "expense" as const,
        entryId: e._id,
        date: e.date,
        label:
          e.type === "car" ? "רכב" : e.type === "parking" ? "חניה" : "אחר",
        location: e.location ?? "—",
        detail:
          e.type === "car"
            ? `${e.quantity}h × ${e.unitRate}`
            : `${e.quantity} × ${e.unitRate}`,
        quantity: e.quantity,
        unit: e.type === "car" ? "h" : "u",
        lineTotal: e.total,
        expenseType: e.type,
      }));

    const rows = [...eventRows, ...expenseRows].sort((a, b) =>
      a.date.localeCompare(b.date),
    );

    const jobsTotal = eventRows.reduce((s, r) => s + r.lineTotal, 0);
    const expenseTotal = expenseRows.reduce((s, r) => s + r.lineTotal, 0);
    const totalHours = eventRows.reduce((s, r) => s + r.quantity, 0);

    return {
      client: {
        _id: client._id,
        name: client.name,
        email: client.email,
        hourlyRate: client.hourlyRate,
      },
      yearMonth: args.yearMonth,
      rows,
      totalHours,
      laborTotal: jobsTotal,
      expenseTotal,
      monthTotal: jobsTotal + expenseTotal,
    };
  },
});

export const dashboardStats = query({
  args: { yearMonth: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const { from, to } = monthRange(args.yearMonth);
    const events = (await ctx.db.query("calendarEvents").collect()).filter(
      (e) =>
        e.date >= from && e.date <= to && e.status !== "cancelled",
    );
    const expenses = (await ctx.db.query("expenses").collect()).filter(
      (e) => e.date >= from && e.date <= to,
    );

    const clients = await ctx.db.query("clients").collect();
    const activeClients = clients.filter((c) => c.active !== false).length;

    let jobsCost = 0;
    let totalHours = 0;
    for (const e of events) {
      jobsCost += e.quote.grandTotal;
      totalHours +=
        e.quote.perWorker.billedLaborHours * e.quote.workersCount;
    }

    const expenseCost = expenses.reduce((s, e) => s + e.total, 0);
    const clientIds = new Set([
      ...events.map((e) => e.clientId),
      ...expenses.map((e) => e.clientId),
    ]);

    return {
      yearMonth: args.yearMonth,
      entriesCount: events.length,
      expensesCount: expenses.length,
      totalHours: Math.round(totalHours * 100) / 100,
      totalCost: Math.round((jobsCost + expenseCost) * 100) / 100,
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
