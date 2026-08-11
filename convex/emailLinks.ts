import { mutation, query, internalMutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireAdmin } from "./lib/auth";
import { materializeJobForClient, normalizeAssignments } from "./calendar";
import { workerDisplayName } from "./workers";

const linkKind = v.union(v.literal("quote"), v.literal("order"));
const LINK_TTL_MS = 1000 * 60 * 60 * 24 * 21; // 21 days

export const createForSend = internalMutation({
  args: {
    jobId: v.id("calendarEvents"),
    kind: linkKind,
    toEmail: v.string(),
    token: v.string(),
    createdBy: v.id("users"),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) throw new ConvexError("Job not found");
    if (job.status === "cancelled") {
      throw new ConvexError("Cannot email a cancelled job");
    }
    if (args.kind === "quote" && job.status !== "booked") {
      throw new ConvexError("Quote email is only for booked jobs");
    }
    if (args.kind === "order" && job.status !== "approved") {
      throw new ConvexError("Order confirmation is only for approved jobs");
    }

    const email = args.toEmail.trim().toLowerCase();
    if (!email.includes("@")) throw new ConvexError("Invalid email");

    // Revoke prior pending links for same job+kind
    const existing = await ctx.db
      .query("emailLinks")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .collect();
    const now = Date.now();
    for (const link of existing) {
      if (link.kind === args.kind && link.status === "pending") {
        await ctx.db.patch(link._id, { status: "revoked" });
      }
    }

    const id = await ctx.db.insert("emailLinks", {
      token: args.token,
      jobId: args.jobId,
      kind: args.kind,
      toEmail: email,
      status: "pending",
      expiresAt: now + LINK_TTL_MS,
      createdAt: now,
      createdBy: args.createdBy,
    });

    const client = await ctx.db.get(job.clientId);
    const draftTotal = (job.draftCharges ?? []).reduce(
      (sum, c) => sum + (c.amount > 0 ? c.amount : 0),
      0,
    );
    const grand = (job.quote?.grandTotal ?? 0) + draftTotal;
    const assignments = normalizeAssignments(job);
    const workers = await Promise.all(
      assignments.map(async (a) => {
        const w = await ctx.db.get(a.workerId);
        return {
          name: w ? workerDisplayName(w) : "—",
          startTime: a.startTime,
          endTime: a.endTime,
          travelHours: a.travelHours,
        };
      }),
    );

    return {
      linkId: id,
      expiresAt: now + LINK_TTL_MS,
      summary: {
        clientName: client?.name ?? "—",
        date: job.date,
        location: job.locationText ?? "",
        startTime: job.startTime,
        endTime: job.endTime,
        includeCar: job.includeCar,
        laborTotal: job.quote?.laborTotal ?? 0,
        commuteCost: job.quote?.commuteCost ?? 0,
        carCost: job.quote?.carCost ?? 0,
        draftCharges: job.draftCharges ?? [],
        grandTotal: grand,
        workers,
      },
    };
  },
});

export const markSent = internalMutation({
  args: {
    linkId: v.id("emailLinks"),
    resendId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.linkId, {
      resendId: args.resendId,
    });
  },
});

export const getByToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const token = args.token.trim();
    if (!token) return null;
    const link = await ctx.db
      .query("emailLinks")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    if (!link) return null;

    const job = await ctx.db.get(link.jobId);
    if (!job) return null;
    const client = await ctx.db.get(job.clientId);
    const draftTotal = (job.draftCharges ?? []).reduce(
      (sum, c) => sum + (c.amount > 0 ? c.amount : 0),
      0,
    );
    const grand = (job.quote?.grandTotal ?? 0) + draftTotal;
    const assignments = normalizeAssignments(job);
    const workers = await Promise.all(
      assignments.map(async (a) => {
        const w = await ctx.db.get(a.workerId);
        return {
          name: w ? workerDisplayName(w) : "—",
          startTime: a.startTime,
          endTime: a.endTime,
          shiftType: a.shiftType,
          travelHours: a.travelHours,
        };
      }),
    );

    const expired = Date.now() > link.expiresAt;
    const open = link.status === "pending" && !expired;

    return {
      kind: link.kind,
      status: expired && link.status === "pending" ? "expired" : link.status,
      open,
      toEmail: link.toEmail,
      expiresAt: link.expiresAt,
      disputeNote: link.disputeNote,
      job: {
        date: job.date,
        locationText: job.locationText,
        startTime: job.startTime,
        endTime: job.endTime,
        includeCar: job.includeCar,
        status: job.status,
        clientName: client?.name ?? "—",
        laborTotal: job.quote?.laborTotal ?? 0,
        commuteCost: job.quote?.commuteCost ?? 0,
        carCost: job.quote?.carCost ?? 0,
        draftCharges: job.draftCharges ?? [],
        grandTotal: grand,
        workers,
        clientDecision: job.clientDecision,
        clientDecisionNote: job.clientDecisionNote,
      },
    };
  },
});

export const respond = mutation({
  args: {
    token: v.string(),
    decision: v.union(v.literal("accepted"), v.literal("disputed")),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const link = await ctx.db
      .query("emailLinks")
      .withIndex("by_token", (q) => q.eq("token", args.token.trim()))
      .unique();
    if (!link) throw new ConvexError("Link not found");
    if (link.status !== "pending") {
      throw new ConvexError("Link already used");
    }
    if (Date.now() > link.expiresAt) {
      throw new ConvexError("Link expired");
    }

    const job = await ctx.db.get(link.jobId);
    if (!job) throw new ConvexError("Job not found");
    if (job.status === "cancelled") {
      throw new ConvexError("Job cancelled");
    }

    const now = Date.now();
    const note = args.note?.trim() || undefined;

    if (args.decision === "disputed") {
      await ctx.db.patch(link._id, {
        status: "disputed",
        disputeNote: note,
        respondedAt: now,
      });
      await ctx.db.patch(job._id, {
        clientDecision: "disputed",
        clientDecisionNote: note,
        clientDecisionAt: now,
        clientDecisionEmail: link.toEmail,
        updatedAt: now,
      });
      return { ok: true as const, decision: "disputed" as const };
    }

    await ctx.db.patch(link._id, {
      status: "accepted",
      respondedAt: now,
    });
    await ctx.db.patch(job._id, {
      clientDecision: "accepted",
      clientDecisionNote: undefined,
      clientDecisionAt: now,
      clientDecisionEmail: link.toEmail,
      updatedAt: now,
    });

    // Quote accept → approve job (materialize hours/charges)
    if (link.kind === "quote" && job.status === "booked") {
      await ctx.db.patch(job._id, {
        status: "approved",
        updatedAt: now,
      });
      const refreshed = await ctx.db.get(job._id);
      if (refreshed) {
        await materializeJobForClient(ctx, refreshed);
      }
    }

    return { ok: true as const, decision: "accepted" as const };
  },
});

export const listForJob = query({
  args: { jobId: v.id("calendarEvents") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const rows = await ctx.db
      .query("emailLinks")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .collect();
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  },
});
