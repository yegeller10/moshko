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
  "convex/fonts/Heebo-Regular.ttf",
  "convex/lib/heeboRegularBase64.ts",
  "HEEBO_REGULAR_BASE64",
);
writeBase64Module(
  "convex/fonts/Heebo-Bold.ttf",
  "convex/lib/heeboBoldBase64.ts",
  "HEEBO_BOLD_BASE64",
);
writeBase64Module(
  "public/logo.png",
  "convex/lib/logoPngBase64.ts",
  "LOGO_PNG_BASE64",
);
