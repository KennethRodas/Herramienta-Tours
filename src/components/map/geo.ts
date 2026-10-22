// Plain geometry for routes: distances on the sphere (haversine), positions
// along a polyline, bearings, snapping and elevation statistics. No map, no DOM.

export type LL = [number, number]; // [lng, lat]

const R = 6371008.8;
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Great-circle distance in metres. */
export function haversine(a: LL, b: LL): number {
  const dLat = rad(b[1] - a[1]);
  const dLng = rad(b[0] - a[0]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Initial compass bearing from a to b, 0–360°. */
export function bearing(a: LL, b: LL): number {
  const p1 = rad(a[1]);
  const p2 = rad(b[1]);
  const dl = rad(b[0] - a[0]);
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

/** Signed shortest turn from bearing a to bearing b, in (−180, 180]. */
export function turn(a: number, b: number): number {
  return ((((b - a) % 360) + 540) % 360) - 180;
}

export interface Line {
  path: LL[];
  /** Distance from the start to each vertex, metres. */
  cum: number[];
  length: number;
}

export function toLine(path: LL[]): Line {
  const cum = [0];
  for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + haversine(path[i - 1], path[i]));
  return { path, cum, length: cum[cum.length - 1] ?? 0 };
}

/** The point `d` metres from the start, clamped to the line. */
export function along(line: Line, d: number): LL {
  const { path, cum } = line;
  if (path.length === 0) return [0, 0];
  if (path.length === 1 || d <= 0) return path[0];
  if (d >= line.length) return path[path.length - 1];
  let lo = 0;
  let hi = cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= d) lo = mid;
    else hi = mid;
  }
  const seg = cum[hi] - cum[lo];
  const t = seg > 0 ? (d - cum[lo]) / seg : 0;
  const a = path[lo];
  const b = path[hi];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

export interface Snap {
  /** Distance along the line, metres. */
  d: number;
  /** Distance from the point to the line, metres. */
  off: number;
  point: LL;
  /** Index of the segment's first vertex. */
  seg: number;
}

/** Closest point of the line to `p` (local equirectangular projection; fine at trail scale). */
export function snap(line: Line, p: LL): Snap {
  const { path, cum } = line;
  if (path.length === 0) return { d: 0, off: Infinity, point: p, seg: 0 };
  if (path.length === 1) return { d: 0, off: haversine(path[0], p), point: path[0], seg: 0 };
  const k = Math.cos(rad(p[1]));
  const m = 111_320; // metres per degree of latitude
  let best: Snap = { d: 0, off: Infinity, point: path[0], seg: 0 };
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const ax = a[0] * k;
    const bx = b[0] * k;
    const px = p[0] * k;
    const dx = bx - ax;
    const dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy;
    const t = len2 > 0 ? clamp(((px - ax) * dx + (p[1] - a[1]) * dy) / len2, 0, 1) : 0;
    const qx = ax + dx * t;
    const qy = a[1] + dy * t;
    const off = Math.hypot(px - qx, p[1] - qy) * m;
    if (off < best.off) {
      best = { d: cum[i - 1] + (cum[i] - cum[i - 1]) * t, off, point: [qx / k, qy], seg: i - 1 };
    }
  }
  return best;
}

/** `n` evenly spaced samples along the line (n ≥ 2). */
export function resample(line: Line, n: number): { d: number[]; points: LL[] } {
  const count = Math.max(2, Math.round(n));
  const d: number[] = [];
  const points: LL[] = [];
  for (let i = 0; i < count; i++) {
    const x = (line.length * i) / (count - 1);
    d.push(x);
    points.push(along(line, x));
  }
  return { d, points };
}

export function boundsOf(paths: LL[][]): [LL, LL] | null {
  let w = Infinity;
  let s = Infinity;
  let e = -Infinity;
  let n = -Infinity;
  for (const path of paths) {
    for (const [lng, lat] of path) {
      if (lng < w) w = lng;
      if (lng > e) e = lng;
      if (lat < s) s = lat;
      if (lat > n) n = lat;
    }
  }
  return Number.isFinite(w) ? [[w, s], [e, n]] : null;
}

/** Centred moving average; keeps the ends anchored. */
export function smooth(values: number[], radius: number): number[] {
  if (radius < 1 || values.length < 3) return values.slice();
  return values.map((_, i) => {
    const lo = Math.max(0, i - radius);
    const hi = Math.min(values.length - 1, i + radius);
    let sum = 0;
    for (let j = lo; j <= hi; j++) sum += values[j];
    return sum / (hi - lo + 1);
  });
}

/**
 * Accumulated climb and descent with a dead band, so DEM noise on a flat
 * stretch does not add phantom metres.
 */
export function climb(values: number[], threshold = 3): { gain: number; loss: number } {
  if (values.length < 2) return { gain: 0, loss: 0 };
  let gain = 0;
  let loss = 0;
  let ref = values[0];
  for (let i = 1; i < values.length; i++) {
    const v = values[i];
    if (v - ref >= threshold) {
      gain += v - ref;
      ref = v;
    } else if (ref - v >= threshold) {
      loss += ref - v;
      ref = v;
    }
  }
  return { gain, loss };
}

/** Linear interpolation of known altitudes over distance; ends hold flat. */
export function interpolateAt(knots: { d: number; v: number }[], d: number): number {
  if (knots.length === 0) return 0;
  if (d <= knots[0].d) return knots[0].v;
  for (let i = 1; i < knots.length; i++) {
    if (d <= knots[i].d) {
      const a = knots[i - 1];
      const b = knots[i];
      const t = b.d > a.d ? (d - a.d) / (b.d - a.d) : 0;
      return a.v + (b.v - a.v) * t;
    }
  }
  return knots[knots.length - 1].v;
}

/** Round step (1, 2, 2.5, 5 × 10^n) giving about `target` intervals over `range`. */
export function niceStep(range: number, target: number): number {
  if (!(range > 0)) return 1;
  const raw = range / Math.max(1, target);
  const pow = 10 ** Math.floor(Math.log10(raw));
  const f = raw / pow;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * pow;
}

export function ticks(min: number, max: number, target: number): number[] {
  const step = niceStep(max - min, target);
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-6; v += step) out.push(+v.toFixed(6));
  return out;
}

/** Ease for camera moves on screen: the codebase's ease-in-out curve, (0.77, 0, 0.175, 1). */
export function easeInOut(t: number): number {
  return cubicBezier(0.77, 0, 0.175, 1, clamp(t, 0, 1));
}

/** Ease for responses to a press (zoom keys): the codebase's ease-out curve, (0.23, 1, 0.32, 1). */
export function easeOut(t: number): number {
  return cubicBezier(0.23, 1, 0.32, 1, clamp(t, 0, 1));
}

function cubicBezier(x1: number, y1: number, x2: number, y2: number, x: number): number {
  // Solve x(t) = x with Newton, falling back to bisection, then return y(t).
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sy = (t: number) => ((ay * t + by) * t + cy) * t;
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  let t = x;
  for (let i = 0; i < 8; i++) {
    const err = sx(t) - x;
    if (Math.abs(err) < 1e-6) return sy(t);
    const slope = dx(t);
    if (Math.abs(slope) < 1e-6) break;
    t -= err / slope;
  }
  let lo = 0;
  let hi = 1;
  t = x;
  for (let i = 0; i < 30; i++) {
    const v = sx(t);
    if (Math.abs(v - x) < 1e-6) break;
    if (v < x) lo = t;
    else hi = t;
    t = (lo + hi) / 2;
  }
  return sy(t);
}
