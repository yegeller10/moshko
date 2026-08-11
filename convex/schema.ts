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

const shiftTypeValidator = v.union(
  v.literal("normal"),
  v.literal("saturday"),
);

const jobStatusValidator = v.union(
  v.literal("booked"),
  v.literal("approved"),
  v.literal("done"),
  v.literal("cancelled"),
);

const billingBandValidator = v.object({
  upToHours: v.union(v.number(), v.null()),
  multiplier: v.number(),
});

const quoteLineValidator = v.object({
  fromHour: v.number(),
  toHour: v.number(),
  hours: v.number(),
  multiplier: v.number(),
  amount: v.number(),
  kind: v.union(
    v.literal("labor"),
    v.literal("pad"),
    v.literal("saturday"),
    v.literal("commute"),
  ),
});

const perWorkerQuoteValidator = v.object({
  workHours: v.number(),
  billedLaborHours: v.number(),
  laborCost: v.number(),
  commuteRoundTrip: v.number(),
  absorbedCommute: v.number(),
  remainingCommute: v.number(),
  commuteCost: v.number(),
  lines: v.array(quoteLineValidator),
});

const quoteSnapshotValidator = v.object({
  workersCount: v.number(),
  perWorker: perWorkerQuoteValidator,
  laborTotal: v.number(),
  commuteHoursTotal: v.number(),
  commuteCost: v.number(),
  carCost: v.number(),
  grandTotal: v.number(),
});

const rateSnapshotValidator = v.object({
  clientHourlyRate: v.number(),
  billingRuleId: v.id("billingRules"),
  cityVersionId: v.optional(v.id("cityRateVersions")),
  effectiveDate: v.string(),
});

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
    name: v.optional(v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    type: v.optional(workerTypeValidator),
    idNumber: v.optional(v.string()),
    birthDate: v.optional(v.string()),
    address: v.optional(v.string()),
    phone: v.optional(v.string()),
    carLicense: v.optional(v.boolean()),
    heightWorkLicense: v.optional(v.boolean()),
    hourlyRate: v.optional(v.number()),
    minimumHours: v.optional(v.number()),
    active: v.optional(v.boolean()),
  }).index("by_name", ["name"]),

  clients: defineTable({
    name: v.optional(v.string()),
    contacts: v.optional(v.array(contactValidator)),
    industry: v.optional(v.string()),
    emails: v.optional(v.array(v.string())),
    email: v.optional(v.string()),
    hourlyRate: v.optional(v.number()),
    active: v.optional(v.boolean()),
    notes: v.optional(v.string()),
  }).index("by_name", ["name"]),

  billingRules: defineTable({
    effectiveFrom: v.string(),
    minBillableHours: v.number(),
    bands: v.array(billingBandValidator),
    saturdayMultiplier: v.number(),
    createdAt: v.number(),
    createdBy: v.id("users"),
  }).index("by_effectiveFrom", ["effectiveFrom"]),

  cities: defineTable({
    name: v.string(),
    active: v.boolean(),
  }).index("by_name", ["name"]),

  cityRateVersions: defineTable({
    cityId: v.id("cities"),
    effectiveFrom: v.string(),
    carRate: v.number(),
    commuteRate: v.number(),
    createdAt: v.number(),
    createdBy: v.id("users"),
  })
    .index("by_city", ["cityId"])
    .index("by_city_effectiveFrom", ["cityId", "effectiveFrom"]),

  calendarEvents: defineTable({
    title: v.string(),
    notes: v.optional(v.string()),
    date: v.string(),
    startTime: v.string(),
    endTime: v.string(),
    allDay: v.optional(v.boolean()),
    clientId: v.id("clients"),
    cityId: v.optional(v.id("cities")),
    plannedWorkHours: v.number(),
    actualWorkHours: v.optional(v.number()),
    shiftType: shiftTypeValidator,
    workerIds: v.array(v.id("workers")),
    workerAssignments: v.optional(
      v.array(
        v.object({
          workerId: v.id("workers"),
          startTime: v.string(),
          endTime: v.string(),
          shiftType: shiftTypeValidator,
          travelHours: v.number(),
        }),
      ),
    ),
    includeCar: v.boolean(),
    status: jobStatusValidator,
    locationText: v.optional(v.string()),
    draftCharges: v.optional(
      v.array(
        v.object({
          title: v.string(),
          amount: v.number(),
          note: v.optional(v.string()),
          kind: v.union(v.literal("parking"), v.literal("other")),
        }),
      ),
    ),
    googleCalendarId: v.optional(v.string()),
    googleEventId: v.optional(v.string()),
    syncedAt: v.optional(v.number()),
    rateSnapshot: rateSnapshotValidator,
    quote: quoteSnapshotValidator,
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_date", ["date"])
    .index("by_client_date", ["clientId", "date"])
    .index("by_status", ["status"]),

  /** Non-job labels: Israel holidays + personal events. Never billed. */
  calendarLabels: defineTable({
    title: v.string(),
    date: v.string(),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    allDay: v.boolean(),
    kind: v.union(v.literal("holiday"), v.literal("personal")),
    notes: v.optional(v.string()),
    holidayKey: v.optional(v.string()),
    createdBy: v.optional(v.id("users")),
    createdAt: v.number(),
  })
    .index("by_date", ["date"])
    .index("by_kind", ["kind"])
    .index("by_holidayKey", ["holidayKey"]),

  timeEntries: defineTable({
    calendarEventId: v.id("calendarEvents"),
    workerId: v.id("workers"),
    clientId: v.id("clients"),
    location: v.string(),
    date: v.string(),
    startTime: v.string(),
    endTime: v.string(),
    hours: v.number(),
    travelHours: v.number(),
    shiftType: shiftTypeValidator,
    note: v.optional(v.string()),
    createdBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_client_date", ["clientId", "date"])
    .index("by_date", ["date"])
    .index("by_worker", ["workerId"])
    .index("by_event", ["calendarEventId"]),

  expenses: defineTable({
    calendarEventId: v.id("calendarEvents"),
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
    .index("by_type", ["type"])
    .index("by_event", ["calendarEventId"]),

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
