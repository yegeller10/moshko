import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./lib/auth";

const workerType = v.union(
  v.literal("owner"),
  v.literal("employee"),
  v.literal("independent"),
);

export function workerDisplayName(w: {
  name?: string;
  firstName?: string;
  lastName?: string;
}): string {
  const full = [w.firstName, w.lastName].filter(Boolean).join(" ").trim();
  return full || w.name?.trim() || "—";
}

export const list = query({
  args: { includeInactive: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const all = await ctx.db.query("workers").collect();
    const filtered = args.includeInactive
      ? all
      : all.filter((w) => w.active !== false);
    return filtered
      .map((w) => ({ ...w, displayName: workerDisplayName(w) }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName, "he"));
  },
});

export const create = mutation({
  args: {
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    type: v.optional(workerType),
    idNumber: v.optional(v.string()),
    birthDate: v.optional(v.string()),
    address: v.optional(v.string()),
    phone: v.optional(v.string()),
    carLicense: v.optional(v.boolean()),
    heightWorkLicense: v.optional(v.boolean()),
    active: v.optional(v.boolean()),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const firstName = args.firstName?.trim() || undefined;
    const lastName = args.lastName?.trim() || undefined;
    const legacyName = args.name?.trim() || undefined;
    const name =
      [firstName, lastName].filter(Boolean).join(" ").trim() ||
      legacyName ||
      undefined;

    return await ctx.db.insert("workers", {
      name,
      firstName,
      lastName,
      type: args.type,
      idNumber: args.idNumber?.trim() || undefined,
      birthDate: args.birthDate?.trim() || undefined,
      address: args.address?.trim() || undefined,
      phone: args.phone?.trim() || undefined,
      carLicense: args.carLicense,
      heightWorkLicense: args.heightWorkLicense,
      active: args.active ?? true,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("workers"),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    type: v.optional(workerType),
    idNumber: v.optional(v.string()),
    birthDate: v.optional(v.string()),
    address: v.optional(v.string()),
    phone: v.optional(v.string()),
    carLicense: v.optional(v.boolean()),
    heightWorkLicense: v.optional(v.boolean()),
    active: v.optional(v.boolean()),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) return;

    const firstName =
      args.firstName !== undefined
        ? args.firstName.trim() || undefined
        : existing.firstName;
    const lastName =
      args.lastName !== undefined
        ? args.lastName.trim() || undefined
        : existing.lastName;

    const patch: Record<string, unknown> = {};
    if (args.firstName !== undefined) patch.firstName = firstName;
    if (args.lastName !== undefined) patch.lastName = lastName;
    if (args.type !== undefined) patch.type = args.type;
    if (args.idNumber !== undefined)
      patch.idNumber = args.idNumber.trim() || undefined;
    if (args.birthDate !== undefined)
      patch.birthDate = args.birthDate.trim() || undefined;
    if (args.address !== undefined)
      patch.address = args.address.trim() || undefined;
    if (args.phone !== undefined) patch.phone = args.phone.trim() || undefined;
    if (args.carLicense !== undefined) patch.carLicense = args.carLicense;
    if (args.heightWorkLicense !== undefined)
      patch.heightWorkLicense = args.heightWorkLicense;
    if (args.active !== undefined) patch.active = args.active;

    const display =
      [firstName, lastName].filter(Boolean).join(" ").trim() ||
      (args.name !== undefined ? args.name.trim() : existing.name) ||
      undefined;
    patch.name = display;

    await ctx.db.patch(args.id, patch);
  },
});

export const remove = mutation({
  args: { id: v.id("workers") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.id, { active: false });
  },
});
