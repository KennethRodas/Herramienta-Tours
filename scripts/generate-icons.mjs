// Renders the PWA icons and the Apple touch icon from the logo (the OG image is src/app/opengraph-image.tsx).
// Usage: node scripts/generate-icons.mjs
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GREEN = "#062b8a"; // cobalt (kept variable names short)
const GOLD = "#eee6d6"; // sand
const TICKET = "M4 12H60V27A5 5 0 0 0 60 37V52H4V37A5 5 0 0 0 4 27Z";
const TRAIL = "M14 21.5 22.5 40 32 27.5 41.5 40 50 21.5";

/** Square icon: ticket at `scale` of the canvas, centred on cobalt. */
function iconSvg(size, scale, radius = 0) {
  const s = (size * scale) / 64;
  const off = (size - 64 * s) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${radius}" fill="${GREEN}"/>
  <g transform="translate(${off} ${off}) scale(${s})">
    <path d="${TICKET}" fill="${GOLD}"/>
    <path d="${TRAIL}" fill="none" stroke="${GREEN}" stroke-width="4.6" stroke-linecap="round" stroke-linejoin="round"/>
  </g></svg>`;
}

async function png(svg, out) {
  const file = path.join(root, out);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(file);
  console.log("wrote", out);
}

await png(iconSvg(192, 0.82), "public/icons/icon-192.png");
await png(iconSvg(512, 0.82), "public/icons/icon-512.png");
await png(iconSvg(512, 0.6), "public/icons/maskable-512.png");
await png(iconSvg(192, 0.6), "public/icons/maskable-192.png");
await png(iconSvg(180, 0.74), "src/app/apple-icon.png");
await png(iconSvg(96, 0.86, 20), "public/icons/shortcut-96.png");
