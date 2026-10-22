// The two inks of the printed map, read from the design tokens in globals.css
// so the WebGL style follows them. The fallbacks repeat the same tokens for the
// rare case the custom properties are not readable yet.

export interface Inks {
  sand50: string;
  sand100: string;
  sand200: string;
  sand300: string;
  sand400: string;
  cobalt950: string;
  cobalt900: string;
  cobalt800: string;
  cobalt700: string;
  cobalt600: string;
  cobalt300: string;
  cobalt200: string;
}

const TOKENS: Record<keyof Inks, readonly [string, string]> = {
  sand50: ["--sand-50", "#f4eee3"],
  sand100: ["--sand-100", "#eee6d6"],
  sand200: ["--sand-200", "#e6dbc7"],
  sand300: ["--sand-300", "#ddd0b9"],
  sand400: ["--sand-400", "#cdbd9c"],
  cobalt950: ["--cobalt-950", "#021447"],
  cobalt900: ["--cobalt-900", "#04206e"],
  cobalt800: ["--cobalt-800", "#062b8a"],
  cobalt700: ["--cobalt-700", "#0b3db0"],
  cobalt600: ["--cobalt-600", "#3a5aa8"],
  cobalt300: ["--cobalt-300", "#a9b6de"],
  cobalt200: ["--cobalt-200", "#c9d1ec"],
};

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function readInks(): Inks {
  const out = {} as Inks;
  const style = typeof document !== "undefined" ? getComputedStyle(document.documentElement) : null;
  for (const key of Object.keys(TOKENS) as (keyof Inks)[]) {
    const [prop, fallback] = TOKENS[key];
    const value = style?.getPropertyValue(prop).trim() ?? "";
    out[key] = HEX.test(value) ? value : fallback;
  }
  return out;
}

/** The same ink as a screen tint: `rgba()` with the given opacity. */
export function tint(hex: string, opacity: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = Number.parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${opacity})`;
}
