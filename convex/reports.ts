import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./lib/auth";
import {
  computeEntryCost,
  type ClientRates,
  type AddonInput,
} from "./lib/costs";

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
    yearMonth: v.string(), // YYYY-MM
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
      rateMode: client.rateMode,
      hourlyRate: client.hourlyRate,
      dailyRate: client.dailyRate,
      extraHourRate: client.extraHourRate,
      carHourlyRate: client.carHourlyRate,
    };

    const rows = await Promise.all(
      inMonth.map(async (entry) => {
        const [worker, addons] = await Promise.all([
          ctx.db.get(entry.workerId),
          ctx.db
            .query("entryAddons")
            .withIndex("by_entry", (q) => q.eq("entryId", entry._id))
            .collect(),
        ]);
        const addonInputs: AddonInput[] = addons.map((a) => ({
          type: a.type,
          amount: a.amount,
          note: a.note,
        }));
        const cost = computeEntryCost(entry.hours, rates, addonInputs);
        return {
          entryId: entry._id,
          date: entry.date,
          workerName: worker?.name ?? "—",
          location: entry.location,
          startTime: entry.startTime,
          endTime: entry.endTime,
          hours: entry.hours,
          addons: addonInputs,
          laborCost: cost.laborCost,
          addonCost: cost.addonCost,
          lineTotal: cost.lineTotal,
        };
      }),
    );

    const monthTotal = rows.reduce((s, r) => s + r.lineTotal, 0);
    const totalHours = rows.reduce((s, r) => s + r.hours, 0);

    return {
      client: {
        _id: client._id,
        name: client.name,
        email: client.email,
        rateMode: client.rateMode,
        hourlyRate: client.hourlyRate,
        dailyRate: client.dailyRate,
        carHourlyRate: client.carHourlyRate,
      },
      yearMonth: args.yearMonth,
      overtimeConfigured: rateRules?.overtimeConfigured ?? false,
      rows,
      totalHours,
      monthTotal,
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

    const clients = await ctx.db.query("clients").collect();
    const activeClients = clients.filter((c) => c.active).length;

    let totalCost = 0;
    let totalHours = 0;

    for (const entry of inMonth) {
      const client = await ctx.db.get(entry.clientId);
      if (!client) continue;
      const addons = await ctx.db
        .query("entryAddons")
        .withIndex("by_entry", (q) => q.eq("entryId", entry._id))
        .collect();
      const cost = computeEntryCost(
        entry.hours,
        {
          rateMode: client.rateMode,
          hourlyRate: client.hourlyRate,
          dailyRate: client.dailyRate,
          extraHourRate: client.extraHourRate,
          carHourlyRate: client.carHourlyRate,
        },
        addons.map((a) => ({ type: a.type, amount: a.amount })),
      );
      totalCost += cost.lineTotal;
      totalHours += entry.hours;
    }

    const clientIds = new Set(inMonth.map((e) => e.clientId));

    return {
      yearMonth: args.yearMonth,
      entriesCount: inMonth.length,
      totalHours: Math.round(totalHours * 100) / 100,
      totalCost: Math.round(totalCost * 100) / 100,
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
      });
      return existing._id;
    }
    return await ctx.db.insert("rateRules", {
      key: "default",
      overtimeConfigured: args.overtimeConfigured,
      bands: args.bands,
    });
  },
});
