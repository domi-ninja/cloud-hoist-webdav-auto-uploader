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
// Center the complete mark, including the arrow, inside Android's 66 dp safe circle.
// Regular icons keep the original composition; adaptive layers use a 108 dp canvas.
const foreground = stripLayer(source, "background").replace(
  '<g id="mark"',
  '<g id="mark" transform="translate(128 128) scale(0.75) translate(-128 -114.5)"',
);
const background = stripLayer(source, "mark");
const monochrome = foreground
  .replaceAll("#213D38", "#FFFFFF")
  .replaceAll("#F26B3B", "#FFFFFF");

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
    .render();

function checkAdaptiveSafeArea(image, relativePath) {
  const { width, height, pixels } = image;
  const radius = (width * 66) / 108 / 2;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (pixels[(y * width + x) * 4 + 3] === 0) continue;
      if (Math.hypot(x + 0.5 - width / 2, y + 0.5 - height / 2) > radius) {
        throw new Error(`${relativePath} extends outside Android's 66 dp safe circle.`);
      }
    }
  }
}

let stale = false;

for (const [relativePath, svg] of outputs) {
  const outputPath = new URL(`../../${relativePath}`, import.meta.url);
  const image = render(svg);
  if (relativePath === "assets/android-icon-foreground.png" || relativePath === "assets/android-icon-monochrome.png") {
    checkAdaptiveSafeArea(image, relativePath);
  }
  const png = image.asPng();

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
