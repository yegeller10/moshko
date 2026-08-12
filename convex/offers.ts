import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireAdmin } from "./lib/auth";
import { materializeJobForClient, normalizeAssignments } from "./calendar";
import {
  DEFAULT_OFFER_SETTINGS,
  applyTemplate,
  formatOfferDate,
  roundMoney,
} from "./lib/offerDefaults";
import { computeHours } from "./lib/costs";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

const lineItemValidator = v.object({
  quantity: v.number(),
  description: v.string(),
  unitPrice: v.number(),
  total: v.number(),
});

async function ensureSettingsRow(ctx: MutationCtx) {
  const existing = await ctx.db
    .query("offerSettings")
    .withIndex("by_key", (q) => q.eq("key", "default"))
    .unique();
  if (existing) return existing;
  const id = await ctx.db.insert("offerSettings", {
    key: "default",
    ...DEFAULT_OFFER_SETTINGS,
    updatedAt: Date.now(),
  });
  return (await ctx.db.get(id))!;
}

export const getSettings = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const row = await ctx.db
      .query("offerSettings")
      .withIndex("by_key", (q) => q.eq("key", "default"))
      .unique();
    if (row) return row;
    return { _id: null as unknown as Id<"offerSettings">, key: "default" as const, ...DEFAULT_OFFER_SETTINGS, updatedAt: 0 };
  },
});

export const ensureSettings = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const row = await ensureSettingsRow(ctx);
    return row._id;
  },
});

export const updateSettings = mutation({
  args: {
    nextNumber: v.optional(v.number()),
    vatPercent: v.optional(v.number()),
    companyName: v.optional(v.string()),
    companyVatId: v.optional(v.string()),
    companyAddress: v.optional(v.string()),
    companyEmails: v.optional(v.string()),
    bankPayee: v.optional(v.string()),
    bankName: v.optional(v.string()),
    bankBranch: v.optional(v.string()),
    bankAccount: v.optional(v.string()),
    paymentTerms: v.optional(v.string()),
    workerLineTemplate: v.optional(v.string()),
    carLineTemplate: v.optional(v.string()),
    emailSubjectTemplate: v.optional(v.string()),
    emailBodyTemplate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    let row = await ctx.db
      .query("offerSettings")
      .withIndex("by_key", (q) => q.eq("key", "default"))
      .unique();
    if (!row) {
      const id = await ctx.db.insert("offerSettings", {
        key: "default",
        ...DEFAULT_OFFER_SETTINGS,
        updatedAt: Date.now(),
      });
      row = (await ctx.db.get(id))!;
    }
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    for (const [k, val] of Object.entries(args)) {
      if (val !== undefined) patch[k] = val;
    }
    await ctx.db.patch(row._id, patch);
  },
});

export const resetTemplates = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const row = await ctx.db
      .query("offerSettings")
      .withIndex("by_key", (q) => q.eq("key", "default"))
      .unique();
    const now = Date.now();
    if (!row) {
      await ctx.db.insert("offerSettings", {
        key: "default",
        ...DEFAULT_OFFER_SETTINGS,
        updatedAt: now,
      });
      return;
    }
    await ctx.db.patch(row._id, {
      workerLineTemplate: DEFAULT_OFFER_SETTINGS.workerLineTemplate,
      carLineTemplate: DEFAULT_OFFER_SETTINGS.carLineTemplate,
      emailSubjectTemplate: DEFAULT_OFFER_SETTINGS.emailSubjectTemplate,
      emailBodyTemplate: DEFAULT_OFFER_SETTINGS.emailBodyTemplate,
      paymentTerms: DEFAULT_OFFER_SETTINGS.paymentTerms,
      updatedAt: now,
    });
  },
});

