import { readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const distDir = join(process.cwd(), "dist");
const assetsDir = join(distDir, "assets");
const assets = readdirSync(assetsDir);

const indexJs = assets.find((file) => file.startsWith("index-") && file.endsWith(".js"));
const stylesCss = assets.find((file) => file.startsWith("styles-") && file.endsWith(".css"));

if (!indexJs) {
  throw new Error("Could not find dist/assets/index-*.js for Capacitor entry.");
}

const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Set Timer</title>
    ${stylesCss ? `<link rel="stylesheet" href="./assets/${stylesCss}" />` : ""}
    <link rel="icon" href="./favicon.ico" type="image/x-icon" />
  </head>
  <body>
    <script type="module" src="./assets/${indexJs}"></script>
  </body>
</html>
`;

writeFileSync(join(distDir, "index.html"), html);
console.log("Generated dist/index.html for Capacitor.");
