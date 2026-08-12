"use node";

import { action } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { api, internal } from "./_generated/api";
import { createHash } from "crypto";
import { buildOfferPdfBytes, joinClientEmails } from "./lib/offerPdfBuild";

/**
 * Rebuild PDF for download only — does not persist to Convex storage.
 * (Email send still stores a copy for the sent attachment.)
 */
export const rebuild = action({
  args: { offerId: v.id("offers") },
  handler: async (ctx, args): Promise<{
    ok: true;
    contentHash: string;
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

    const issuedAt = Date.now();
    const provisionalHash = createHash("sha256")
      .update(
        JSON.stringify({
          id: args.offerId,
          n: offer.number,
          g: offer.grandTotal,
          at: issuedAt,
        }),
      )
      .digest("hex");
    const pdfBytes = await buildOfferPdfBytes({
      offer,
      clientName: client?.name ?? "—",
      clientEmails: joinClientEmails(client?.emails, client?.email),
      issuedAt,
      contentHash: provisionalHash,
    });

    const contentHash = createHash("sha256").update(pdfBytes).digest("hex");

    return {
      ok: true as const,
      contentHash,
      pdfBase64: Buffer.from(pdfBytes).toString("base64"),
      filename: `offer-${offer.number}.pdf`,
    };
  },
});
