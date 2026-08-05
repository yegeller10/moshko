import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { ConvexError } from "convex/values";

export type AdminCtx = {
  user: Doc<"users">;
  workosUserId: string;
  email: string;
};

export async function requireAdmin(
  ctx: QueryCtx | MutationCtx,
): Promise<AdminCtx> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError("Unauthenticated");
  }

  const workosUserId = identity.subject;
  const email = (identity.email ?? "").toLowerCase();

  const user = await ctx.db
    .query("users")
    .withIndex("by_workosUserId", (q) => q.eq("workosUserId", workosUserId))
    .unique();

  if (!user || user.status !== "active") {
    throw new ConvexError("Not authorized");
  }

  return { user, workosUserId, email };
}
