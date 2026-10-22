"use client";

import type { Map as MLMap, MapOptions } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "./map.css";

export type MapLibre = typeof import("maplibre-gl");

/**
 * The map container fills its parent. Inline on purpose: maplibre's own CSS
 * gives .maplibregl-map `position: relative`, which outranks utility classes.
 */
export const MAP_BOX = { position: "absolute", inset: 0 } as const;

// maplibre-gl v6 starts its worker from a file next to its own bundle, found
// through import.meta.url. Turbopack moves the bundle (and rewrites that URL to
// file://), so the worker is emitted as an asset here and handed over by URL.
const WORKER_URL = new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url);

let loading: Promise<MapLibre> | null = null;

/** Loads maplibre-gl once per page; later maps reuse the module and its workers. */
export function loadMapLibre(): Promise<MapLibre> {
  if (!loading) {
    loading = import("maplibre-gl")
      .then((ml) => {
        ml.setWorkerUrl(WORKER_URL.href);
        return ml;
      })
      .catch((error: unknown) => {
        loading = null;
        throw error;
      });
  }
  return loading;
}

let webgl2: boolean | null = null;

/** maplibre-gl v6 draws with WebGL2 only. */
export function supportsWebGL2(): boolean {
  if (webgl2 !== null) return webgl2;
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2");
    webgl2 = Boolean(gl);
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    webgl2 = false;
  }
  return webgl2;
}

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export const LOCALE_ES: Record<string, string> = {
  "AttributionControl.ToggleAttribution": "Créditos del mapa",
  "AttributionControl.MapFeedback": "Reportar un error del mapa",
  "Map.Title": "Mapa",
  "Marker.Title": "Marcador",
  "NavigationControl.ResetBearing": "Orientar al norte",
  "NavigationControl.ZoomIn": "Acercar",
  "NavigationControl.ZoomOut": "Alejar",
  "TerrainControl.Enable": "Activar relieve",
  "TerrainControl.Disable": "Quitar relieve",
  "CooperativeGesturesHandler.WindowsHelpText": "Usá Ctrl + rueda para acercar el mapa",
  "CooperativeGesturesHandler.MacHelpText": "Usá ⌘ + rueda para acercar el mapa",
  "CooperativeGesturesHandler.MobileHelpText": "Usá dos dedos para mover el mapa",
};

/** A map with the shared defaults: Spanish UI, compact credits, quiet tile errors. */
export function createMap(ml: MapLibre, options: MapOptions): MLMap {
  const map = new ml.Map({
    attributionControl: { compact: true },
    maplibreLogo: false,
    locale: LOCALE_ES,
    pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
    fadeDuration: 180,
    maxPitch: 76,
    dragRotate: true,
    ...options,
  });
  // A missing tile or glyph must never reach the visitor (or the console):
  // the map keeps drawing what it has. Listening here also stops maplibre's
  // default console.error for each failed request.
  map.on("error", (e) => {
    if (process.env.NODE_ENV === "development") console.debug("[map]", e.error?.message ?? e);
  });
  // maplibre opens the compact credits each time they first fill in (as each
  // source's attribution arrives); keep them folded to the "i" until the
  // visitor opens them, so they never cover the map's own keys.
  let opened = false;
  const container = map.getContainer();
  const onClick = (e: Event) => {
    if ((e.target as Element | null)?.closest?.(".maplibregl-ctrl-attrib-button")) opened = true;
  };
  const fold = () => {
    if (opened) return;
    const attrib = container.querySelector(".maplibregl-ctrl-attrib");
    if (!attrib?.classList.contains("maplibregl-compact-show")) return;
    attrib.classList.remove("maplibregl-compact-show");
    attrib.removeAttribute("open");
  };
  container.addEventListener("click", onClick, true);
  map.on("sourcedata", fold);
  map.on("styledata", fold);
  map.once("load", () => {
    fold();
    map.off("sourcedata", fold);
    map.off("styledata", fold);
  });
  map.once("remove", () => container.removeEventListener("click", onClick, true));
  return map;
}
