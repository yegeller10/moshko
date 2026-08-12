const fs = require("fs");
const path = require("path");

function writeBase64Module(srcPath, outPath, exportName, comment) {
  const b64 = fs.readFileSync(srcPath).toString("base64");
  const content = `/** ${comment} */\nexport const ${exportName} =\n  "${b64}";\n`;
  fs.writeFileSync(outPath, content);
  console.log(
    "wrote",
    path.basename(outPath),
    `(${fs.statSync(srcPath).size} bytes -> ${b64.length} chars)`,
  );
}

writeBase64Module(
  "convex/fonts/Heebo-Regular.ttf",
  "convex/lib/heeboFontBase64.ts",
  "HEEBO_REGULAR_BASE64",
  "Auto-generated Heebo Regular (Hebrew + Latin digits/punctuation).",
);

fs.mkdirSync("assets/fonts", { recursive: true });
fs.copyFileSync(
  "convex/fonts/Heebo-Regular.ttf",
  "assets/fonts/Heebo-Regular.ttf",
);
console.log("copied assets/fonts/Heebo-Regular.ttf");
