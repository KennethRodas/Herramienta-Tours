// Liquid Glass refraction engine.
// Ported to TypeScript from "Liquid Glass Navbar | Switcher" by Sis
// (https://codepen.io/Sis-the-builder/pen/GgjppJe), MIT licence — see THIRD_PARTY_NOTICES.md.
// It renders a displacement map + specular map into an SVG filter and applies it
// through `backdrop-filter: url(#id)`, which only Chromium supports; other
// browsers keep the tint and highlight layers and simply skip the refraction.

export interface GlassConfig {
  glassThickness: number;
  bezelWidth: number;
  ior: number;
  scaleRatio: number;
  blur: number;
  specularOpacity: number;
  specularSat: number;
  tintColor: string; // "r,g,b"
  tintOpacity: number;
  innerShadow: string;
  innerShadowBlur: number;
  innerShadowSpread: number;
  balancedSpecular: boolean;
}

export const SWITCHER_GLASS: GlassConfig = {
  glassThickness: 30,
  bezelWidth: 40,
  ior: 1.4,
  scaleRatio: 1,
  blur: 0,
  specularOpacity: 0.5,
  specularSat: 0,
  tintColor: "255,255,255",
  tintOpacity: 0,
  innerShadow: "rgba(255,255,255,0)",
  innerShadowBlur: 0,
  innerShadowSpread: 0,
  balancedSpecular: true,
};

export const PANEL_GLASS: GlassConfig = {
  glassThickness: 80,
  bezelWidth: 40,
  ior: 1.4,
  scaleRatio: 1,
  blur: 1,
  specularOpacity: 0.6,
  specularSat: 0,
  tintColor: "255,255,255",
  tintOpacity: 0,
  innerShadow: "rgba(255,255,255,0)",
  innerShadowBlur: 0,
  innerShadowSpread: 0,
  balancedSpecular: false,
};

let refractionSupport: boolean | null = null;

/** SVG filters inside backdrop-filter work in Chromium only. */
export function supportsRefraction() {
  if (refractionSupport !== null) return refractionSupport;
  if (typeof navigator === "undefined") return false;
  const brands = (navigator as Navigator & { userAgentData?: { brands?: { brand: string }[] } }).userAgentData?.brands;
  refractionSupport = Boolean(brands?.some((b) => /Chromium/i.test(b.brand))) || /Chrome\/|Chromium\//.test(navigator.userAgent);
  return refractionSupport;
}

const surface = (x: number) => Math.pow(1 - Math.pow(1 - x, 4), 0.25);

function refractionProfile(glassThickness: number, bezelWidth: number, ior: number, samples = 128) {
  const eta = 1 / ior;
  const refract = (nx: number, ny: number): [number, number] | null => {
    const dot = ny;
    const k = 1 - eta * eta * (1 - dot * dot);
    if (k < 0) return null;
    const sq = Math.sqrt(k);
    return [-(eta * dot + sq) * nx, eta - (eta * dot + sq) * ny];
  };
  const p = new Float64Array(samples);
  for (let i = 0; i < samples; i++) {
    const x = i / samples;
    const y = surface(x);
    const dx = x < 1 ? 0.0001 : -0.0001;
    const deriv = (surface(x + dx) - y) / dx;
    const mag = Math.sqrt(deriv * deriv + 1);
    const ref = refract(-deriv / mag, -1 / mag);
    p[i] = ref ? ref[0] * ((y * bezelWidth + glassThickness) / ref[1]) : 0;
  }
  return p;
}

