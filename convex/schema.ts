import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    workosUserId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    role: v.literal("admin"),
    status: v.union(v.literal("active"), v.literal("disabled")),
    invitedBy: v.optional(v.id("users")),
  })
    .index("by_workosUserId", ["workosUserId"])
    .index("by_email", ["email"]),

  invites: defineTable({
    email: v.string(),
    invitedBy: v.id("users"),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("revoked"),
    ),
    createdAt: v.number(),
  }).index("by_email", ["email"]),

  workers: defineTable({
    name: v.string(),
    active: v.boolean(),
  }).index("by_name", ["name"]),

  clients: defineTable({
    name: v.string(),
    email: v.optional(v.string()),
    rateMode: v.union(v.literal("hourly"), v.literal("daily")),
    hourlyRate: v.number(),
    dailyRate: v.optional(v.number()),
    extraHourRate: v.optional(v.number()),
    carHourlyRate: v.optional(v.number()),
    active: v.boolean(),
  }).index("by_name", ["name"]),

  timeEntries: defineTable({
    workerId: v.id("workers"),
    clientId: v.id("clients"),
    location: v.string(),
    date: v.string(), // YYYY-MM-DD
    startTime: v.string(), // HH:mm
    endTime: v.string(), // HH:mm
    hours: v.number(),
    note: v.optional(v.string()),
    createdBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_client_date", ["clientId", "date"])
    .index("by_date", ["date"])
    .index("by_worker", ["workerId"]),

  entryAddons: defineTable({
    entryId: v.id("timeEntries"),
    type: v.union(
      v.literal("car_drive"),
      v.literal("parking"),
      v.literal("other"),
    ),
    // car_drive: hours; parking/other: money amount
    amount: v.number(),
    note: v.optional(v.string()),
  }).index("by_entry", ["entryId"]),

  rateRules: defineTable({
    key: v.literal("default"),
    overtimeConfigured: v.boolean(),
    bands: v.array(
      v.object({
        label: v.string(),
        multiplier: v.number(),
        // null until user provides thresholds
        thresholdHours: v.union(v.number(), v.null()),
      }),
    ),
  }).index("by_key", ["key"]),
});
