const fs = require("fs");
const path = require("path");

function writeBase64Module(ttfPath, outPath, exportName) {
  const b64 = fs.readFileSync(ttfPath).toString("base64");
  const content = `/** Auto-generated font bytes (base64). */\nexport const ${exportName} =\n  "${b64}";\n`;
  fs.writeFileSync(outPath, content);
  console.log(
    "wrote",
    path.basename(outPath),
    "from",
    path.basename(ttfPath),
    `(${fs.statSync(ttfPath).size} bytes -> ${content.length} chars)`,
  );
}

writeBase64Module(
  "convex/fonts/NotoSansHebrew-Regular.ttf",
  "convex/lib/hebrewFontBase64.ts",
  "NOTO_SANS_HEBREW_REGULAR_BASE64",
);
writeBase64Module(
  "convex/fonts/NotoSans-Regular.ttf",
  "convex/lib/latinFontBase64.ts",
  "NOTO_SANS_REGULAR_BASE64",
);
writeBase64Module(
  "public/logo.png",
  "convex/lib/logoPngBase64.ts",
  "LOGO_PNG_BASE64",
);
