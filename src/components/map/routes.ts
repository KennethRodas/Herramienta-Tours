import { useMemo } from "react";
import type { Map as MLMap } from "maplibre-gl";
import type { Route, Tour, Waypoint } from "@/lib/domain/types";
import { along, boundsOf, clamp, easeInOut, toLine, type LL } from "./geo";
import type { MapPadding } from "./types";

// What the maps need from a tour, with an identity that only changes when the
// content does: the simulation re-creates tour objects on every state change,
// and a new object must not rebuild layers or markers.

export interface RouteGeo {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  priceUsd: number;
  difficulty: Tour["difficulty"];
  path: LL[];
  waypoints: Waypoint[];
  camera: Route["camera"];
  /** Where the tour's ticket stands on the overview: its top, else mid-route. */
  labelAt: LL;
}

function pick(t: Tour) {
  return {
    id: t.id,
    slug: t.slug,
    name: t.name,
    shortName: t.shortName,
    priceUsd: t.priceUsd,
    difficulty: t.difficulty,
    path: t.route.path,
    waypoints: t.route.waypoints,
    camera: t.route.camera,
  };
}

function withLabel(r: ReturnType<typeof pick>): RouteGeo {
  const top = r.waypoints.find((w) => w.kind === "cima");
  const line = toLine(r.path);
  const labelAt: LL = top ? [top.lng, top.lat] : r.path.length ? along(line, line.length / 2) : r.camera.center;
  return { ...r, labelAt };
}

export function useStableRoutes(tours: Tour[]): RouteGeo[] {
  const serial = JSON.stringify(tours.map(pick));
  return useMemo(() => (JSON.parse(serial) as ReturnType<typeof pick>[]).map(withLabel), [serial]);
}

export function useStableRoute(tour: Tour): RouteGeo {
  const serial = JSON.stringify(pick(tour));
  return useMemo(() => withLabel(JSON.parse(serial) as ReturnType<typeof pick>), [serial]);
}

export interface Pad {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export function toPadding(p: MapPadding | undefined, fallback: number): Pad {
  if (p === undefined) return { top: fallback, right: fallback, bottom: fallback, left: fallback };
  if (typeof p === "number") return { top: p, right: p, bottom: p, left: p };
  return { top: p.top ?? fallback, right: p.right ?? fallback, bottom: p.bottom ?? fallback, left: p.left ?? fallback };
}

export const OVERVIEW_PITCH = 55;
export const OVERVIEW_BEARING = -8;

export interface View {
  center: LL;
  zoom: number;
  pitch: number;
  bearing: number;
}

/**
 * The camera that fits `points` inside the padded box at a given tilt and
 * bearing. cameraForBounds fits a flat view; a tilted one shows the far side
 * smaller and the near side larger, so the fit is refined on the real
 * projection: a few synchronous jumps, then the map goes back to where it was
 * before anything is drawn.
 */
export function fitView(
  map: MLMap,
  points: LL[],
  padding: Pad,
  view: { pitch: number; bearing: number; minZoom?: number; maxZoom?: number },
): View | null {
  const box = boundsOf([points]);
  if (!box) return null;
  const minZoom = view.minZoom ?? 6.5;
  const maxZoom = view.maxZoom ?? 16.5;
  const flat = map.cameraForBounds(box, { padding, bearing: view.bearing });
  if (!flat || flat.zoom === undefined || !flat.center) return null;
  const c0 = flat.center as { lng: number; lat: number };
  if (view.pitch <= 0) {
    return { center: [c0.lng, c0.lat], zoom: clamp(flat.zoom, minZoom, maxZoom), pitch: 0, bearing: view.bearing };
  }

  const canvas = map.getCanvas();
  const W = canvas.clientWidth;
  const H = canvas.clientHeight;
  const availW = Math.max(40, W - padding.left - padding.right);
  const availH = Math.max(40, H - padding.top - padding.bottom);
  const saved = { center: map.getCenter(), zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing() };

  map.jumpTo({ center: flat.center, zoom: flat.zoom, pitch: view.pitch, bearing: view.bearing });
  for (let i = 0; i < 4; i++) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of points) {
      const q = map.project(p);
      minX = Math.min(minX, q.x);
      maxX = Math.max(maxX, q.x);
      minY = Math.min(minY, q.y);
      maxY = Math.max(maxY, q.y);
    }
    const scale = Math.min(availW / Math.max(maxX - minX, 1), availH / Math.max(maxY - minY, 1));
    const shiftX = (minX + maxX) / 2 - (padding.left + availW / 2);
    const shiftY = (minY + maxY) / 2 - (padding.top + availH / 2);
    const center = map.unproject([W / 2 + shiftX, H / 2 + shiftY]);
    map.jumpTo({ center, zoom: clamp(map.getZoom() + Math.log2(scale) * 0.85, minZoom, maxZoom) });
  }
  const c = map.getCenter();
  const result: View = { center: [c.lng, c.lat], zoom: map.getZoom(), pitch: view.pitch, bearing: view.bearing };
  map.jumpTo(saved);
  return result;
}

