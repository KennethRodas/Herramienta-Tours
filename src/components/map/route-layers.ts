import type { ExpressionSpecification, GeoJSONSource, Map as MLMap } from "maplibre-gl";
import type { LL } from "./geo";
import type { Inks } from "./inks";
import { FIRST_LABEL_LAYER } from "./style";

// Route lines: a sand casing under a cobalt line, like a route overprinted on a
// relief sheet. Selection, hover and dimming are feature-state, so changing them
// never re-tiles the data.

export interface RouteLine {
  id: string;
  path: LL[];
}

export type RouteFeatures = GeoJSON.FeatureCollection<GeoJSON.LineString, { tid: string }>;

/** Feature ids are the position in `routes` plus one, so feature-state can address them. */
export function routeFeatures(routes: RouteLine[]): RouteFeatures {
  return {
    type: "FeatureCollection",
    features: routes.flatMap((r, i) =>
      r.path.length >= 2
        ? [
            {
              type: "Feature" as const,
              id: i + 1,
              properties: { tid: r.id },
              geometry: { type: "LineString" as const, coordinates: r.path },
            },
          ]
        : [],
    ),
  };
}

const SELECTED: ExpressionSpecification = ["boolean", ["feature-state", "selected"], false];
const HOVER: ExpressionSpecification = ["boolean", ["feature-state", "hover"], false];
const DIM: ExpressionSpecification = ["boolean", ["feature-state", "dim"], false];

/** line width by zoom, thicker when selected or hovered. */
function width(base: [number, number, number], extra: number): ExpressionSpecification {
  const at = (w: number): ExpressionSpecification => ["case", SELECTED, w + extra, HOVER, w + extra * 0.6, w];
  return ["interpolate", ["linear"], ["zoom"], 7, at(base[0]), 12, at(base[1]), 16, at(base[2])];
}

export interface RouteLayerOptions {
  source: string;
  /** Adds a gradient layer that inks the walked part during "Recorrer la ruta". */
  progress?: boolean;
  /** Thicker everything, for a single-route map. */
  bold?: boolean;
}

export function addRouteLayers(map: MLMap, ink: Inks, data: RouteFeatures, opts: RouteLayerOptions) {
  const { source } = opts;
  const before = map.getLayer(FIRST_LABEL_LAYER) ? FIRST_LABEL_LAYER : undefined;
  const k = opts.bold ? 1.35 : 1;
  map.addSource(source, { type: "geojson", data, lineMetrics: Boolean(opts.progress) });
  map.addLayer(
    {
      id: `${source}-casing`,
      type: "line",
      source,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": ink.sand50,
        "line-width": width([3.5 * k, 7 * k, 10 * k], 3),
        "line-opacity": ["case", DIM, 0.55, 1],
      },
    },
    before,
  );
  map.addLayer(
    {
      id: `${source}-line`,
      type: "line",
      source,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": ink.cobalt800,
        "line-width": width([1.6 * k, 3.4 * k, 5 * k], 2.2),
        "line-opacity": ["case", DIM, 0.45, 1],
      },
    },
    before,
  );
  if (opts.progress) {
    map.addLayer(
      {
        id: `${source}-progress`,
        type: "line",
        source,
        layout: { "line-cap": "round", "line-join": "round", visibility: "none" },
        paint: {
          "line-color": ink.cobalt950,
          "line-width": width([3 * k, 5.5 * k, 7.5 * k], 0),
          "line-gradient": progressGradient(ink, 0),
        },
      },
      before,
    );
  }
  // Invisible and wide: easy to hover and tap.
  map.addLayer(
    {
      id: `${source}-hit`,
      type: "line",
      source,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": "rgba(0, 0, 0, 0)", "line-width": 22 },
    },
    before,
  );
}

export function progressGradient(ink: Inks, fraction: number): ExpressionSpecification {
  const f = Math.min(Math.max(fraction, 0), 1);
  if (f <= 0) return ["step", ["line-progress"], "rgba(0, 0, 0, 0)", 0, "rgba(0, 0, 0, 0)"];
  if (f >= 1) return ["step", ["line-progress"], ink.cobalt950, 1, ink.cobalt950];
  return ["step", ["line-progress"], ink.cobalt950, f, "rgba(0, 0, 0, 0)"];
}

export function setRouteData(map: MLMap, source: string, data: RouteFeatures) {
  (map.getSource(source) as GeoJSONSource | undefined)?.setData(data);
}

export function removeRouteLayers(map: MLMap, source: string) {
  for (const id of [`${source}-hit`, `${source}-progress`, `${source}-line`, `${source}-casing`]) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
  if (map.getSource(source)) map.removeSource(source);
}
