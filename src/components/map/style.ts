import type { ExpressionSpecification, LayerSpecification, SkySpecification, StyleSpecification } from "maplibre-gl";
import type { LL } from "./geo";
import { tint, type Inks } from "./inks";

// The printed map: Wilber's two inks, cobalt on sand, over a real relief.
// - Land is the sand page; height is printed as cobalt screens (hypsometric
//   bands) plus a cobalt/sand hillshade, like a two-colour lithograph.
// - Water is solid cobalt; roads and places are cobalt tints; labels sparse.
// Sources need no keys: OpenFreeMap vector tiles, Mapzen/AWS Terrarium DEM,
// optional Esri World Imagery for the satellite view.

export const OFM_TILEJSON = "https://tiles.openfreemap.org/planet";
export const OFM_GLYPHS = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";
export const TERRARIUM_TILES = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";
export const ESRI_TILES = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

export const TERRAIN_SOURCE = "dem-terrain";
export const SHADE_SOURCE = "dem-shade";
export const TERRAIN_EXAGGERATION = 1.4;
export const SATELLITE_LAYER = "satelite";
/** Route layers go under this one, so place labels print on top. */
export const FIRST_LABEL_LAYER = "l-country";
/** Layers the satellite view covers; hidden then to save GPU work. */
export const RELIEF_LAYERS = ["b-relief", "b-hillshade"] as const;

const ATTR_TERRAIN =
  '<a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md" target="_blank" rel="noopener">Mapzen / AWS Terrain Tiles</a>';
const ATTR_ESRI = 'Imágenes <a href="https://www.esri.com/" target="_blank" rel="noopener">© Esri</a>, Maxar, Earthstar Geographics';

/** El Salvador, with the Trifinio and the gulf. */
export const SV_BOUNDS: [LL, LL] = [
  [-90.15, 13.12],
  [-87.65, 14.46],
];

export const FONT_REGULAR = ["Noto Sans Regular"];
export const FONT_BOLD = ["Noto Sans Bold"];
export const FONT_ITALIC = ["Noto Sans Italic"];

const NAME: ExpressionSpecification = ["coalesce", ["get", "name:es"], ["get", "name"]];
const byZoom = (...stops: number[]): ExpressionSpecification =>
  ["interpolate", ["linear"], ["zoom"], ...stops] as ExpressionSpecification;
const byZoomExp = (...stops: number[]): ExpressionSpecification =>
  ["interpolate", ["exponential", 1.5], ["zoom"], ...stops] as ExpressionSpecification;

/**
 * Elevation printed as cobalt screens in 400 m bands. color-relief only
 * interpolates, so each band edge is two stops one metre apart.
 */
function reliefBands(ink: Inks): ExpressionSpecification {
  const bands: [number, number][] = [
    [-50, 0],
    [200, 0.035],
    [600, 0.06],
    [1000, 0.085],
    [1400, 0.11],
    [1800, 0.14],
    [2200, 0.17],
  ];
  const stops: (number | string)[] = [];
  bands.forEach(([from, opacity], i) => {
    if (i > 0) stops.push(from - 1, tint(ink.cobalt800, bands[i - 1][1]));
    stops.push(from, tint(ink.cobalt800, opacity));
  });
  stops.push(4000, tint(ink.cobalt800, 0.17));
  return ["interpolate", ["linear"], ["elevation"], ...stops] as ExpressionSpecification;
}

export function sky(ink: Inks): SkySpecification {
  return {
    "sky-color": ink.sand100,
    "horizon-color": ink.sand50,
    "fog-color": ink.sand200,
    "fog-ground-blend": 0.75,
    "horizon-fog-blend": 0.6,
    "sky-horizon-blend": 0.75,
    "atmosphere-blend": 0,
  };
}

export interface StyleOptions {
  /** Drape the map over the DEM (3D). */
  terrain?: boolean;
  satellite?: boolean;
}

