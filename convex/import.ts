import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireAdmin } from "./lib/auth";
import type { Id } from "./_generated/dataModel";

/**
 * Resolve worker/client names for CSV import. Optionally create missing entities.
 */
export const resolveImportNames = query({
  args: {
    workerNames: v.array(v.string()),
    clientNames: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const workers = await ctx.db.query("workers").collect();
    const clients = await ctx.db.query("clients").collect();

    const workerMap: Record<string, Id<"workers"> | null> = {};
    const clientMap: Record<string, Id<"clients"> | null> = {};

    for (const name of args.workerNames) {
      const key = name.trim().toLowerCase();
      const found = workers.find((w) => w.name.toLowerCase() === key);
      workerMap[name] = found?._id ?? null;
    }
    for (const name of args.clientNames) {
      const key = name.trim().toLowerCase();
      const found = clients.find((c) => c.name.toLowerCase() === key);
      clientMap[name] = found?._id ?? null;
    }

    return { workerMap, clientMap };
  },
});

export const ensureNamedEntities = mutation({
  args: {
    workers: v.array(v.string()),
    clients: v.array(
      v.object({
        name: v.string(),
        hourlyRate: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const workerIds: Record<string, Id<"workers">> = {};
    const clientIds: Record<string, Id<"clients">> = {};

    const existingWorkers = await ctx.db.query("workers").collect();
    const existingClients = await ctx.db.query("clients").collect();

    for (const name of args.workers) {
      const trimmed = name.trim();
      const found = existingWorkers.find(
        (w) => w.name.toLowerCase() === trimmed.toLowerCase(),
      );
      if (found) {
        workerIds[trimmed] = found._id;
      } else {
        const id = await ctx.db.insert("workers", {
          name: trimmed,
          active: true,
        });
        workerIds[trimmed] = id;
      }
    }

    for (const c of args.clients) {
      const trimmed = c.name.trim();
      const found = existingClients.find(
        (x) => x.name.toLowerCase() === trimmed.toLowerCase(),
      );
      if (found) {
        clientIds[trimmed] = found._id;
      } else {
        if (c.hourlyRate === undefined || c.hourlyRate < 0) {
          throw new ConvexError(`Missing rate for new client: ${trimmed}`);
        }
        const id = await ctx.db.insert("clients", {
          name: trimmed,
          rateMode: "hourly",
          hourlyRate: c.hourlyRate,
          active: true,
        });
        clientIds[trimmed] = id;
      }
    }

    return { workerIds, clientIds };
  },
});
