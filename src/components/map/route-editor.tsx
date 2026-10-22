"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { MapMouseEvent, Map as MLMap, Marker } from "maplibre-gl";
import { useReducedMotion } from "motion/react";
import { Play, Redo2, Square, Trash, Undo2 } from "lucide-react";
import type { Route, Waypoint } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import { ControlButton, ControlStack, Segmented, type Dimension } from "./controls";
import { ElevationProfile, type ProfileHandle } from "./elevation-profile";
import { EditorFallback } from "./fallback";
import { Flyover } from "./flyover";
import { along, bearing, boundsOf, clamp, easeInOut, haversine, snap, toLine, type LL } from "./geo";
import { readInks } from "./inks";
import { LoadingVeil } from "./lazy";
import { createMap, MAP_BOX, supportsWebGL2 } from "./maplibre";
import { KIND_LABEL, KIND_ORDER, WaypointPin } from "./markers";
import { profileFromDEM, profileFromWaypoints, type ProfileData } from "./profile";
import { addRouteLayers, progressGradient, removeRouteLayers, routeFeatures, setRouteData } from "./route-layers";
import { useStableRoute } from "./routes";
import { buildStyle, TERRAIN_EXAGGERATION } from "./style";
import type { RouteEditorProps } from "./types";
import { useMap } from "./use-map";

// Wilber's route editor. Trazo: click the map to add a point at the end, drag a
// point to move it, click a point to delete it, click a hollow midpoint to
// insert one. Puntos: click to add a waypoint on the trace, drag to move it,
// edit name, kind, altitude and note in the list. Undo/redo, a flyover preview
// and Guardar, which hands back the route with a camera framed on it.

interface Draft {
  path: LL[];
  waypoints: Waypoint[];
}

interface History {
  stack: Draft[];
  index: number;
  tag: string | null;
  at: number;
}

type Mode = "trazo" | "puntos";

const SOURCE = "draft";
const r6 = (v: number) => Math.round(v * 1e6) / 1e6;
const r4 = (v: number) => Math.round(v * 1e4) / 1e4;
const serial = (d: Draft) => JSON.stringify(d);

function nextWaypointId(code: string, waypoints: Waypoint[]) {
  const prefix = code.toLowerCase();
  let n = waypoints.length + 1;
  const taken = new Set(waypoints.map((w) => w.id));
  while (taken.has(`${prefix}-${n}`)) n++;
  return `${prefix}-${n}`;
}

/** Framing for the 3D view: the whole trace, looking from the start toward its far end. */
function cameraFor(map: MLMap, path: LL[]): Route["camera"] {
  const start = path[0];
  let far = path[path.length - 1];
  let best = -1;
  for (const p of path) {
    const d = haversine(start, p);
    if (d > best) {
      best = d;
      far = p;
    }
  }
  const heading = best > 1 ? bearing(start, far) : 0;
  const box = boundsOf([path]);
  const cam = box ? map.cameraForBounds(box, { padding: 80, bearing: heading }) : undefined;
  const c = cam?.center;
  const center: LL = Array.isArray(c) ? [c[0], c[1]] : c && "lng" in c ? [c.lng, c.lat] : start;
  return {
    center: [r4(center[0]), r4(center[1])],
    zoom: Math.round(clamp((cam?.zoom ?? 14) - 0.5, 11, 16.5) * 10) / 10,
    pitch: 64,
    bearing: Math.round(((heading + 540) % 360) - 180),
  };
}

