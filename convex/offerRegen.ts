"use node";

import { action } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { api, internal } from "./_generated/api";
import { createHash } from "crypto";
import { buildOfferPdfBytes } from "./lib/offerPdfBuild";

export const rebuild = action({
  args: { offerId: v.id("offers") },
  handler: async (ctx, args): Promise<{
    ok: true;
    contentHash: string;
    pdfUrl: string | null;
    pdfBase64: string;
    filename: string;
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Unauthenticated");
    const me = await ctx.runQuery(api.users.me, {});
    if (!me || me.status !== "active") {
      throw new ConvexError("Not authorized");
    }

    const packed = await ctx.runQuery(internal.offers.getInternal, {
      id: args.offerId,
    });
    if (!packed?.offer) throw new ConvexError("Offer not found");
    const { offer, client } = packed;
    if (offer.status === "cancelled") {
      throw new ConvexError("Offer cancelled");
    }

    const pdfBytes = await buildOfferPdfBytes({
      offer,
      clientName: client?.name ?? "—",
      clientEmails: [
        ...(client?.emails ?? []),
        ...(client?.email ? [client.email] : []),
      ]
        .filter(Boolean)
        .join(", "),
      issuedAt: Date.now(),
    });

    const contentHash = createHash("sha256").update(pdfBytes).digest("hex");
    const uploadUrl = await ctx.runMutation(api.offers.generateUploadUrl, {});
    const uploadRes = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": "application/pdf" },
      body: pdfBytes,
    });
    if (!uploadRes.ok) throw new ConvexError("Failed to upload PDF");
    const { storageId } = (await uploadRes.json()) as {
      storageId: import("./_generated/dataModel").Id<"_storage">;
    };

    await ctx.runMutation(internal.offers.markIssued, {
      id: args.offerId,
      contentHash,
      pdfStorageId: storageId,
    });

    const fresh = (await ctx.runQuery(api.offers.get, {
      id: args.offerId,
    })) as { pdfUrl: string | null } | null;

    return {
      ok: true as const,
      contentHash,
      pdfUrl: fresh?.pdfUrl ?? null,
      pdfBase64: Buffer.from(pdfBytes).toString("base64"),
      filename: `offer-${offer.number}.pdf`,
    };
  },
});
