import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireAdmin } from "./lib/auth";

export const list = query({
  args: { includeInactive: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const all = await ctx.db.query("workers").collect();
    if (args.includeInactive) return all.sort((a, b) => a.name.localeCompare(b.name));
    return all
      .filter((w) => w.active)
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const name = args.name.trim();
    if (!name) throw new ConvexError("Name required");
    return await ctx.db.insert("workers", { name, active: true });
  },
});

export const update = mutation({
  args: {
    id: v.id("workers"),
    name: v.optional(v.string()),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const { id, ...rest } = args;
    const patch: { name?: string; active?: boolean } = {};
    if (rest.name !== undefined) patch.name = rest.name.trim();
    if (rest.active !== undefined) patch.active = rest.active;
    await ctx.db.patch(id, patch);
  },
});

export const remove = mutation({
  args: { id: v.id("workers") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    // Soft-delete preferred for history
    await ctx.db.patch(args.id, { active: false });
  },
});
