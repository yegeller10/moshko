/**
 * Embed @resvg/resvg-wasm binary for Convex Node actions.
 * Run: node scripts/embed-resvg-wasm.cjs
 */
const fs = require("fs");
const path = require("path");

const wasmPath = path.join(
  "node_modules",
  "@resvg",
  "resvg-wasm",
  "index_bg.wasm",
);
const b64 = fs.readFileSync(wasmPath).toString("base64");
const out = `/** Auto-generated @resvg/resvg-wasm binary. */\nexport const RESVG_WASM_BASE64 =\n  "${b64}";\n`;
fs.writeFileSync("convex/lib/resvgWasmBase64.ts", out);
console.log("wrote resvgWasmBase64.ts", b64.length, "chars");