function buildLineItemsForJobs(
  jobs: Doc<"calendarEvents">[],
  settings: {
    workerLineTemplate: string;
    carLineTemplate: string;
  },
) {
  const lines: Array<{
    quantity: number;
    description: string;
    unitPrice: number;
    total: number;
  }> = [];

  let carTotal = 0;
  let carDays = 0;

  for (const job of jobs) {
    const assignments = normalizeAssignments(job);
    const qty = Math.max(1, assignments.length);
    let maxHours = job.plannedWorkHours || 0;
    for (const a of assignments) {
      maxHours = Math.max(maxHours, computeHours(a.startTime, a.endTime));
    }
    const laborCommute =
      (job.quote?.laborTotal ?? 0) + (job.quote?.commuteCost ?? 0);
    const unitPrice = qty > 0 ? roundMoney(laborCommute / qty) : 0;
    const description = applyTemplate(settings.workerLineTemplate, {
      date: formatOfferDate(job.date),
      hours: String(maxHours),
      workers: String(qty),
    });
    lines.push({
      quantity: qty,
      description,
      unitPrice,
      total: roundMoney(unitPrice * qty),
    });

    if (job.includeCar && (job.quote?.carCost ?? 0) > 0) {
      carTotal += job.quote!.carCost;
      carDays += 1;
    }

    for (const c of job.draftCharges ?? []) {
      if (c.amount <= 0) continue;
      lines.push({
        quantity: 1,
        description: c.title,
        unitPrice: roundMoney(c.amount),
        total: roundMoney(c.amount),
      });
    }
  }

  if (carDays > 0 && carTotal > 0) {
    const unit = roundMoney(carTotal / carDays);
    lines.push({
      quantity: carDays,
      description: settings.carLineTemplate,
      unitPrice: unit,
      total: roundMoney(unit * carDays),
    });
  }

  return lines;
}

function totalsFromLines(
  lines: Array<{ total: number }>,
  vatPercent: number,
) {
  const subtotal = roundMoney(lines.reduce((s, l) => s + l.total, 0));
  const vatRate = vatPercent / 100;
  const vatAmount = roundMoney(subtotal * vatRate);
  const grandTotal = roundMoney(subtotal + vatAmount);
  return { subtotal, vatRate, vatAmount, grandTotal };
}

export const previewFromJobs = query({
  args: { jobIds: v.array(v.id("calendarEvents")) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    if (!args.jobIds.length) throw new ConvexError("Select at least one job");
    const settings =
      (await ctx.db
        .query("offerSettings")
        .withIndex("by_key", (q) => q.eq("key", "default"))
        .unique()) ?? DEFAULT_OFFER_SETTINGS;

    const jobs: Doc<"calendarEvents">[] = [];
    for (const id of args.jobIds) {
      const j = await ctx.db.get(id);
      if (!j) throw new ConvexError("Job not found");
      if (j.status === "cancelled") {
        throw new ConvexError("Cannot include cancelled jobs");
      }
      jobs.push(j);
    }
    const clientId = jobs[0]!.clientId;
    if (jobs.some((j) => j.clientId !== clientId)) {
      throw new ConvexError("All jobs must be for the same client");
    }
    const client = await ctx.db.get(clientId);
    const lineItems = buildLineItemsForJobs(jobs, settings);
    const totals = totalsFromLines(lineItems, settings.vatPercent);
    return {
      clientId,
      clientName: client?.name ?? "—",
      clientEmails: [
        ...(client?.emails ?? []),
        ...(client?.email ? [client.email] : []),
      ].filter(Boolean),
      nextNumber: settings.nextNumber,
      vatPercent: settings.vatPercent,
      lineItems,
      ...totals,
      jobs: jobs.map((j) => ({
        _id: j._id,
        date: j.date,
        status: j.status,
        title: j.title,
      })),
    };
  },
});

