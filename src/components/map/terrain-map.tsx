"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { MapLayerMouseEvent } from "maplibre-gl";
import { useReducedMotion } from "motion/react";
import { ArrowLeft, Satellite } from "lucide-react";
import { cn } from "@/lib/utils";
import { NavKeys, Segmented, ToggleKey, setBasemap, setDimension, type Basemap, type Dimension } from "./controls";
import { TerrainFallback } from "./fallback";
import { readInks } from "./inks";
import { flagMarker, placeLabels } from "./labels";
import { LoadingVeil } from "./lazy";
import { createMap, MAP_BOX, supportsWebGL2 } from "./maplibre";
import { KIND_PRIORITY, TourPin, WaypointPin, useMarkerSlots, type MarkerSpec } from "./markers";
import { addRouteLayers, removeRouteLayers, routeFeatures } from "./route-layers";
import { OVERVIEW_BEARING, OVERVIEW_PITCH, overviewCamera, routeCamera, routeView, settleOnIdle, toPadding, useStableRoutes, type Pad } from "./routes";
import { buildStyle } from "./style";
import type { TerrainMapProps } from "./types";
import { frameThrottle, useMap } from "./use-map";

const SOURCE = "routes";

/** Room above the highest point for its ticket. */
const withTickets = (p: Pad): Pad => ({ ...p, top: p.top + 52 });

