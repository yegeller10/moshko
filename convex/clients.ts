import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./lib/auth";

const contactValidator = v.object({
  name: v.string(),
  phone: v.string(),
});

function cleanContacts(
  contacts?: Array<{ name: string; phone: string }>,
) {
  return (contacts ?? [])
    .map((c) => ({
      name: c.name.trim(),
      phone: c.phone.trim(),
    }))
    .filter((c) => c.name || c.phone);
}

function cleanEmails(emails?: string[]) {
  return (emails ?? []).map((e) => e.trim()).filter(Boolean);
}

function parseOptionalNumber(n: number | undefined) {
  if (n === undefined || Number.isNaN(n)) return undefined;
  return n;
}

export const list = query({
  args: { includeInactive: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const all = await ctx.db.query("clients").collect();
    const filtered = args.includeInactive
      ? all
      : all.filter((c) => c.active !== false);
    return filtered.sort((a, b) =>
      (a.name ?? "").localeCompare(b.name ?? "", "he"),
    );
  },
});

export const get = query({
  args: { id: v.id("clients") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    name: v.optional(v.string()),
    contacts: v.optional(v.array(contactValidator)),
    industry: v.optional(v.string()),
    emails: v.optional(v.array(v.string())),
    hourlyRate: v.optional(v.number()),
    active: v.optional(v.boolean()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const name = args.name?.trim() || undefined;
    const emails = cleanEmails(args.emails);
    const contacts = cleanContacts(args.contacts);
    const hourlyRate = parseOptionalNumber(args.hourlyRate) ?? 100;

    return await ctx.db.insert("clients", {
      name,
      contacts: contacts.length ? contacts : undefined,
      industry: args.industry?.trim() || undefined,
      emails: emails.length ? emails : undefined,
      email: emails[0],
      hourlyRate,
      active: args.active ?? true,
      notes: args.notes?.trim() || undefined,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("clients"),
    name: v.optional(v.string()),
    contacts: v.optional(v.array(contactValidator)),
    industry: v.optional(v.string()),
    emails: v.optional(v.array(v.string())),
    hourlyRate: v.optional(v.number()),
    active: v.optional(v.boolean()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const { id, ...rest } = args;
    const patch: Record<string, unknown> = {};

    if (rest.name !== undefined) patch.name = rest.name.trim() || undefined;
    if (rest.contacts !== undefined) {
      const contacts = cleanContacts(rest.contacts);
      patch.contacts = contacts.length ? contacts : undefined;
    }
    if (rest.industry !== undefined)
      patch.industry = rest.industry.trim() || undefined;
    if (rest.emails !== undefined) {
      const emails = cleanEmails(rest.emails);
      patch.emails = emails.length ? emails : undefined;
      patch.email = emails[0];
    }
    if (rest.hourlyRate !== undefined)
      patch.hourlyRate = parseOptionalNumber(rest.hourlyRate) ?? 100;
    if (rest.active !== undefined) patch.active = rest.active;
    if (rest.notes !== undefined) patch.notes = rest.notes.trim() || undefined;

    await ctx.db.patch(id, patch);
  },
});
