import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "Wilber · Tours de aventura en El Salvador";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const COBALT = "#062b8a";
const SAND = "#eee6d6";

export default async function OpengraphImage() {
  const [condensed, medium] = await Promise.all([
    readFile(join(process.cwd(), "src/assets/fonts/BarlowCondensed-Bold.ttf")),
    readFile(join(process.cwd(), "src/assets/fonts/Barlow-Medium.ttf")),
  ]);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", background: COBALT, padding: "0 96px", gap: 64 }}>
        <svg width="300" height="300" viewBox="0 0 64 64">
          <path d="M4 12H60V27A5 5 0 0 0 60 37V52H4V37A5 5 0 0 0 4 27Z" fill={SAND} />
          <path d="M14 21.5 22.5 40 32 27.5 41.5 40 50 21.5" fill="none" stroke={COBALT} strokeWidth={4.6} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div style={{ display: "flex", flexDirection: "column", color: SAND }}>
          <div style={{ fontFamily: "Barlow Condensed", fontSize: 168, lineHeight: 0.9, letterSpacing: -2 }}>WILBER</div>
          <div style={{ fontFamily: "Barlow", fontSize: 44, marginTop: 18 }}>Tours de aventura en El Salvador</div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Barlow Condensed", data: condensed, weight: 700, style: "normal" },
        { name: "Barlow", data: medium, weight: 500, style: "normal" },
      ],
    },
  );
}