export default function TerrainMapImpl({
  tours,
  focusTourId,
  onSelectTour,
  variant = "full",
  className,
  highlightTourId,
  onHoverTour,
  onClearFocus,
  padding,
}: TerrainMapProps) {
  const card = variant === "card";
  const containerRef = useRef<HTMLDivElement>(null);
  const [supported] = useState(supportsWebGL2);
  const [ink] = useState(readInks);
  const routes = useStableRoutes(tours);
  const [dimension, setDimensionState] = useState<Dimension>("3d");
  const [basemap, setBasemapState] = useState<Basemap>("mapa");
  const [hoverId, setHoverId] = useState<string | null>(null);
  const hover = highlightTourId ?? hoverId;
  const focus = useMemo(() => routes.find((r) => r.id === focusTourId) ?? null, [routes, focusTourId]);
  const pad = toPadding(padding, card ? 28 : 56);
  const reduce = useReducedMotion() ?? false;
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setNarrow(entry.contentRect.width < 640));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { map, ml, status } = useMap(containerRef, supported, (lib, container) => {
    const m = createMap(lib, {
      container,
      style: buildStyle(ink, { terrain: true }),
      center: focus?.camera.center ?? [-89.2, 13.75],
      zoom: focus?.camera.zoom ?? 8,
      pitch: focus ? routeCamera(focus.camera, true).pitch : OVERVIEW_PITCH,
      bearing: focus?.camera.bearing ?? OVERVIEW_BEARING,
      cooperativeGestures: card,
    });
    const cam = focus ? routeView(m, focus, withTickets(pad), true) : overviewCamera(m, routes, pad);
    if (cam) m.jumpTo(cam);
    return m;
  });

  // ---- Route lines ---------------------------------------------------------
  useEffect(() => {
    if (!map) return;
    addRouteLayers(map, ink, routeFeatures(routes), { source: SOURCE });
    return () => {
      try {
        removeRouteLayers(map, SOURCE);
      } catch {
        // The map was already removed.
      }
    };
  }, [map, ink, routes]);

  useEffect(() => {
    if (!map) return;
    routes.forEach((r, i) => {
      if (r.path.length < 2) return;
      map.setFeatureState(
        { source: SOURCE, id: i + 1 },
        { selected: r.id === focusTourId, hover: r.id === hover, dim: Boolean(focusTourId) && r.id !== focusTourId },
      );
    });
  }, [map, routes, focusTourId, hover]);

  const emitHover = useEffectEvent((id: string | null) => {
    setHoverId(id);
    onHoverTour?.(id);
  });
  const emitSelect = useEffectEvent((id: string) => onSelectTour?.(id));

  useEffect(() => {
    if (!map) return;
    const layer = `${SOURCE}-hit`;
    const tid = (e: MapLayerMouseEvent) => e.features?.[0]?.properties?.tid as string | undefined;
    const move = (e: MapLayerMouseEvent) => {
      const id = tid(e);
      map.getCanvas().style.cursor = id ? "pointer" : "";
      if (id) emitHover(id);
    };
    const leave = () => {
      map.getCanvas().style.cursor = "";
      emitHover(null);
    };
    const click = (e: MapLayerMouseEvent) => {
      const id = tid(e);
      if (id) emitSelect(id);
    };
    map.on("mousemove", layer, move);
    map.on("mouseleave", layer, leave);
    map.on("click", layer, click);
    return () => {
      map.off("mousemove", layer, move);
      map.off("mouseleave", layer, leave);
      map.off("click", layer, click);
    };
  }, [map]);

  // ---- Camera: fly to the focused tour, or back over every route -----------
  const framedRef = useRef<{ id: string | undefined } | null>(null);
  const settleRef = useRef<(() => void) | null>(null);
  useEffect(() => () => settleRef.current?.(), []);

  /** After a flight (or the first framing) the relief loads; nudge to the terrain-aware fit. */
  const settleFocus = useEffectEvent(() => {
    settleRef.current?.();
    settleRef.current = null;
    if (!map || !focus) return;
    const three = dimension === "3d";
    settleRef.current = settleOnIdle(map, () => routeView(map, focus, withTickets(pad), three), reduce);
  });

  const frame = useEffectEvent(() => {
    if (!map) return;
    const three = dimension === "3d";
    if (focus) {
      map.flyTo({ ...routeView(map, focus, withTickets(pad), three), speed: 1.1, curve: 1.42, maxDuration: 4500 });
    } else {
      const cam = overviewCamera(map, routes, pad, three ? OVERVIEW_PITCH : 0);
      if (cam) map.flyTo({ ...cam, speed: 1.1, curve: 1.42, maxDuration: 4500 });
    }
    settleFocus();
  });

  useEffect(() => {
    if (!map) return;
    if (framedRef.current === null) {
      // The map was created on this framing; only let it settle on the relief.
      framedRef.current = { id: focusTourId };
      settleFocus();
      return;
    }
    if (framedRef.current.id === focusTourId) return;
    framedRef.current = { id: focusTourId };
    frame();
  }, [map, focusTourId]);

  // A new set of routes (the difficulty filter) with nothing focused: frame them all.
  const routeIds = routes.map((r) => r.id).join("|");
  const refit = useEffectEvent(() => {
    if (!map || focus) return;
    const cam = overviewCamera(map, routes, pad, dimension === "3d" ? OVERVIEW_PITCH : 0);
    if (cam) map.flyTo({ ...cam, speed: 1.2, curve: 1.42, maxDuration: 3000 });
  });
  const idsRef = useRef<string | null>(null);
  useEffect(() => {
    if (!map) return;
    if (idsRef.current === null || idsRef.current === routeIds) {
      idsRef.current = routeIds;
      return;
    }
    idsRef.current = routeIds;
    refit();
  }, [map, routeIds]);

  // ---- Tickets ---------------------------------------------------------------
  const tourSpecs = useMemo<MarkerSpec[]>(() => routes.map((r) => ({ key: r.id, lngLat: r.labelAt })), [routes]);
  const tourSlots = useMarkerSlots(map, ml, tourSpecs);
  const wpSpecs = useMemo<MarkerSpec[]>(
    () => (focus ? focus.waypoints.map((w) => ({ key: w.id, lngLat: [w.lng, w.lat] })) : []),
    [focus],
  );
  const wpSlots = useMarkerSlots(map, ml, wpSpecs);

  useEffect(() => {
    for (const s of tourSlots) flagMarker(s.el, { hidden: s.key === focusTourId, active: s.key === hover });
  }, [tourSlots, focusTourId, hover]);

  useEffect(() => {
    if (!map) return;
    const items = [
      ...tourSlots.map((s, i) => ({ el: s.el, lngLat: s.lngLat, priority: s.key === hover ? 89 : 60 - i })),
      ...wpSlots.map((s, i) => {
        const kind = focus?.waypoints.find((w) => w.id === s.key)?.kind ?? "descanso";
        return { el: s.el, lngLat: s.lngLat, priority: KIND_PRIORITY[kind] - i * 0.01 };
      }),
    ];
    const run = frameThrottle(() => placeLabels(map, items));
    run();
    map.on("move", run);
    map.on("resize", run);
    return () => {
      map.off("move", run);
      map.off("resize", run);
      run.cancel();
    };
  }, [map, tourSlots, wpSlots, focus, hover]);

  if (status === "unsupported" || status === "error") {
    return <TerrainFallback tours={tours} focusTourId={focusTourId} onSelectTour={onSelectTour} className={className} />;
  }

  const pitch3d = focus ? routeCamera(focus.camera, true).pitch : OVERVIEW_PITCH;
  const toggleDimension = (d: Dimension) => {
    if (!map) return;
    setDimensionState(d);
    setDimension(map, d, pitch3d);
  };
  const toggleBasemap = (b: Basemap) => {
    if (!map) return;
    setBasemapState(b);
    setBasemap(map, b);
  };

  return (
    <div className={cn("wm-map bg-sand-300", className)} data-lenis-prevent={card ? undefined : ""}>
      <div ref={containerRef} style={MAP_BOX} />
      <LoadingVeil ready={status === "ready"} />
      {status === "loading" ? (
        <p role="status" className="sr-only">
          Cargando mapa
        </p>
      ) : null}

      {map ? (
        <>
          <div className="pointer-events-none absolute right-3 top-3 flex flex-col items-end gap-2" style={{ top: Math.max(12, pad.top - 40) }}>
            {card || narrow ? (
              <NavKeys map={map} pitch={pitch3d} size="sm">
                {card ? null : (
                  <>
                    <ToggleKey
                      size="sm"
                      label={dimension === "3d" ? "Relieve 3D activo: pasar a 2D" : "Pasar a relieve 3D"}
                      on={dimension === "3d"}
                      onToggle={() => toggleDimension(dimension === "3d" ? "2d" : "3d")}
                    >
                      3D
                    </ToggleKey>
                    <ToggleKey
                      size="sm"
                      label={basemap === "satelite" ? "Satélite activo: volver al mapa" : "Ver satélite"}
                      on={basemap === "satelite"}
                      onToggle={() => toggleBasemap(basemap === "satelite" ? "mapa" : "satelite")}
                    >
                      <Satellite size={18} strokeWidth={2.25} aria-hidden />
                    </ToggleKey>
                  </>
                )}
              </NavKeys>
            ) : (
              <>
                <NavKeys map={map} pitch={pitch3d} />
                <Segmented
                  label="Vista"
                  options={[
                    { id: "3d", label: "3D" },
                    { id: "2d", label: "2D" },
                  ]}
                  value={dimension}
                  onChange={toggleDimension}
                />
                <Segmented
                  label="Fondo"
                  options={[
                    { id: "mapa", label: "Mapa" },
                    { id: "satelite", label: "Satélite" },
                  ]}
                  value={basemap}
                  onChange={toggleBasemap}
                />
              </>
            )}
          </div>
          {focus && onClearFocus ? (
            <button
              type="button"
              onClick={onClearFocus}
              className="pressable absolute left-3 top-3 inline-flex h-10 items-center gap-2 bg-sand-50 px-3 text-[15px] font-semibold text-cobalt-800 hover:bg-sand-100"
              style={{ top: Math.max(12, pad.top - 40) }}
            >
              <ArrowLeft size={18} strokeWidth={2.25} aria-hidden />
              Todas las rutas
            </button>
          ) : null}
        </>
      ) : null}

      {tourSlots.map((s) => {
        const r = routes.find((x) => x.id === s.key);
        if (!r) return null;
        return createPortal(
          <TourPin
            tour={r}
            active={r.id === focusTourId}
            dim={Boolean(focusTourId) && r.id !== focusTourId}
            onSelect={(id) => onSelectTour?.(id)}
            onHover={(id) => {
              setHoverId(id);
              onHoverTour?.(id);
            }}
          />,
          s.el,
          s.key,
        );
      })}
      {focus
        ? wpSlots.map((s) => {
            const w = focus.waypoints.find((x) => x.id === s.key);
            return w ? createPortal(<WaypointPin wp={w} />, s.el, s.key) : null;
          })
        : null}
    </div>
  );
}
