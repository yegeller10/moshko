import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./lib/auth";
import type { Id } from "./_generated/dataModel";
import { workerDisplayName } from "./workers";

function matchName(candidate: string, key: string) {
  return candidate.trim().toLowerCase() === key;
}

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
      const found = workers.find((w) =>
        matchName(workerDisplayName(w), key),
      );
      workerMap[name] = found?._id ?? null;
    }
    for (const name of args.clientNames) {
      const key = name.trim().toLowerCase();
      const found = clients.find((c) => matchName(c.name ?? "", key));
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
      const found = existingWorkers.find((w) =>
        matchName(workerDisplayName(w), trimmed.toLowerCase()),
      );
      if (found) {
        workerIds[trimmed] = found._id;
      } else {
        const parts = trimmed.split(/\s+/);
        const firstName = parts[0];
        const lastName = parts.slice(1).join(" ") || undefined;
        const id = await ctx.db.insert("workers", {
          name: trimmed,
          firstName,
          lastName,
          active: true,
        });
        workerIds[trimmed] = id;
      }
    }

    for (const c of args.clients) {
      const trimmed = c.name.trim();
      const found = existingClients.find((x) =>
        matchName(x.name ?? "", trimmed.toLowerCase()),
      );
      if (found) {
        clientIds[trimmed] = found._id;
      } else {
        const id = await ctx.db.insert("clients", {
          name: trimmed,
          rateMode: "hourly",
          hourlyRate: c.hourlyRate ?? 0,
          active: true,
        });
        clientIds[trimmed] = id;
      }
    }

    return { workerIds, clientIds };
  },
});
