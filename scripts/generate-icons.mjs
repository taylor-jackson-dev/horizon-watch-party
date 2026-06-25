// Rasterizes public/icon.svg into the PNG icons the PWA manifest + Apple
// touch icon need. The generated PNGs are committed, so the build never
// depends on this script. To regenerate after editing the SVG:
//
//   npm i -D sharp        # or: npm install --no-save sharp
//   node scripts/generate-icons.mjs
//
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pub = join(root, "public");
const svg = readFileSync(join(pub, "icon.svg"));

// [outfile, size, background] — apple-touch gets an opaque bg (iOS ignores
// transparency and would otherwise composite on black anyway).
const targets = [
  ["icon-192.png", 192, null],
  ["icon-512.png", 512, null],
  ["icon-maskable-512.png", 512, null],
  ["apple-touch-icon.png", 180, "#0c0c0e"],
  ["favicon-32.png", 32, null],
];

for (const [name, size, bg] of targets) {
  let pipe = sharp(svg, { density: 384 }).resize(size, size, {
    fit: "contain",
    background: bg ?? { r: 0, g: 0, b: 0, alpha: 0 },
  });
  if (bg) pipe = pipe.flatten({ background: bg });
  await pipe.png().toFile(join(pub, name));
  // eslint-disable-next-line no-console
  console.log(`wrote public/${name} (${size}x${size})`);
}