function displacementMap(w: number, h: number, radius: number, bezel: number, profile: Float64Array, maxDisp: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = 128;
    d[i + 1] = 128;
    d[i + 2] = 0;
    d[i + 3] = 255;
  }
  const r = radius;
  const rSq = r * r;
  const r1Sq = (r + 1) ** 2;
  const rBSq = Math.max(r - bezel, 0) ** 2;
  const wB = w - r * 2;
  const hB = h - r * 2;
  const S = profile.length;
  for (let y1 = 0; y1 < h; y1++) {
    for (let x1 = 0; x1 < w; x1++) {
      const x = x1 < r ? x1 - r : x1 >= w - r ? x1 - r - wB : 0;
      const y = y1 < r ? y1 - r : y1 >= h - r ? y1 - r - hB : 0;
      const dSq = x * x + y * y;
      if (dSq > r1Sq || dSq < rBSq) continue;
      const dist = Math.sqrt(dSq);
      const fromSide = r - dist;
      const op = dSq < rSq ? 1 : 1 - (dist - Math.sqrt(rSq)) / (Math.sqrt(r1Sq) - Math.sqrt(rSq));
      if (op <= 0 || dist === 0) continue;
      const cos = x / dist;
      const sin = y / dist;
      const bi = Math.min(((fromSide / bezel) * S) | 0, S - 1);
      const disp = profile[bi] || 0;
      const dX = (-cos * disp) / maxDisp;
      const dY = (-sin * disp) / maxDisp;
      const idx = (y1 * w + x1) * 4;
      d[idx] = (128 + dX * 127 * op + 0.5) | 0;
      d[idx + 1] = (128 + dY * 127 * op + 0.5) | 0;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL();
}

function specularMap(w: number, h: number, radius: number, bezel: number, balanced: boolean) {
  const angle = Math.PI / 3;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(w, h);
  const d = img.data;
  d.fill(0);
  const r = radius;
  const rSq = r * r;
  const r1Sq = (r + 1) ** 2;
  const rBSq = Math.max(r - bezel, 0) ** 2;
  const wB = w - r * 2;
  const hB = h - r * 2;
  const sv = [Math.cos(angle), Math.sin(angle)];
  for (let y1 = 0; y1 < h; y1++) {
    for (let x1 = 0; x1 < w; x1++) {
      const x = x1 < r ? x1 - r : x1 >= w - r ? x1 - r - wB : 0;
      const y = y1 < r ? y1 - r : y1 >= h - r ? y1 - r - hB : 0;
      const dSq = x * x + y * y;
      if (dSq > r1Sq || dSq < rBSq) continue;
      const dist = Math.sqrt(dSq);
      const fromSide = r - dist;
      const op = dSq < rSq ? 1 : 1 - (dist - Math.sqrt(rSq)) / (Math.sqrt(r1Sq) - Math.sqrt(rSq));
      if (op <= 0 || dist === 0) continue;
      const cos = x / dist;
      const sin = -y / dist;
      const dot = balanced ? 1 : Math.abs(cos * sv[0] + sin * sv[1]);
      const edge = Math.sqrt(Math.max(0, 1 - (1 - fromSide) ** 2));
      const coeff = dot * edge;
      const col = (255 * coeff) | 0;
      const alpha = (col * coeff * op) | 0;
      const idx = (y1 * w + x1) * 4;
      d[idx] = col;
      d[idx + 1] = col;
      d[idx + 2] = col;
      d[idx + 3] = alpha;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL();
}

const SVG_NS = "http://www.w3.org/2000/svg";
function svgEl(tag: string, attrs: Record<string, string | number>) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

let defs: SVGDefsElement | null = null;
function ensureDefs() {
  if (defs && document.documentElement.contains(defs)) return defs;
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  svg.setAttribute("aria-hidden", "true");
  svg.style.cssText = "position:fixed;top:0;left:0;width:0;height:0;pointer-events:none;z-index:-1;";
  defs = document.createElementNS(SVG_NS, "defs") as SVGDefsElement;
  svg.appendChild(defs);
  document.body.appendChild(svg);
  return defs;
}

function buildFilter(id: string, w: number, h: number, radius: number, cfg: GlassConfig) {
  const bezel = Math.min(cfg.bezelWidth, radius - 1, Math.min(w, h) / 2 - 1);
  const profile = refractionProfile(cfg.glassThickness, bezel, cfg.ior, 128);
  const maxDisp = Math.max(...Array.from(profile).map(Math.abs)) || 1;
  const dispUrl = displacementMap(w, h, radius, bezel, profile, maxDisp);
  const specUrl = specularMap(w, h, radius, bezel * 2.5, cfg.balancedSpecular);
  const scale = maxDisp * cfg.scaleRatio;
  const pad = cfg.balancedSpecular ? 0.36 : 0;
  const filter = svgEl("filter", {
    id,
    x: Math.round(-w * pad),
    y: Math.round(-h * pad),
    width: Math.round(w * (1 + pad * 2)),
    height: Math.round(h * (1 + pad * 2)),
    filterUnits: "userSpaceOnUse",
    primitiveUnits: "userSpaceOnUse",
    "color-interpolation-filters": "sRGB",
  });
  const tr = svgEl("feComponentTransfer", { in: "spec_layer", result: "spec_faded" });
  tr.appendChild(svgEl("feFuncA", { type: "linear", slope: cfg.specularOpacity }));
  filter.append(
    svgEl("feGaussianBlur", { in: "SourceGraphic", stdDeviation: cfg.blur, result: "blurred" }),
    svgEl("feImage", { href: dispUrl, x: 0, y: 0, width: w, height: h, result: "disp_map" }),
    svgEl("feDisplacementMap", { in: "blurred", in2: "disp_map", scale, xChannelSelector: "R", yChannelSelector: "G", result: "displaced" }),
    svgEl("feColorMatrix", { in: "displaced", type: "saturate", values: cfg.specularSat, result: "displaced_sat" }),
    svgEl("feImage", { href: specUrl, x: 0, y: 0, width: w, height: h, result: "spec_layer" }),
    svgEl("feComposite", { in: "displaced_sat", in2: "spec_layer", operator: "in", result: "spec_masked" }),
    tr,
    svgEl("feBlend", { in: "spec_masked", in2: "displaced", mode: "normal", result: "with_sat" }),
    svgEl("feBlend", { in: "spec_faded", in2: "with_sat", mode: "normal" }),
  );
  return filter;
}

export interface GlassHandle {
  rebuild: () => void;
  destroy: () => void;
}

/** Turns `el` into a refracting lens. Call `destroy()` to restore it. */
export function applyGlass(el: HTMLElement, getConfig: () => GlassConfig): GlassHandle {
  if (getComputedStyle(el).position === "static") el.style.position = "relative";
  const refr = document.createElement("div");
  const tint = document.createElement("div");
  for (const layer of [refr, tint]) {
    layer.dataset.lgLayer = "";
    layer.style.cssText = "position:absolute;inset:0;z-index:0;pointer-events:none;";
  }
  el.insertBefore(tint, el.firstChild);
  el.insertBefore(refr, el.firstChild);
  let filterNode: SVGFilterElement | null = null;
  let timer: number | undefined;
  const refraction = supportsRefraction();

  const rebuild = () => {
    const w = Math.round(el.offsetWidth);
    const h = Math.round(el.offsetHeight);
    if (w < 4 || h < 4) return;
    const dataR = parseFloat(el.getAttribute("data-radius") || "0");
    const cssR = parseFloat(getComputedStyle(el).borderTopLeftRadius || "0");
    const r = Math.max(2, Math.min(dataR || cssR || 24, w / 2, h / 2));
    const cfg = getConfig();
    if (refraction) {
      filterNode?.remove();
      const id = `lg-${Math.random().toString(36).slice(2, 10)}`;
      filterNode = buildFilter(id, w, h, r, cfg) as SVGFilterElement;
      ensureDefs().appendChild(filterNode);
      refr.style.backdropFilter = `url(#${id})`;
      (refr.style as CSSStyleDeclaration & { webkitBackdropFilter?: string }).webkitBackdropFilter = `url(#${id})`;
    } else {
      refr.style.backdropFilter = "blur(2px) saturate(1.6) brightness(1.08)";
      (refr.style as CSSStyleDeclaration & { webkitBackdropFilter?: string }).webkitBackdropFilter = "blur(2px) saturate(1.6) brightness(1.08)";
    }
    refr.style.borderRadius = `${r}px`;
    tint.style.borderRadius = `${r}px`;
    tint.style.backgroundColor = `rgba(${cfg.tintColor},${cfg.tintOpacity})`;
    tint.style.boxShadow = `inset 0 0 ${cfg.innerShadowBlur}px ${cfg.innerShadowSpread}px ${cfg.innerShadow}`;
  };
  const schedule = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(rebuild, 16);
  };
  const ro = new ResizeObserver(schedule);
  ro.observe(el);
  rebuild();
  return {
    rebuild,
    destroy() {
      window.clearTimeout(timer);
      ro.disconnect();
      filterNode?.remove();
      refr.remove();
      tint.remove();
    },
  };
}
