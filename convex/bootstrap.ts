import { internalMutation } from "./_generated/server";
import { israelHolidays } from "./lib/israelHolidays";

/** After wipe: holidays + default billing + parking/car rates. */
export const bootstrapDefaultsInternal = internalMutation({
  args: {},
  handler: async (ctx) => {
    let holidays = 0;
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
      holidays += 1;
    }

    const rules = await ctx.db.query("billingRules").collect();
    let billingRuleId = rules[0]?._id;
    if (!billingRuleId) {
      const users = await ctx.db.query("users").collect();
      const admin = users.find((u) => u.status === "active") ?? users[0];
      if (admin) {
        billingRuleId = await ctx.db.insert("billingRules", {
          effectiveFrom: "2020-01-01",
          minBillableHours: 8,
          bands: [
            { upToHours: 8, multiplier: 1 },
            { upToHours: 10, multiplier: 1.25 },
            { upToHours: null, multiplier: 1.5 },
          ],
          saturdayMultiplier: 2,
          createdAt: Date.now(),
          createdBy: admin._id,
        });
      }
    }

    const rateRules = await ctx.db
      .query("rateRules")
      .withIndex("by_key", (q) => q.eq("key", "default"))
      .unique();
    if (!rateRules) {
      await ctx.db.insert("rateRules", {
        key: "default",
        overtimeConfigured: true,
        bands: [
          { label: "100%", multiplier: 1, thresholdHours: 8 },
          { label: "125%", multiplier: 1.25, thresholdHours: 10 },
          { label: "150%", multiplier: 1.5, thresholdHours: null },
          { label: "200%", multiplier: 2, thresholdHours: null },
        ],
        carHourlyRate: 50,
        parkingRate: 40,
      });
    }

    return { holidays, billingRuleId: billingRuleId ?? null };
  },
});
