import type { Map as MLMap } from "maplibre-gl";
import type { Waypoint } from "@/lib/domain/types";
import { climb, interpolateAt, resample, smooth, snap, type Line } from "./geo";
import { TERRAIN_EXAGGERATION } from "./style";

// Elevation profile data for a route: samples along the line from the DEM the
// map has loaded (map.queryTerrainElevation), or, until then or without WebGL,
// the waypoint altitudes interpolated over distance.

export interface ProfileWaypoint {
  id: string;
  name: string;
  kind: Waypoint["kind"];
  /** Distance along the route, metres. */
  d: number;
  altitude?: number;
}

export interface ProfileData {
  /** Sample positions along the route, metres. */
  d: number[];
  /** Elevation at each sample, metres above sea level. */
  e: number[];
  source: "dem" | "waypoints" | "none";
  length: number;
  gain: number;
  loss: number;
  min: number;
  max: number;
  waypoints: ProfileWaypoint[];
}

export function sampleCount(length: number) {
  return Math.min(240, Math.max(48, Math.round(length / 15)));
}

export function profileWaypoints(line: Line, waypoints: Waypoint[]): ProfileWaypoint[] {
  return waypoints
    .map((w) => ({ id: w.id, name: w.name, kind: w.kind, altitude: w.altitude, d: snap(line, [w.lng, w.lat]).d }))
    .sort((a, b) => a.d - b.d);
}

function finish(line: Line, d: number[], e: number[], source: ProfileData["source"], waypoints: ProfileWaypoint[], noise: number): ProfileData {
  const smoothed = source === "dem" ? smooth(e, 2) : e;
  const { gain, loss } = climb(smoothed, noise);
  let min = Infinity;
  let max = -Infinity;
  for (const v of e) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return {
    d,
    e,
    source,
    length: line.length,
    gain,
    loss,
    min: Number.isFinite(min) ? min : 0,
    max: Number.isFinite(max) ? max : 0,
    waypoints,
  };
}

export function profileFromWaypoints(line: Line, waypoints: Waypoint[]): ProfileData {
  const wps = profileWaypoints(line, waypoints);
  const knots = wps.filter((w) => w.altitude != null).map((w) => ({ d: w.d, v: w.altitude as number }));
  const { d } = resample(line, sampleCount(line.length));
  if (knots.length === 0) return finish(line, d, d.map(() => 0), "none", wps, 1);
  const e = d.map((x) => interpolateAt(knots, x));
  return finish(line, d, e, "waypoints", wps, 1);
}

/**
 * Samples the DEM along the line. Returns null while the DEM under the route
 * has not loaded (maplibre answers 0 there), so the caller can retry on idle.
 */
export function profileFromDEM(map: MLMap, line: Line, waypoints: Waypoint[]): ProfileData | null {
  if (!map.getTerrain() || line.length <= 0) return null;
  const { d, points } = resample(line, sampleCount(line.length));
  const e: number[] = [];
  let zeros = 0;
  for (const p of points) {
    const v = map.queryTerrainElevation(p);
    if (v === null || !Number.isFinite(v)) return null;
    if (v === 0) zeros++;
    e.push(v / TERRAIN_EXAGGERATION);
  }
  // A coast or mangrove route sits at 0 m for real; anywhere higher, zeros
  // mean tiles still loading.
  const known = waypoints.map((w) => w.altitude ?? 0);
  const highest = known.length ? Math.max(...known) : Math.max(...e);
  if (highest > 40 && zeros > points.length * 0.05) return null;
  return finish(line, d, e, "dem", profileWaypoints(line, waypoints), 4);
}

/** Elevation at distance `x` by linear interpolation over the samples. */
export function elevationAt(data: Pick<ProfileData, "d" | "e">, x: number): number {
  const { d, e } = data;
  if (d.length === 0) return 0;
  if (x <= d[0]) return e[0];
  if (x >= d[d.length - 1]) return e[e.length - 1];
  let lo = 0;
  let hi = d.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (d[mid] <= x) lo = mid;
    else hi = mid;
  }
  const t = d[hi] > d[lo] ? (x - d[lo]) / (d[hi] - d[lo]) : 0;
  return e[lo] + (e[hi] - e[lo]) * t;
}