export default function RouteEditorImpl({ tour, onSave, className }: RouteEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<ProfileHandle>(null);
  const wpMarkersRef = useRef(new Map<string, Marker>());
  const lastDragRef = useRef(0);
  const [supported] = useState(supportsWebGL2);
  const [ink] = useState(readInks);
  const reduce = useReducedMotion() ?? false;
  const route = useStableRoute(tour);

  const [hist, setHist] = useState<History>(() => ({
    stack: [{ path: route.path, waypoints: route.waypoints }],
    index: 0,
    tag: null,
    at: 0,
  }));
  const [saved, setSaved] = useState(() => serial({ path: route.path, waypoints: route.waypoints }));
  const [mode, setMode] = useState<Mode>("trazo");
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<Dimension>("2d");
  const [previewing, setPreviewing] = useState(false);
  const draft = hist.stack[hist.index];
  const dirty = serial(draft) !== saved;
  const valid = draft.path.length >= 2;

  const line = useMemo(() => toLine(draft.path), [draft.path]);
  const waypointProfile = useMemo(() => profileFromWaypoints(line, draft.waypoints), [line, draft.waypoints]);
  const draftKey = serial(draft);
  const [dem, setDem] = useState<{ key: string; data: ProfileData } | null>(null);
  const profile = dem && dem.key === draftKey ? dem.data : waypointProfile;
  const sortedWaypoints = useMemo(() => {
    const byD = new Map(profile.waypoints.map((w) => [w.id, w.d]));
    return [...draft.waypoints].sort((a, b) => (byD.get(a.id) ?? 0) - (byD.get(b.id) ?? 0));
  }, [draft.waypoints, profile.waypoints]);

  const commit = (next: Draft, tag: string | null = null) => {
    const now = performance.now();
    setHist((h) => {
      const coalesce = tag !== null && tag === h.tag && now - h.at < 900 && h.index === h.stack.length - 1;
      const stack = [...h.stack.slice(0, coalesce ? h.index : h.index + 1), next].slice(-100);
      return { stack, index: stack.length - 1, tag, at: now };
    });
  };
  const undo = () => setHist((h) => (h.index > 0 ? { ...h, index: h.index - 1, tag: null } : h));
  const redo = () => setHist((h) => (h.index < h.stack.length - 1 ? { ...h, index: h.index + 1, tag: null } : h));

  const { map, ml, status } = useMap(containerRef, supported, (lib, container) =>
    createMap(lib, {
      container,
      style: buildStyle(ink, { terrain: true }),
      center: route.camera.center,
      zoom: route.camera.zoom,
      pitch: 0,
      bearing: 0,
      doubleClickZoom: false,
    }),
  );

  // ---- Trace line --------------------------------------------------------------
  useEffect(() => {
    if (!map) return;
    addRouteLayers(map, ink, routeFeatures([]), { source: SOURCE, progress: true, bold: true });
    return () => {
      try {
        removeRouteLayers(map, SOURCE);
      } catch {
        // The map was already removed.
      }
    };
  }, [map, ink]);

  useEffect(() => {
    if (map) setRouteData(map, SOURCE, routeFeatures([{ id: "draft", path: draft.path }]));
  }, [map, draft.path]);

  const elevationAt = (p: LL): number | undefined => {
    const v = map?.queryTerrainElevation(p);
    return v === null || v === undefined || !Number.isFinite(v) || v === 0 ? undefined : Math.round(v / TERRAIN_EXAGGERATION);
  };

  // ---- Map clicks: add a trace point or a waypoint ----------------------------------
  const onMapClick = useEffectEvent((e: MapMouseEvent) => {
    const target = e.originalEvent.target as HTMLElement | null;
    if (previewing || target?.closest(".maplibregl-marker")) return;
    if (performance.now() - lastDragRef.current < 350) return;
    const p: LL = [r6(e.lngLat.lng), r6(e.lngLat.lat)];
    if (mode === "trazo") {
      commit({ ...draft, path: [...draft.path, p] });
      return;
    }
    const at = draft.path.length >= 2 ? snap(toLine(draft.path), p).point : p;
    const id = nextWaypointId(tour.code, draft.waypoints);
    const altitude = elevationAt(at);
    const wp: Waypoint = {
      id,
      name: `Punto ${draft.waypoints.length + 1}`,
      kind: draft.waypoints.length === 0 ? "inicio" : "mirador",
      lng: r6(at[0]),
      lat: r6(at[1]),
      ...(altitude !== undefined ? { altitude } : {}),
    };
    commit({ ...draft, waypoints: [...draft.waypoints, wp] });
    setSelected(id);
  });

  useEffect(() => {
    if (!map) return;
    const click = (e: MapMouseEvent) => onMapClick(e);
    map.on("click", click);
    return () => {
      map.off("click", click);
    };
  }, [map]);

  useEffect(() => {
    if (!map) return;
    map.getCanvas().style.cursor = previewing ? "" : "crosshair";
  }, [map, previewing]);

  // ---- Trace handles: vertices and midpoints ---------------------------------------
  const previewTrace = useEffectEvent((path: LL[]) => {
    if (map) setRouteData(map, SOURCE, routeFeatures([{ id: "draft", path }]));
  });
  const moveVertex = useEffectEvent((i: number, p: LL) => {
    lastDragRef.current = performance.now();
    commit({ ...draft, path: draft.path.map((q, j) => (j === i ? p : q)) });
  });
  const deleteVertex = useEffectEvent((i: number) => {
    if (performance.now() - lastDragRef.current < 350) return;
    commit({ ...draft, path: draft.path.filter((_, j) => j !== i) });
  });
  const insertVertex = useEffectEvent((i: number, p: LL) => {
    lastDragRef.current = performance.now();
    commit({ ...draft, path: [...draft.path.slice(0, i), p, ...draft.path.slice(i)] });
  });

  // Handles are rebuilt after a zoom so midpoints only show where a segment has room for one.
  const [zoomTick, setZoomTick] = useState(0);
  useEffect(() => {
    if (!map) return;
    const bump = () => setZoomTick((t) => t + 1);
    map.on("zoomend", bump);
    return () => {
      map.off("zoomend", bump);
    };
  }, [map]);

  useEffect(() => {
    if (!map || !ml || previewing || mode !== "trazo") return;
    const path = draft.path;
    const markers: Marker[] = [];
    const ll = (m: Marker): LL => {
      const v = m.getLngLat();
      return [r6(v.lng), r6(v.lat)];
    };

    path.forEach((p, i) => {
      const el = document.createElement("div");
      el.className = "wm-vertex";
      el.appendChild(document.createElement("span")).className = "wm-knob";
      if (i === 0) el.dataset.end = "start";
      else if (i === path.length - 1) el.dataset.end = "end";
      el.title = i === 0 ? "Inicio: arrastrá para mover, clic para borrar" : "Arrastrá para mover, clic para borrar";
      const m = new ml.Marker({ element: el, draggable: true }).setLngLat(p).addTo(map);
      m.on("drag", () => previewTrace(path.map((q, j) => (j === i ? ll(m) : q))));
      m.on("dragend", () => moveVertex(i, ll(m)));
      m.on("click", () => deleteVertex(i));
      markers.push(m);
    });

    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1];
      const b = path[i];
      const pa = map.project(a);
      const pb = map.project(b);
      if (Math.hypot(pa.x - pb.x, pa.y - pb.y) < 44) continue;
      const mid: LL = [r6((a[0] + b[0]) / 2), r6((a[1] + b[1]) / 2)];
      const el = document.createElement("div");
      el.className = "wm-mid";
      el.appendChild(document.createElement("span")).className = "wm-knob";
      el.title = "Clic o arrastre: insertar un punto aquí";
      const m = new ml.Marker({ element: el, draggable: true }).setLngLat(mid).addTo(map);
      m.on("drag", () => previewTrace([...path.slice(0, i), ll(m), ...path.slice(i)]));
      m.on("dragend", () => insertVertex(i, ll(m)));
      m.on("click", () => {
        if (performance.now() - lastDragRef.current < 350) return;
        insertVertex(i, mid);
      });
      markers.push(m);
    }
    return () => markers.forEach((m) => m.remove());
  }, [map, ml, draft.path, mode, previewing, zoomTick]);

  // ---- Waypoint tickets ------------------------------------------------------------
  const wpIds = draft.waypoints.map((w) => w.id).join("|");
  const wpSlots = useMemo(
    () =>
      wpIds
        .split("|")
        .filter(Boolean)
        .map((id) => {
          const el = document.createElement("div");
          el.className = "wm-marker";
          return { key: id, el };
        }),
    [wpIds],
  );

  const moveWaypoint = useEffectEvent((id: string, p: LL) => {
    lastDragRef.current = performance.now();
    const at = draft.path.length >= 2 ? snap(toLine(draft.path), p).point : p;
    const altitude = elevationAt(at);
    commit({
      ...draft,
      waypoints: draft.waypoints.map((w) =>
        w.id === id ? { ...w, lng: r6(at[0]), lat: r6(at[1]), ...(altitude !== undefined ? { altitude } : {}) } : w,
      ),
    });
    setSelected(id);
  });
  const waypointAt = useEffectEvent((id: string): LL | null => {
    const w = draft.waypoints.find((x) => x.id === id);
    return w ? [w.lng, w.lat] : null;
  });

  useEffect(() => {
    if (!map || !ml) return;
    const markers = wpMarkersRef.current;
    for (const slot of wpSlots) {
      const at = waypointAt(slot.key);
      if (!at) continue;
      const m = new ml.Marker({ element: slot.el, anchor: "bottom", offset: [0, 5], subpixelPositioning: true }).setLngLat(at).addTo(map);
      m.on("dragend", () => {
        const v = m.getLngLat();
        moveWaypoint(slot.key, [v.lng, v.lat]);
      });
      markers.set(slot.key, m);
    }
    return () => {
      for (const slot of wpSlots) {
        markers.get(slot.key)?.remove();
        markers.delete(slot.key);
      }
    };
  }, [map, ml, wpSlots]);

  useEffect(() => {
    const markers = wpMarkersRef.current;
    for (const w of draft.waypoints) {
      markers.get(w.id)?.setLngLat([w.lng, w.lat]).setDraggable(mode === "puntos" && !previewing);
    }
  }, [draft.waypoints, mode, previewing, wpSlots]);

  // ---- Profile from the DEM, refreshed after every edit -------------------------------
  const sampleDem = useEffectEvent(() => (map ? profileFromDEM(map, line, draft.waypoints) : null));
  useEffect(() => {
    if (!map || line.length <= 0) return;
    let tries = 0;
    const attempt = () => {
      const data = sampleDem();
      if (data) {
        setDem({ key: draftKey, data });
        map.off("idle", attempt);
      } else if (++tries > 8) {
        map.off("idle", attempt);
      }
    };
    map.on("idle", attempt);
    const raf = requestAnimationFrame(attempt);
    return () => {
      cancelAnimationFrame(raf);
      map.off("idle", attempt);
    };
  }, [map, line, draftKey]);

  // ---- Preview flyover -------------------------------------------------------------
  const flyRef = useRef<Flyover | null>(null);
  const previewSetup = useEffectEvent(() => ({ line, zoom: clamp(route.camera.zoom + 0.5, 13.2, 15.4) }));
  useEffect(() => {
    if (!map || !ml || !previewing) return;
    const { line: l, zoom } = previewSetup();
    if (l.length <= 0) return;
    const chart = profileRef.current;
    const c = map.getCenter();
    const before = { center: [c.lng, c.lat] as LL, zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing() };
    const el = document.createElement("div");
    el.className = "wm-walker";
    const walker = new ml.Marker({ element: el, subpixelPositioning: true }).setLngLat(l.path[0]).addTo(map);
    const progress = `${SOURCE}-progress`;
    if (map.getLayer(progress)) map.setLayoutProperty(progress, "visibility", "visible");
    const fly = new Flyover(
      map,
      l,
      { zoom, pitch: 64 },
      (d) => {
        walker.setLngLat(along(l, d));
        chart?.setCursor(d);
        if (map.getLayer(progress)) map.setPaintProperty(progress, "line-gradient", progressGradient(ink, d / l.length));
      },
      (s) => {
        if (s === "ended") window.setTimeout(() => setPreviewing(false), 900);
      },
    );
    flyRef.current = fly;
    if (reduce) fly.seek(0, true);
    else fly.play();
    return () => {
      fly.destroy();
      flyRef.current = null;
      walker.remove();
      chart?.setCursor(null);
      if (map.getLayer(progress)) map.setLayoutProperty(progress, "visibility", "none");
      map.easeTo({ ...before, duration: 700, easing: easeInOut });
    };
  }, [map, ml, previewing, ink, reduce]);

  const scrub = (d: number) => {
    flyRef.current?.seek(d, reduce);
  };

  // ---- Keyboard: undo / redo ---------------------------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, [contenteditable='true']")) return;
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) {
        e.preventDefault();
        setHist((h) => (h.index > 0 ? { ...h, index: h.index - 1, tag: null } : h));
      } else if ((k === "z" && e.shiftKey) || k === "y") {
        e.preventDefault();
        setHist((h) => (h.index < h.stack.length - 1 ? { ...h, index: h.index + 1, tag: null } : h));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ---- Actions ----------------------------------------------------------------------
  const switchView = (v: Dimension) => {
    setView(v);
    map?.easeTo({ pitch: v === "3d" ? 60 : 0, duration: 500, easing: easeInOut });
  };

  const updateWaypoint = (id: string, patch: Partial<Waypoint>, tag: string) => {
    commit({ ...draft, waypoints: draft.waypoints.map((w) => (w.id === id ? { ...w, ...patch } : w)) }, tag);
  };

  const removeWaypoint = (id: string) => {
    commit({ ...draft, waypoints: draft.waypoints.filter((w) => w.id !== id) });
    if (selected === id) setSelected(null);
  };

  const save = () => {
    if (!map || !valid) return;
    const trace = toLine(draft.path);
    const path = draft.path.map(([lng, lat]) => [r6(lng), r6(lat)] as LL);
    const waypoints = draft.waypoints
      .map((w) => {
        const s = snap(trace, [w.lng, w.lat]);
        // Points near the trace sit on it; one placed off-trail on purpose stays.
        const at = s.off < 200 ? s.point : ([w.lng, w.lat] as LL);
        const clean: Waypoint = { id: w.id, name: w.name.trim() || KIND_LABEL[w.kind], kind: w.kind, lng: r6(at[0]), lat: r6(at[1]) };
        if (w.note?.trim()) clean.note = w.note.trim();
        if (w.altitude !== undefined && Number.isFinite(w.altitude)) clean.altitude = Math.round(w.altitude);
        return { w: clean, d: s.d };
      })
      .sort((a, b) => a.d - b.d)
      .map((x) => x.w);
    const next: Route = { path, waypoints, camera: cameraFor(map, path) };
    commit({ path, waypoints });
    setSaved(serial({ path, waypoints }));
    onSave(next);
  };

  if (status === "unsupported" || status === "error") return <EditorFallback className={cn("min-h-[420px]", className)} />;

  const hint =
    mode === "trazo"
      ? "Clic en el mapa: punto al final. Arrastrá un punto para moverlo; clic en un punto lo borra; clic en un punto hueco inserta uno."
      : "Clic en el mapa: punto de interés sobre el trazo. Arrastralo para moverlo; editá nombre, tipo y altura en la lista.";

  return (
    <div className={cn("grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]", className)}>
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            label="Modo de edición"
            options={[
              { id: "trazo", label: "Trazo" },
              { id: "puntos", label: "Puntos" },
            ]}
            value={mode}
            onChange={(m) => setMode(m)}
          />
          <ControlStack className="grid-flow-col">
            <ControlButton label="Deshacer (Ctrl+Z)" onClick={undo} disabled={hist.index === 0}>
              <Undo2 size={18} strokeWidth={2.25} aria-hidden />
            </ControlButton>
            <ControlButton label="Rehacer (Ctrl+Y)" onClick={redo} disabled={hist.index >= hist.stack.length - 1}>
              <Redo2 size={18} strokeWidth={2.25} aria-hidden />
            </ControlButton>
          </ControlStack>
          <Segmented
            label="Vista"
            options={[
              { id: "2d", label: "2D" },
              { id: "3d", label: "3D" },
            ]}
            value={view}
            onChange={switchView}
          />
          <button
            type="button"
            onClick={() => setPreviewing((p) => !p)}
            disabled={!valid}
            className="pressable inline-flex h-10 items-center gap-2 rounded-full bg-sand-300 pl-3.5 pr-4 text-[15px] font-semibold text-cobalt-800 hover:bg-sand-400 disabled:opacity-45"
          >
            {previewing ? <Square size={16} strokeWidth={2.25} aria-hidden className="fill-current" /> : <Play size={16} strokeWidth={2.25} aria-hidden className="fill-current" />}
            {previewing ? "Detener" : "Recorrer"}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!dirty || !valid || previewing}
            className="pressable ml-auto inline-flex h-10 items-center rounded-full bg-primary px-5 text-[15px] font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Guardar
          </button>
        </div>
        <p className="text-small text-ink-soft">{valid ? hint : "El trazo necesita al menos dos puntos: hacé clic en el mapa para agregarlos."}</p>

        <div
          className={cn(
            "wm-map relative h-[52vh] min-h-[340px] rounded-ticket bg-sand-300 lg:h-[58vh]",
            previewing && "wm-hide-handles",
            mode === "trazo" && !previewing && "wm-edit-trace",
          )}
        >
          <div ref={containerRef} style={MAP_BOX} />
          <LoadingVeil ready={status === "ready"} />
        </div>

        <div className="paper px-4 pb-2 pt-3">
          <ElevationProfile ref={profileRef} data={profile} onScrub={previewing ? scrub : undefined} />
        </div>
      </div>

      <aside className="flex min-w-0 flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-lead font-semibold">Puntos de interés</h2>
          <p className="text-small text-ink-soft tabular">
            {draft.path.length} puntos de trazo · {draft.waypoints.length} de interés
          </p>
        </div>
        {sortedWaypoints.length === 0 ? (
          <p className="text-small text-ink-soft">Sin puntos de interés: elegí «Puntos» y hacé clic sobre el trazo.</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {sortedWaypoints.map((w) => (
              <li
                key={w.id}
                className={cn("paper grid gap-2 rounded-field p-3", selected === w.id && "outline-2 outline-offset-2 outline-cobalt-800")}
                onFocusCapture={() => setSelected(w.id)}
              >
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                  <label className="sr-only" htmlFor={`${w.id}-name`}>
                    Nombre
                  </label>
                  <input
                    id={`${w.id}-name`}
                    value={w.name}
                    onChange={(e) => updateWaypoint(w.id, { name: e.target.value }, `name:${w.id}`)}
                    className="h-10 min-w-0 rounded-field border border-cobalt-800/25 bg-sand-50 px-3 text-[16px] font-semibold text-cobalt-800 outline-none focus-visible:border-cobalt-800"
                  />
                  <label className="sr-only" htmlFor={`${w.id}-kind`}>
                    Tipo
                  </label>
                  <select
                    id={`${w.id}-kind`}
                    value={w.kind}
                    onChange={(e) => updateWaypoint(w.id, { kind: e.target.value as Waypoint["kind"] }, `kind:${w.id}`)}
                    className="h-10 rounded-field border border-cobalt-800/25 bg-sand-50 px-3 text-[16px] text-cobalt-800 outline-none focus-visible:border-cobalt-800"
                  >
                    {KIND_ORDER.map((k) => (
                      <option key={k} value={k}>
                        {KIND_LABEL[k]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-[7rem_minmax(0,1fr)_auto] items-center gap-2">
                  <label className="flex h-10 items-center gap-1 rounded-field border border-cobalt-800/25 bg-sand-50 px-3 focus-within:border-cobalt-800">
                    <span className="sr-only">Altura en metros</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={w.altitude ?? ""}
                      onChange={(e) => {
                        const v = e.target.value === "" ? undefined : Number(e.target.value);
                        updateWaypoint(w.id, { altitude: v }, `alt:${w.id}`);
                      }}
                      className="w-full min-w-0 bg-transparent text-[16px] text-cobalt-800 outline-none tabular"
                    />
                    <span className="text-small text-ink-soft">m</span>
                  </label>
                  <label className="sr-only" htmlFor={`${w.id}-note`}>
                    Nota
                  </label>
                  <input
                    id={`${w.id}-note`}
                    value={w.note ?? ""}
                    placeholder="Nota"
                    onChange={(e) => updateWaypoint(w.id, { note: e.target.value }, `note:${w.id}`)}
                    className="h-10 min-w-0 rounded-field border border-cobalt-800/25 bg-sand-50 px-3 text-[16px] text-cobalt-800 outline-none placeholder:text-cobalt-300 focus-visible:border-cobalt-800"
                  />
                  <ControlButton label={`Quitar ${w.name}`} onClick={() => removeWaypoint(w.id)}>
                    <Trash size={18} strokeWidth={2.25} aria-hidden />
                  </ControlButton>
                </div>
              </li>
            ))}
          </ol>
        )}
      </aside>

      {wpSlots.map((s) => {
        const w = draft.waypoints.find((x) => x.id === s.key);
        return w
          ? createPortal(
              <WaypointPin
                wp={w}
                selected={selected === w.id}
                onActivate={() => {
                  setSelected(w.id);
                  setMode("puntos");
                  document.getElementById(`${w.id}-name`)?.focus({ preventScroll: true });
                }}
              />,
              s.el,
              s.key,
            )
          : null;
      })}
    </div>
  );
}