/** Every route, tilted. A lone short route keeps some country around it. */
export function overviewCamera(map: MLMap, routes: Pick<RouteGeo, "path">[], padding: Pad, pitch = OVERVIEW_PITCH) {
  const b = boundsOf(routes.map((r) => r.path));
  if (!b) return null;
  const minSpan = 0.08;
  const [[w, s], [e, n]] = b;
  const cx = (w + e) / 2;
  const cy = (s + n) / 2;
  const half = Math.max(e - w, n - s, minSpan) / 2;
  const box: [LL, LL] = [
    [Math.min(w, cx - half), Math.min(s, cy - half * 0.6)],
    [Math.max(e, cx + half), Math.max(n, cy + half * 0.6)],
  ];
  const corners: LL[] = [box[0], [box[1][0], box[0][1]], box[1], [box[0][0], box[1][1]]];
  return fitView(map, corners, padding, { pitch, bearing: OVERVIEW_BEARING, minZoom: 6.5, maxZoom: 13.5 });
}

/**
 * One route framed with its own camera (bearing, a 60–70° tilt), zoomed so the
 * whole trail and its tickets fit the box; never closer than the camera says.
 */
export function routeView(map: MLMap, route: Pick<RouteGeo, "path" | "waypoints" | "camera">, padding: Pad, three: boolean): View {
  const cam = routeCamera(route.camera, three);
  const points: LL[] = [...route.path, ...route.waypoints.map((w) => [w.lng, w.lat] as LL)];
  const fit = points.length >= 2 ? fitView(map, points, padding, { pitch: cam.pitch, bearing: cam.bearing, maxZoom: cam.zoom }) : null;
  return fit ?? { center: cam.center, zoom: cam.zoom, pitch: cam.pitch, bearing: cam.bearing };
}

/** The tour's own framing, kept in the 60–70° band the 3D views use. */
export function routeCamera(camera: Route["camera"], three: boolean) {
  return {
    center: camera.center,
    zoom: camera.zoom,
    pitch: three ? clamp(camera.pitch, 60, 70) : 0,
    bearing: camera.bearing,
  };
}

/**
 * Framing before the DEM loads is flat; once the relief under the view is in,
 * high points stand taller on screen. On the first idle this nudges the camera
 * to the terrain-aware framing (a short ease, or a jump with reduced motion),
 * unless the visitor has already moved the map.
 */
export function settleOnIdle(map: MLMap, compute: () => View | null, reduce: boolean): () => void {
  let touched = false;
  const onMoveStart = (e: { originalEvent?: unknown }) => {
    if (e.originalEvent) touched = true;
  };
  const onIdle = () => {
    map.off("movestart", onMoveStart);
    if (touched || !map.getTerrain()) return;
    const v = compute();
    if (!v) return;
    const a = map.project(v.center);
    const b = map.project(map.getCenter());
    if (Math.abs(v.zoom - map.getZoom()) < 0.04 && Math.hypot(a.x - b.x, a.y - b.y) < 6) return;
    map.easeTo({ ...v, duration: reduce ? 0 : 400, easing: easeInOut });
  };
  map.on("movestart", onMoveStart);
  map.once("idle", onIdle);
  return () => {
    map.off("movestart", onMoveStart);
    map.off("idle", onIdle);
  };
}