export function buildStyle(ink: Inks, opts: StyleOptions = {}): StyleSpecification {
  const halo = ink.sand200;
  const layers: LayerSpecification[] = [
    { id: "b-bg", type: "background", paint: { "background-color": ink.sand200 } },
    {
      id: "b-relief",
      type: "color-relief",
      source: SHADE_SOURCE,
      paint: { "color-relief-color": reliefBands(ink), "color-relief-opacity": 1 },
    },
    {
      id: "b-wood",
      type: "fill",
      source: "ofm",
      "source-layer": "landcover",
      filter: ["match", ["get", "class"], ["wood", "forest"], true, false],
      paint: { "fill-color": ink.sand300, "fill-opacity": byZoom(6, 0.25, 12, 0.5) },
    },
    {
      // Four lights, NW strongest: an engraved, lithographic relief in the two inks.
      id: "b-hillshade",
      type: "hillshade",
      source: SHADE_SOURCE,
      paint: {
        "hillshade-method": "multidirectional",
        // Fades at street level, where a 30 m DEM can only print soft blotches.
        "hillshade-exaggeration": byZoom(6, 0.55, 12, 0.7, 14, 0.55, 16, 0.25),
        "hillshade-illumination-direction": [270, 315, 0, 45],
        "hillshade-illumination-altitude": [30, 35, 30, 30],
        "hillshade-illumination-anchor": "map",
        "hillshade-shadow-color": [
          tint(ink.cobalt800, 0.3),
          tint(ink.cobalt800, 0.4),
          tint(ink.cobalt800, 0.3),
          tint(ink.cobalt800, 0.16),
        ],
        "hillshade-highlight-color": [tint(ink.sand50, 0.15), tint(ink.sand50, 0.4), tint(ink.sand50, 0.15), tint(ink.sand50, 0.1)],
        "hillshade-accent-color": tint(ink.cobalt900, 0.3),
      },
    },
    {
      id: "b-park",
      type: "line",
      source: "ofm",
      "source-layer": "park",
      minzoom: 9,
      paint: { "line-color": tint(ink.cobalt600, 0.55), "line-width": byZoom(9, 0.8, 14, 1.6), "line-dasharray": [2, 2] },
    },
    {
      id: "b-water",
      type: "fill",
      source: "ofm",
      "source-layer": "water",
      filter: ["!=", ["get", "brunnel"], "tunnel"],
      paint: { "fill-color": ink.cobalt800 },
    },
    {
      id: "b-river",
      type: "line",
      source: "ofm",
      "source-layer": "waterway",
      minzoom: 8,
      filter: ["all", ["==", ["get", "class"], "river"], ["!=", ["get", "brunnel"], "tunnel"]],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": ink.cobalt800, "line-width": byZoomExp(8, 0.6, 12, 1.6, 16, 4) },
    },
    {
      id: "b-stream",
      type: "line",
      source: "ofm",
      "source-layer": "waterway",
      minzoom: 12,
      filter: ["all", ["!=", ["get", "class"], "river"], ["!=", ["get", "brunnel"], "tunnel"]],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": tint(ink.cobalt800, 0.55), "line-width": byZoomExp(12, 0.4, 16, 1.4) },
    },
    {
      id: "b-building",
      type: "fill",
      source: "ofm",
      "source-layer": "building",
      minzoom: 14,
      paint: { "fill-color": ink.sand400, "fill-opacity": 0.7 },
    },
    {
      id: "b-road-minor",
      type: "line",
      source: "ofm",
      "source-layer": "transportation",
      minzoom: 12,
      filter: ["match", ["get", "class"], ["minor", "service"], true, false],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": tint(ink.cobalt600, 0.45), "line-width": byZoomExp(12, 0.5, 16, 3) },
    },
    {
      id: "b-track",
      type: "line",
      source: "ofm",
      "source-layer": "transportation",
      minzoom: 12,
      filter: ["==", ["get", "class"], "track"],
      paint: { "line-color": tint(ink.cobalt600, 0.7), "line-width": byZoom(12, 0.6, 16, 1.6), "line-dasharray": [3, 2] },
    },
    {
      id: "b-path",
      type: "line",
      source: "ofm",
      "source-layer": "transportation",
      minzoom: 13,
      filter: ["==", ["get", "class"], "path"],
      paint: { "line-color": tint(ink.cobalt800, 0.75), "line-width": byZoom(13, 0.7, 17, 1.8), "line-dasharray": [1.5, 1.5] },
    },
    {
      id: "b-road-secondary",
      type: "line",
      source: "ofm",
      "source-layer": "transportation",
      minzoom: 9,
      filter: ["match", ["get", "class"], ["secondary", "tertiary"], true, false],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": tint(ink.cobalt600, 0.6), "line-width": byZoomExp(9, 0.5, 12, 1.2, 16, 5) },
    },
    {
      id: "b-road-primary",
      type: "line",
      source: "ofm",
      "source-layer": "transportation",
      minzoom: 6,
      filter: ["match", ["get", "class"], ["primary", "trunk", "motorway"], true, false],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": ink.cobalt600, "line-width": byZoomExp(6, 0.5, 10, 1.3, 16, 6) },
    },
    {
      id: "b-boundary-dept",
      type: "line",
      source: "ofm",
      "source-layer": "boundary",
      minzoom: 8,
      filter: ["all", ["==", ["get", "admin_level"], 4], ["!=", ["get", "maritime"], 1]],
      paint: { "line-color": tint(ink.cobalt600, 0.4), "line-width": 1, "line-dasharray": [1, 2] },
    },
    {
      id: "b-boundary-country",
      type: "line",
      source: "ofm",
      "source-layer": "boundary",
      filter: ["all", ["==", ["get", "admin_level"], 2], ["!=", ["get", "maritime"], 1]],
      paint: { "line-color": tint(ink.cobalt800, 0.7), "line-width": byZoom(6, 1, 12, 2), "line-dasharray": [4, 2, 1, 2] },
    },
    {
      id: SATELLITE_LAYER,
      type: "raster",
      source: "sat",
      layout: { visibility: opts.satellite ? "visible" : "none" },
      paint: { "raster-fade-duration": 150 },
    },
    // Labels: sparse, cobalt with a sand halo.
    {
      id: FIRST_LABEL_LAYER,
      type: "symbol",
      source: "ofm",
      "source-layer": "place",
      maxzoom: 10,
      filter: ["==", ["get", "class"], "country"],
      layout: {
        "text-field": NAME,
        "text-font": FONT_BOLD,
        "text-size": 13,
        "text-transform": "uppercase",
        "text-letter-spacing": 0.3,
      },
      paint: { "text-color": ink.cobalt600, "text-halo-color": halo, "text-halo-width": 1.5 },
    },
    {
      id: "l-water",
      type: "symbol",
      source: "ofm",
      "source-layer": "water_name",
      minzoom: 6,
      filter: ["match", ["geometry-type"], ["Point", "MultiPoint"], true, false],
      layout: {
        "text-field": NAME,
        "text-font": FONT_ITALIC,
        "text-size": byZoom(6, 13, 12, 15),
        "text-letter-spacing": 0.12,
        "text-max-width": 7,
      },
      paint: { "text-color": ink.sand100 },
    },
    {
      id: "l-peak",
      type: "symbol",
      source: "ofm",
      "source-layer": "mountain_peak",
      minzoom: 11,
      filter: ["all", ["match", ["get", "class"], ["peak", "volcano"], true, false], ["has", "name"]],
      layout: {
        "text-field": [
          "format",
          NAME,
          {},
          "\n",
          {},
          ["concat", ["number-format", ["get", "ele"], { locale: "en-US" }], " m"],
          { "font-scale": 0.85 },
        ],
        "text-font": FONT_ITALIC,
        "text-size": 13,
        "text-max-width": 8,
        "text-padding": 6,
        // Below the summit: the route tickets stand above their points.
        "text-anchor": "top",
        "text-offset": [0, 0.7],
        "symbol-sort-key": ["get", "rank"],
      },
      paint: { "text-color": ink.cobalt800, "text-halo-color": halo, "text-halo-width": 1.4 },
    },
    {
      id: "l-village",
      type: "symbol",
      source: "ofm",
      "source-layer": "place",
      minzoom: 14.5,
      filter: ["==", ["get", "class"], "village"],
      layout: { "text-field": NAME, "text-font": FONT_REGULAR, "text-size": 13, "text-padding": 6 },
      paint: { "text-color": ink.cobalt600, "text-halo-color": halo, "text-halo-width": 1.4 },
    },
    {
      id: "l-town",
      type: "symbol",
      source: "ofm",
      "source-layer": "place",
      minzoom: 9.5,
      filter: ["==", ["get", "class"], "town"],
      layout: { "text-field": NAME, "text-font": FONT_REGULAR, "text-size": byZoom(9.5, 13, 14, 15), "text-padding": 6 },
      paint: { "text-color": ink.cobalt800, "text-halo-color": halo, "text-halo-width": 1.5 },
    },
    {
      id: "l-city",
      type: "symbol",
      source: "ofm",
      "source-layer": "place",
      minzoom: 7,
      filter: ["==", ["get", "class"], "city"],
      layout: {
        "text-field": NAME,
        "text-font": FONT_BOLD,
        "text-size": byZoom(7, 13, 12, 17),
        "text-transform": "uppercase",
        "text-letter-spacing": 0.08,
        "text-padding": 8,
        "symbol-sort-key": ["*", -1, ["coalesce", ["get", "capital"], 0]],
      },
      paint: { "text-color": ink.cobalt800, "text-halo-color": halo, "text-halo-width": 1.6 },
    },
  ];

  return {
    version: 8,
    glyphs: OFM_GLYPHS,
    sources: {
      ofm: { type: "vector", url: OFM_TILEJSON },
      [TERRAIN_SOURCE]: {
        type: "raster-dem",
        tiles: [TERRARIUM_TILES],
        encoding: "terrarium",
        tileSize: 256,
        maxzoom: 15,
        attribution: ATTR_TERRAIN,
      },
      [SHADE_SOURCE]: {
        type: "raster-dem",
        tiles: [TERRARIUM_TILES],
        encoding: "terrarium",
        tileSize: 256,
        maxzoom: 15,
        attribution: ATTR_TERRAIN,
      },
      sat: {
        type: "raster",
        tiles: [ESRI_TILES],
        tileSize: 256,
        maxzoom: 19,
        attribution: ATTR_ESRI,
      },
    },
    layers,
    sky: sky(ink),
    ...(opts.terrain ? { terrain: { source: TERRAIN_SOURCE, exaggeration: TERRAIN_EXAGGERATION } } : {}),
  };
}
