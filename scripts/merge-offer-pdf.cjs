const fs = require("fs");

let build = fs.readFileSync("convex/lib/buildOfferPdf.ts", "utf8");
build = build
  .replace(/from "\.\/hebrewFontBase64"/g, 'from "./lib/hebrewFontBase64"')
  .replace(/from "\.\/latinFontBase64"/g, 'from "./lib/latinFontBase64"')
  .replace(/from "\.\/logoPngBase64"/g, 'from "./lib/logoPngBase64"')
  .replace(/from "\.\/resvgWasmBase64"/g, 'from "./lib/resvgWasmBase64"')
  .replace(/export async function buildOfferPdfBytes/, "async function buildOfferPdfBytes")
  .replace(/export type OfferPdfInput/, "type OfferPdfInput");

// Drop the doc comment at top
build = build.replace(/^\/\*\*[\s\S]*?\*\/\s*/, "");

const actionImports = `import { action } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { api, internal } from "./_generated/api";
import { createHash } from "crypto";
import { applyTemplate } from "./lib/offerDefaults";
import { buildOfferEmailHtml } from "./lib/offerEmailHtml";
`;

const actionRest = fs
  .readFileSync("convex/offerPdf.ts", "utf8")
  .replace(/^"use node";\s*/, "")
  .replace(/^import[\s\S]*?from "\.\/lib\/buildOfferPdf";\s*/, "")
  .replace(/^import \{ action \}[\s\S]*?buildOfferEmailHtml";\s*/, "");

const out = `"use node";

${actionImports}
${build}
${actionRest}`;

fs.writeFileSync("convex/offerPdf.ts", out);
fs.unlinkSync("convex/lib/buildOfferPdf.ts");
console.log("merged into offerPdf.ts", out.length);
