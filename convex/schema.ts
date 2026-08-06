import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const contactValidator = v.object({
  name: v.string(),
  phone: v.string(),
});

const workerTypeValidator = v.union(
  v.literal("owner"),
  v.literal("employee"),
  v.literal("independent"),
);

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
    /** Legacy / display cache — prefer firstName + lastName */
    name: v.optional(v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    type: v.optional(workerTypeValidator),
    idNumber: v.optional(v.string()),
    birthDate: v.optional(v.string()),
    address: v.optional(v.string()),
    phone: v.optional(v.string()),
    carLicense: v.optional(v.boolean()),
    /** רישיון גובה */
    heightWorkLicense: v.optional(v.boolean()),
    active: v.optional(v.boolean()),
  }).index("by_name", ["name"]),

  clients: defineTable({
    name: v.optional(v.string()),
    contacts: v.optional(v.array(contactValidator)),
    industry: v.optional(v.string()),
    emails: v.optional(v.array(v.string())),
    /** Legacy single email — prefer emails[] */
    email: v.optional(v.string()),
    rateMode: v.optional(v.union(v.literal("hourly"), v.literal("daily"))),
    hourlyRate: v.optional(v.number()),
    dailyRate: v.optional(v.number()),
    extraHourRate: v.optional(v.number()),
    active: v.optional(v.boolean()),
    notes: v.optional(v.string()),
  }).index("by_name", ["name"]),

  timeEntries: defineTable({
    workerId: v.id("workers"),
    clientId: v.id("clients"),
    location: v.string(),
    date: v.string(),
    startTime: v.string(),
    endTime: v.string(),
    hours: v.number(),
    /** סוג משמרת — רגילה / שבת */
    shiftType: v.optional(
      v.union(v.literal("normal"), v.literal("saturday")),
    ),
    note: v.optional(v.string()),
    createdBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_client_date", ["clientId", "date"])
    .index("by_date", ["date"])
    .index("by_worker", ["workerId"]),

  expenses: defineTable({
    type: v.union(
      v.literal("car"),
      v.literal("parking"),
      v.literal("other"),
    ),
    clientId: v.id("clients"),
    date: v.string(),
    location: v.optional(v.string()),
    quantity: v.number(),
    unitRate: v.number(),
    total: v.number(),
    note: v.optional(v.string()),
    createdBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_client_date", ["clientId", "date"])
    .index("by_date", ["date"])
    .index("by_type", ["type"]),

  rateRules: defineTable({
    key: v.literal("default"),
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
  }).index("by_key", ["key"]),
});
