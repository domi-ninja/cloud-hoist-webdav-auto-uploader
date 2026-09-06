// Renders all PNG app-icon variants from assets/icon.svg.
// Use `pnpm icons` to update generated files or `pnpm icons:check` to verify they are current.
// Layer markers in the SVG determine which artwork appears in adaptive and monochrome variants.

import { readFile, writeFile } from "node:fs/promises";
import { Resvg } from "@resvg/resvg-js";

const sourcePath = new URL("../../assets/icon.svg", import.meta.url);
const checkOnly = process.argv.includes("--check");

const stripLayer = (svg, layer) =>
  svg.replace(
    new RegExp(`\\s*<!-- ${layer}:start -->[\\s\\S]*?<!-- ${layer}:end -->`),
    "",
  );

const source = await readFile(sourcePath, "utf8");
const foreground = stripLayer(source, "background");
const background = stripLayer(source, "mark");
const monochrome = foreground
  .replaceAll("#F5F1E8", "#FFFFFF")
  .replaceAll("#95D7C4", "#FFFFFF")
  .replaceAll("#76B9A7", "#FFFFFF")
  .replaceAll("#214B3F", "#FFFFFF");

const outputs = new Map([
  ["assets/icon.png", source],
  ["assets/android-icon-foreground.png", foreground],
  ["assets/android-icon-background.png", background],
  ["assets/android-icon-monochrome.png", monochrome],
]);

const render = (svg) =>
  new Resvg(svg, {
    fitTo: { mode: "width", value: 1024 },
  })
    .render()
    .asPng();

let stale = false;

for (const [relativePath, svg] of outputs) {
  const outputPath = new URL(`../../${relativePath}`, import.meta.url);
  const png = render(svg);

  if (checkOnly) {
    const current = await readFile(outputPath).catch(() => undefined);
    if (!current?.equals(png)) {
      console.error(`${relativePath} is stale. Run pnpm icons.`);
      stale = true;
    }
    continue;
  }

  await writeFile(outputPath, png);
  console.log(`wrote ${relativePath}`);
}

if (stale) {
  process.exitCode = 1;
}
