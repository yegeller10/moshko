import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./lib/auth";
import { computeLaborCost, type ClientRates } from "./lib/costs";

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

    const rateRules = await ctx.db
      .query("rateRules")
      .withIndex("by_key", (q) => q.eq("key", "default"))
      .unique();

    const { from, to } = monthRange(args.yearMonth);
    const entries = await ctx.db
      .query("timeEntries")
      .withIndex("by_client_date", (q) => q.eq("clientId", args.clientId))
      .collect();

    const inMonth = entries
      .filter((e) => e.date >= from && e.date <= to)
      .sort((a, b) => a.date.localeCompare(b.date));

    const rates: ClientRates = {
      rateMode: client.rateMode ?? "hourly",
      hourlyRate: client.hourlyRate ?? 0,
      dailyRate: client.dailyRate,
      extraHourRate: client.extraHourRate,
    };

    const laborRows = await Promise.all(
      inMonth.map(async (entry) => {
        const workerDoc = await ctx.db.get(entry.workerId);
        const laborCost = computeLaborCost(entry.hours, rates);
        return {
          kind: "labor" as const,
          entryId: entry._id,
          date: entry.date,
          label: workerDoc
            ? [workerDoc.firstName, workerDoc.lastName]
                .filter(Boolean)
                .join(" ")
                .trim() ||
              workerDoc.name ||
              "—"
            : "—",
          location: entry.location,
          detail: `${entry.startTime}–${entry.endTime}`,
          quantity: entry.hours,
          unit: "h",
          lineTotal: laborCost,
        };
      }),
    );

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

    const rows = [...laborRows, ...expenseRows].sort((a, b) =>
      a.date.localeCompare(b.date),
    );

    const laborTotal = laborRows.reduce((s, r) => s + r.lineTotal, 0);
    const expenseTotal = expenseRows.reduce((s, r) => s + r.lineTotal, 0);
    const totalHours = laborRows.reduce((s, r) => s + r.quantity, 0);

    return {
      client: {
        _id: client._id,
        name: client.name,
        email: client.email,
        rateMode: client.rateMode,
        hourlyRate: client.hourlyRate,
        dailyRate: client.dailyRate,
      },
      yearMonth: args.yearMonth,
      overtimeConfigured: rateRules?.overtimeConfigured ?? false,
      rows,
      totalHours,
      laborTotal,
      expenseTotal,
      monthTotal: laborTotal + expenseTotal,
    };
  },
});

export const dashboardStats = query({
  args: { yearMonth: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const { from, to } = monthRange(args.yearMonth);
    const entries = await ctx.db.query("timeEntries").collect();
    const inMonth = entries.filter((e) => e.date >= from && e.date <= to);
    const expenses = (await ctx.db.query("expenses").collect()).filter(
      (e) => e.date >= from && e.date <= to,
    );

    const clients = await ctx.db.query("clients").collect();
    const activeClients = clients.filter((c) => c.active).length;

    let laborCost = 0;
    let totalHours = 0;

    for (const entry of inMonth) {
      const client = await ctx.db.get(entry.clientId);
      if (!client) continue;
      laborCost += computeLaborCost(entry.hours, {
        rateMode: client.rateMode ?? "hourly",
        hourlyRate: client.hourlyRate ?? 0,
        dailyRate: client.dailyRate,
        extraHourRate: client.extraHourRate,
      });
      totalHours += entry.hours;
    }

    const expenseCost = expenses.reduce((s, e) => s + e.total, 0);
    const clientIds = new Set([
      ...inMonth.map((e) => e.clientId),
      ...expenses.map((e) => e.clientId),
    ]);

    return {
      yearMonth: args.yearMonth,
      entriesCount: inMonth.length,
      expensesCount: expenses.length,
      totalHours: Math.round(totalHours * 100) / 100,
      totalCost: Math.round((laborCost + expenseCost) * 100) / 100,
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
