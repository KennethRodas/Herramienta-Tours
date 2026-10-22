"use client";

import { useEffect, useEffectEvent, useState, type RefObject } from "react";
import type { Map as MLMap } from "maplibre-gl";
import { loadMapLibre, type MapLibre } from "./maplibre";

export type MapStatus = "loading" | "ready" | "unsupported" | "error";

export interface MapHandle {
  status: MapStatus;
  map: MLMap | null;
  ml: MapLibre | null;
}

/**
 * Owns one map: loads maplibre, creates the map in `containerRef` once the box
 * has a size, hands it out as soon as its style has loaded (tiles keep
 * streaming in after that) and removes it, WebGL context included, on unmount.
 *
 * Ready on `style.load`, not `load`: `load` waits for every visible tile of
 * every source (DEM included), which on a slow link or a software GPU can take
 * long enough to leave the map hidden behind its placeholder.
 */
export function useMap(
  containerRef: RefObject<HTMLDivElement | null>,
  enabled: boolean,
  init: (ml: MapLibre, container: HTMLDivElement) => MLMap,
): MapHandle {
  const [state, setState] = useState<MapHandle>(() => ({
    status: enabled ? "loading" : "unsupported",
    map: null,
    ml: null,
  }));
  const create = useEffectEvent(init);

  useEffect(() => {
    const container = containerRef.current;
    if (!enabled || !container) return;
    let cancelled = false;
    let map: MLMap | null = null;
    let sizeWatch: ResizeObserver | null = null;
    // Start fetching the library while the box may still be collapsed.
    const lib = loadMapLibre();

    const start = () => {
      lib.then(
        (ml) => {
          if (cancelled) return;
          try {
            map = create(ml, container);
          } catch {
            // GPUInitializationError or a lost context: the fallback takes over.
            setState({ status: "error", map: null, ml: null });
            return;
          }
          const created = map;
          created.once("style.load", () => {
            if (!cancelled) setState({ status: "ready", map: created, ml });
          });
        },
        () => {
          if (!cancelled) setState({ status: "error", map: null, ml: null });
        },
      );
    };

    // A map created in a 0×0 box (a collapsed panel, a section still being
    // revealed) starts with a dead canvas; wait for real dimensions.
    const sized = () => container.clientWidth > 0 && container.clientHeight > 0;
    if (sized()) {
      start();
    } else {
      sizeWatch = new ResizeObserver(() => {
        if (!sized()) return;
        sizeWatch?.disconnect();
        sizeWatch = null;
        start();
      });
      sizeWatch.observe(container);
    }

    return () => {
      cancelled = true;
      sizeWatch?.disconnect();
      map?.remove();
    };
  }, [containerRef, enabled]);

  return state;
}

/** Calls `fn` at most once per animation frame. */
export function frameThrottle(fn: () => void) {
  let raf = 0;
  const run = () => {
    raf = 0;
    fn();
  };
  const schedule = () => {
    if (!raf) raf = requestAnimationFrame(run);
  };
  schedule.cancel = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };
  return schedule;
}