export const listSiblingBooked = query({
  args: { jobId: v.id("calendarEvents") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const job = await ctx.db.get(args.jobId);
    if (!job) return [];
    const all = await ctx.db
      .query("calendarEvents")
      .withIndex("by_client_date", (q) => q.eq("clientId", job.clientId))
      .collect();
    return all
      .filter((j) => j.status === "booked")
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((j) => ({
        _id: j._id,
        date: j.date,
        title: j.title,
        status: j.status,
        locationText: j.locationText,
        workers: normalizeAssignments(j).length,
        quoteTotal:
          (j.quote?.grandTotal ?? 0) +
          (j.draftCharges ?? []).reduce(
            (s, c) => s + (c.amount > 0 ? c.amount : 0),
            0,
          ),
      }));
  },
});

export const createDraft = mutation({
  args: {
    jobIds: v.array(v.id("calendarEvents")),
    title: v.string(),
    attention: v.optional(v.string()),
    lineItems: v.array(lineItemValidator),
  },
  handler: async (ctx, args) => {
    const { user } = await requireAdmin(ctx);
    if (!args.jobIds.length) throw new ConvexError("Select at least one job");
    if (!args.title.trim()) throw new ConvexError("Title required");

    let settings = await ctx.db
      .query("offerSettings")
      .withIndex("by_key", (q) => q.eq("key", "default"))
      .unique();
    if (!settings) {
      const sid = await ctx.db.insert("offerSettings", {
        key: "default",
        ...DEFAULT_OFFER_SETTINGS,
        updatedAt: Date.now(),
      });
      settings = (await ctx.db.get(sid))!;
    }

    const jobs: Doc<"calendarEvents">[] = [];
    for (const id of args.jobIds) {
      const j = await ctx.db.get(id);
      if (!j) throw new ConvexError("Job not found");
      jobs.push(j);
    }
    const clientId = jobs[0]!.clientId;
    if (jobs.some((j) => j.clientId !== clientId)) {
      throw new ConvexError("All jobs must be for the same client");
    }

    const lines = args.lineItems.map((l) => ({
      quantity: l.quantity,
      description: l.description.trim(),
      unitPrice: roundMoney(l.unitPrice),
      total: roundMoney(l.quantity * l.unitPrice),
    }));
    const totals = totalsFromLines(lines, settings.vatPercent);
    const number = settings.nextNumber;
    await ctx.db.patch(settings._id, {
      nextNumber: number + 1,
      updatedAt: Date.now(),
    });

    const now = Date.now();
    return await ctx.db.insert("offers", {
      number,
      clientId,
      jobIds: args.jobIds,
      title: args.title.trim(),
      attention: args.attention?.trim() || undefined,
      lineItems: lines,
      ...totals,
      status: "draft",
      companySnapshot: {
        name: settings.companyName,
        vatId: settings.companyVatId,
        address: settings.companyAddress,
        emails: settings.companyEmails,
      },
      bankSnapshot: {
        payee: settings.bankPayee,
        bank: settings.bankName,
        branch: settings.bankBranch,
        account: settings.bankAccount,
        paymentTerms: settings.paymentTerms,
      },
      createdBy: user._id,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateDraft = mutation({
  args: {
    id: v.id("offers"),
    title: v.optional(v.string()),
    attention: v.optional(v.string()),
    lineItems: v.optional(v.array(lineItemValidator)),
    jobIds: v.optional(v.array(v.id("calendarEvents"))),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const offer = await ctx.db.get(args.id);
    if (!offer) throw new ConvexError("Offer not found");
    if (offer.status !== "draft") {
      throw new ConvexError("Only draft offers can be edited");
    }
    const settings =
      (await ctx.db
        .query("offerSettings")
        .withIndex("by_key", (q) => q.eq("key", "default"))
        .unique()) ?? DEFAULT_OFFER_SETTINGS;

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.title !== undefined) patch.title = args.title.trim();
    if (args.attention !== undefined) {
      patch.attention = args.attention.trim() || undefined;
    }
    if (args.jobIds !== undefined) patch.jobIds = args.jobIds;
    if (args.lineItems !== undefined) {
      const lines = args.lineItems.map((l) => ({
        quantity: l.quantity,
        description: l.description.trim(),
        unitPrice: roundMoney(l.unitPrice),
        total: roundMoney(l.quantity * l.unitPrice),
      }));
      const totals = totalsFromLines(lines, settings.vatPercent);
      patch.lineItems = lines;
      Object.assign(patch, totals);
    }
    await ctx.db.patch(args.id, patch);
  },
});

export const get = query({
  args: { id: v.id("offers") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const offer = await ctx.db.get(args.id);
    if (!offer) return null;
    const client = await ctx.db.get(offer.clientId);
    const jobs = await Promise.all(offer.jobIds.map((id) => ctx.db.get(id)));
    let pdfUrl: string | null = null;
    if (offer.pdfStorageId) {
      pdfUrl = await ctx.storage.getUrl(offer.pdfStorageId);
    }
    return {
      ...offer,
      client,
      jobs: jobs.filter(Boolean),
      pdfUrl,
    };
  },
});

export const list = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const all = await ctx.db.query("offers").collect();
    all.sort((a, b) => b.number - a.number);
    const slice = all.slice(0, args.limit ?? 100);
    return await Promise.all(
      slice.map(async (o) => {
        const client = await ctx.db.get(o.clientId);
        return {
          ...o,
          clientName: client?.name ?? "—",
          dates: (
            await Promise.all(o.jobIds.map((id) => ctx.db.get(id)))
          )
            .filter(Boolean)
            .map((j) => j!.date)
            .sort(),
        };
      }),
    );
  },
});

export const getInternal = internalQuery({
  args: { id: v.id("offers") },
  handler: async (ctx, args) => {
    const offer = await ctx.db.get(args.id);
    if (!offer) return null;
    const client = await ctx.db.get(offer.clientId);
    const settings = await ctx.db
      .query("offerSettings")
      .withIndex("by_key", (q) => q.eq("key", "default"))
      .unique();
    return { offer, client, settings };
  },
});

export const markIssued = internalMutation({
  args: {
    id: v.id("offers"),
    contentHash: v.string(),
    pdfStorageId: v.id("_storage"),
    sentToEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const offer = await ctx.db.get(args.id);
    if (!offer) throw new ConvexError("Offer not found");
    const now = Date.now();
    await ctx.db.patch(args.id, {
      status:
        offer.status === "accepted" || offer.status === "disputed"
          ? offer.status
          : args.sentToEmail
            ? "sent"
            : offer.status,
      contentHash: args.contentHash,
      pdfStorageId: args.pdfStorageId,
      ...(args.sentToEmail
        ? { sentToEmail: args.sentToEmail, issuedAt: offer.issuedAt ?? now }
        : {}),
      updatedAt: now,
    });
  },
});

export async function applyOfferClientDecision(
  ctx: MutationCtx,
  args: {
    offerId: Id<"offers">;
    decision: "accepted" | "disputed";
    note?: string;
    email: string;
  },
) {
  const offer = await ctx.db.get(args.offerId);
  if (!offer) throw new ConvexError("Offer not found");
  const now = Date.now();
  await ctx.db.patch(args.offerId, {
    status: args.decision === "accepted" ? "accepted" : "disputed",
    updatedAt: now,
  });

  for (const jobId of offer.jobIds) {
    const job = await ctx.db.get(jobId);
    if (!job || job.status === "cancelled") continue;
    await ctx.db.patch(jobId, {
      clientDecision: args.decision,
      clientDecisionNote: args.note,
      clientDecisionAt: now,
      clientDecisionEmail: args.email,
      updatedAt: now,
    });
    if (args.decision === "accepted" && job.status === "booked") {
      await ctx.db.patch(jobId, { status: "approved", updatedAt: now });
      const refreshed = await ctx.db.get(jobId);
      if (refreshed) await materializeJobForClient(ctx, refreshed);
    }
  }
}

export const applyClientDecision = internalMutation({
  args: {
    offerId: v.id("offers"),
    decision: v.union(v.literal("accepted"), v.literal("disputed")),
    note: v.optional(v.string()),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    await applyOfferClientDecision(ctx, args);
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});
