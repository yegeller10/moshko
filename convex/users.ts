import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireAdmin } from "./lib/auth";

const DEFAULT_BANDS = [
  { label: "100%", multiplier: 1, thresholdHours: null as number | null },
  { label: "125%", multiplier: 1.25, thresholdHours: null },
  { label: "150%", multiplier: 1.5, thresholdHours: null },
  { label: "175%", multiplier: 1.75, thresholdHours: null },
  { label: "200%", multiplier: 2, thresholdHours: null },
];

/**
 * After WorkOS Google login: bootstrap first admin, or accept invite, else deny.
 */
export const ensureAccess = mutation({
  args: {
    workosUserId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Unauthenticated");
    }
    if (identity.subject !== args.workosUserId) {
      throw new ConvexError("Identity mismatch");
    }

    const email = args.email.toLowerCase().trim();
    const existing = await ctx.db
      .query("users")
      .withIndex("by_workosUserId", (q) =>
        q.eq("workosUserId", args.workosUserId),
      )
      .unique();

    if (existing) {
      if (existing.status !== "active") {
        return { status: "denied" as const, reason: "disabled" };
      }
      return { status: "ok" as const, userId: existing._id };
    }

    const byEmail = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (byEmail) {
      await ctx.db.patch(byEmail._id, {
        workosUserId: args.workosUserId,
        name: args.name ?? byEmail.name,
        status: "active",
      });
      return { status: "ok" as const, userId: byEmail._id };
    }

    const allUsers = await ctx.db.query("users").take(1);
    const isFirstUser = allUsers.length === 0;

    if (isFirstUser) {
      const userId = await ctx.db.insert("users", {
        workosUserId: args.workosUserId,
        email,
        name: args.name,
        role: "admin",
        status: "active",
      });

      const existingRules = await ctx.db
        .query("rateRules")
        .withIndex("by_key", (q) => q.eq("key", "default"))
        .unique();
      if (!existingRules) {
        await ctx.db.insert("rateRules", {
          key: "default",
          overtimeConfigured: false,
          bands: DEFAULT_BANDS,
        });
      }

      return { status: "ok" as const, userId, firstAdmin: true };
    }

    const invite = await ctx.db
      .query("invites")
      .withIndex("by_email", (q) => q.eq("email", email))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();

    if (!invite) {
      return { status: "denied" as const, reason: "not_invited" };
    }

    const userId = await ctx.db.insert("users", {
      workosUserId: args.workosUserId,
      email,
      name: args.name,
      role: "admin",
      status: "active",
      invitedBy: invite.invitedBy,
    });
    await ctx.db.patch(invite._id, { status: "accepted" });
    return { status: "ok" as const, userId };
  },
});

export const me = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return await ctx.db
      .query("users")
      .withIndex("by_workosUserId", (q) =>
        q.eq("workosUserId", identity.subject),
      )
      .unique();
  },
});

export const listAdmins = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db.query("users").collect();
  },
});

export const listInvites = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db.query("invites").order("desc").collect();
  },
});

export const inviteAdmin = mutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const { user } = await requireAdmin(ctx);
    const email = args.email.toLowerCase().trim();
    if (!email.includes("@")) {
      throw new ConvexError("Invalid email");
    }

    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (existingUser) {
      throw new ConvexError("User already exists");
    }

    const existingInvite = await ctx.db
      .query("invites")
      .withIndex("by_email", (q) => q.eq("email", email))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();
    if (existingInvite) {
      return existingInvite._id;
    }

    return await ctx.db.insert("invites", {
      email,
      invitedBy: user._id,
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

export const revokeInvite = mutation({
  args: { inviteId: v.id("invites") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.inviteId, { status: "revoked" });
  },
});
