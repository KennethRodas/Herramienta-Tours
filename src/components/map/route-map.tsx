"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Marker } from "maplibre-gl";
import { useReducedMotion } from "motion/react";
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw, Satellite, Scan } from "lucide-react";
import { meetingPointById } from "@/content/catalog";
import { formatKm } from "@/lib/domain/format";
import { cn } from "@/lib/utils";
import { NavKeys, Segmented, ToggleKey, setBasemap, setDimension, type Basemap, type Dimension } from "./controls";
import { ElevationProfile, type ProfileHandle, type ScrubPhase } from "./elevation-profile";
import { RouteFallback } from "./fallback";
import { Flyover, type FlyoverState } from "./flyover";
import { along, clamp, easeInOut, haversine, toLine } from "./geo";
import { readInks } from "./inks";
import { placeLabels } from "./labels";
import { LoadingVeil } from "./lazy";
import { createMap, MAP_BOX, supportsWebGL2 } from "./maplibre";
import { KIND_PRIORITY, MeetingPin, WaypointPin, useMarkerSlots, type MarkerSpec } from "./markers";
import { profileFromDEM, profileFromWaypoints, type ProfileData } from "./profile";
import { addRouteLayers, progressGradient, removeRouteLayers, routeFeatures } from "./route-layers";
import { routeCamera, routeView, settleOnIdle, useStableRoute, type Pad, type RouteGeo } from "./routes";
import { buildStyle } from "./style";
import type { RouteMapProps } from "./types";
import { frameThrottle, useMap } from "./use-map";

const SOURCE = "route";
/** Keys at the top and bottom, tickets above the trail. */
const FRAME_PAD: Pad = { top: 64, right: 60, bottom: 60, left: 24 };
const km = (m: number) => formatKm(m / 1000);

/** Meeting point drawn only when it is at the trailhead (Juayúa, Suchitoto, El Tunco). */
function nearbyMeeting(meetingPointId: string, route: RouteGeo) {
  const mp = meetingPointById(meetingPointId);
  const start = route.path[0];
  if (!mp || !start) return null;
  return haversine([mp.lng, mp.lat], start) < 3000 ? mp : null;
}

export default function RouteMapImpl({ tour, flyover = false, className }: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<ProfileHandle>(null);
  const flyRef = useRef<Flyover | null>(null);
  const walkerRef = useRef<Marker | null>(null);
  const readoutRef = useRef<HTMLSpanElement>(null);
  const [supported] = useState(supportsWebGL2);
  const [ink] = useState(readInks);
  const reduce = useReducedMotion() ?? false;

  const route = useStableRoute(tour);
  const line = useMemo(() => toLine(route.path), [route]);
  const camera = useMemo(() => routeCamera(route.camera, true), [route]);
  const meeting = useMemo(() => nearbyMeeting(tour.meetingPointId, route), [tour.meetingPointId, route]);

  const [dimension, setDimensionState] = useState<Dimension>("3d");
  const [basemap, setBasemapState] = useState<Basemap>("mapa");
  const [flyState, setFlyState] = useState<FlyoverState>("idle");
  const [following, setFollowing] = useState(false);
  const [rate, setRate] = useState<"1" | "2">("1");
  const [step, setStep] = useState(-1);

  const waypointProfile = useMemo(() => profileFromWaypoints(line, route.waypoints), [line, route]);
  const [dem, setDem] = useState<{ route: RouteGeo; data: ProfileData } | null>(null);
  const profile = dem && dem.route === route ? dem.data : waypointProfile;
  const canFly = flyover && line.length > 0;

  const { map, ml, status } = useMap(containerRef, supported, (lib, container) => {
    const m = createMap(lib, {
      container,
      style: buildStyle(ink, { terrain: true }),
      ...camera,
      cooperativeGestures: true,
    });
    m.jumpTo(routeView(m, route, FRAME_PAD, true));
    return m;
  });

  // Re-frame once the relief has loaded (summits stand taller than the flat fit assumed).
  const settledView = useEffectEvent(() => (map ? routeView(map, route, FRAME_PAD, dimension === "3d") : null));
  useEffect(() => {
    if (!map) return;
    return settleOnIdle(map, settledView, reduce);
  }, [map, reduce]);

  // ---- Line, tickets, meeting point -----------------------------------------
  useEffect(() => {
    if (!map) return;
    addRouteLayers(map, ink, routeFeatures([{ id: route.id, path: route.path }]), { source: SOURCE, progress: flyover, bold: true });
    return () => {
      try {
        removeRouteLayers(map, SOURCE);
      } catch {
        // The map was already removed.
      }
    };
  }, [map, ink, route, flyover]);

  const wpSpecs = useMemo<MarkerSpec[]>(() => route.waypoints.map((w) => ({ key: w.id, lngLat: [w.lng, w.lat] })), [route]);
  const wpSlots = useMarkerSlots(map, ml, wpSpecs);
  const meetingSpecs = useMemo<MarkerSpec[]>(() => (meeting ? [{ key: "meeting", lngLat: [meeting.lng, meeting.lat] }] : []), [meeting]);
  const meetingSlots = useMarkerSlots(map, ml, meetingSpecs);

  useEffect(() => {
    if (!map) return;
    const items = [
      ...wpSlots.map((s, i) => {
        const kind = route.waypoints.find((w) => w.id === s.key)?.kind ?? "descanso";
        return { el: s.el, lngLat: s.lngLat, priority: KIND_PRIORITY[kind] - i * 0.01 };
      }),
      ...meetingSlots.map((s) => ({ el: s.el, lngLat: s.lngLat, priority: 80 })),
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
  }, [map, wpSlots, meetingSlots, route]);

  // ---- Profile from the DEM once its tiles under the route are in -----------
  useEffect(() => {
    if (!map || line.length <= 0) return;
    let tries = 0;
    const attempt = () => {
      const data = profileFromDEM(map, line, route.waypoints);
      if (data) {
        setDem({ route, data });
        map.off("idle", attempt);
      } else if (++tries > 12) {
        map.off("idle", attempt);
      }
    };
    map.on("idle", attempt);
    const raf = requestAnimationFrame(attempt);
    return () => {
      cancelAnimationFrame(raf);
      map.off("idle", attempt);
    };
  }, [map, line, route]);

  // ---- Flyover ----------------------------------------------------------------
  const onFrame = useEffectEvent((d: number) => {
    profileRef.current?.setCursor(d);
    walkerRef.current?.setLngLat(along(line, d));
    if (map?.getLayer(`${SOURCE}-progress`)) {
      map.setPaintProperty(`${SOURCE}-progress`, "line-gradient", progressGradient(ink, line.length ? d / line.length : 0));
    }
    if (readoutRef.current) readoutRef.current.textContent = `${km(d)} / ${km(line.length)}`;
  });

  const followView = useEffectEvent(() => ({
    zoom: clamp(route.camera.zoom + 0.5, 13.2, 15.4),
    pitch: dimension === "3d" ? 64 : 0,
  }));

  useEffect(() => {
    if (!map || !ml || !canFly) return;
    const el = document.createElement("div");
    el.className = "wm-walker";
    const walker = new ml.Marker({ element: el, subpixelPositioning: true }).setLngLat(line.path[0]);
    walkerRef.current = walker;
    let shown = false;
    const fly = new Flyover(
      map,
      line,
      followView(),
      (d) => {
        if (!shown) {
          shown = true;
          walker.addTo(map);
          if (map.getLayer(`${SOURCE}-progress`)) map.setLayoutProperty(`${SOURCE}-progress`, "visibility", "visible");
        }
        onFrame(d);
      },
      (s) => setFlyState(s),
    );
    flyRef.current = fly;

    // Grabbing the map hands the camera back to the visitor.
    const release = (e: { originalEvent?: unknown }) => {
      if (e.originalEvent && fly.following) {
        fly.release();
        setFollowing(false);
      }
    };
    map.on("dragstart", release);
    map.on("zoomstart", release);
    map.on("rotatestart", release);
    map.on("pitchstart", release);
    return () => {
      map.off("dragstart", release);
      map.off("zoomstart", release);
      map.off("rotatestart", release);
      map.off("pitchstart", release);
      fly.destroy();
      walker.remove();
      flyRef.current = null;
      walkerRef.current = null;
      setFlyState("idle");
      setFollowing(false);
    };
  }, [map, ml, canFly, line]);

  useEffect(() => {
    flyRef.current?.setView({ zoom: clamp(route.camera.zoom + 0.5, 13.2, 15.4), pitch: dimension === "3d" ? 64 : 0 });
  }, [dimension, route]);

  const togglePlay = () => {
    const fly = flyRef.current;
    if (!fly) return;
    if (fly.state === "playing") {
      fly.pause();
      return;
    }
    fly.rate = rate === "2" ? 2 : 1;
    fly.play();
    setFollowing(true);
  };

  const overview = () => {
    flyRef.current?.release();
    setFollowing(false);
    setStep(-1);
    if (map) map.easeTo({ ...routeView(map, route, FRAME_PAD, dimension === "3d"), duration: 900, easing: easeInOut });
  };

  const seek = (d: number, phase: ScrubPhase) => {
    const fly = flyRef.current;
    if (!fly) return;
    if (phase === "start") setStep(-1);
    fly.seek(d, reduce);
    setFollowing(true);
  };

  const hoverAt = (d: number | null) => {
    const fly = flyRef.current;
    const walker = walkerRef.current;
    if (!fly || !walker || !map || fly.state === "playing") return;
    if (d === null) {
      if (fly.state === "idle") walker.remove();
      else walker.setLngLat(along(line, fly.position));
      return;
    }
    walker.setLngLat(along(line, d));
    if (!walker.getElement().isConnected) walker.addTo(map);
  };

  const stepTo = (i: number) => {
    const wps = profile.waypoints;
    if (!wps.length) return;
    if (i < 0) {
      overview();
      return;
    }
    const at = clamp(i, 0, wps.length - 1);
    setStep(at);
    flyRef.current?.seek(wps[at].d, true);
    setFollowing(true);
  };

  if (status === "unsupported" || status === "error") {
    return <RouteFallback tour={tour} showProfile={flyover} className={className} />;
  }

  const wps = profile.waypoints;
  const playLabel =
    flyState === "playing" ? "Pausa" : flyState === "paused" ? "Seguir" : flyState === "ended" ? "Repetir" : "Recorrer la ruta";
  const PlayIcon = flyState === "playing" ? Pause : flyState === "ended" ? RotateCcw : Play;
  const keyClass =
    "pressable inline-flex h-10 items-center gap-2 bg-sand-50 px-3 text-[15px] font-semibold text-cobalt-800 hover:bg-sand-100 disabled:opacity-45";

  return (
    <div className={cn("wm-map flex flex-col bg-sand-300", className)}>
      <div className="relative min-h-0 flex-1">
        <div ref={containerRef} style={MAP_BOX} />
        <LoadingVeil ready={status === "ready"} />
        {status === "loading" ? (
          <p role="status" className="sr-only">
            Cargando mapa
          </p>
        ) : null}

        {map ? (
          <div className="pointer-events-none absolute right-3 top-3">
            <NavKeys map={map} pitch={camera.pitch} size="sm">
              <ToggleKey
                size="sm"
                label={dimension === "3d" ? "Relieve 3D activo: pasar a 2D" : "Pasar a relieve 3D"}
                on={dimension === "3d"}
                onToggle={() => {
                  const d = dimension === "3d" ? "2d" : "3d";
                  setDimensionState(d);
                  setDimension(map, d, camera.pitch);
                }}
              >
                3D
              </ToggleKey>
              <ToggleKey
                size="sm"
                label={basemap === "satelite" ? "Satélite activo: volver al mapa" : "Ver satélite"}
                on={basemap === "satelite"}
                onToggle={() => {
                  const b = basemap === "satelite" ? "mapa" : "satelite";
                  setBasemapState(b);
                  setBasemap(map, b);
                }}
              >
                <Satellite size={18} strokeWidth={2.25} aria-hidden />
              </ToggleKey>
            </NavKeys>
          </div>
        ) : null}

        {map && canFly ? (
          <div className="absolute bottom-3 left-3 right-14 flex flex-wrap items-center gap-2">
            {reduce ? (
              <>
                <div className="inline-grid grid-flow-col gap-[2px] bg-sand-300 p-[2px]">
                  <button type="button" className={keyClass} onClick={() => stepTo(step - 1)} disabled={step < 0} aria-label="Punto anterior">
                    <ChevronLeft size={18} strokeWidth={2.25} aria-hidden />
                  </button>
                  <button type="button" className={keyClass} onClick={() => stepTo(step + 1)} disabled={step >= wps.length - 1} aria-label="Punto siguiente">
                    {step < 0 ? "Recorrer por puntos" : null}
                    <ChevronRight size={18} strokeWidth={2.25} aria-hidden />
                  </button>
                </div>
                {step >= 0 && wps[step] ? (
                  <p className="bg-sand-50 px-3 py-2 text-[15px] font-semibold leading-tight tabular" aria-live="polite">
                    {wps[step].name} · {step + 1}/{wps.length}
                  </p>
                ) : null}
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={togglePlay}
                  className={cn(keyClass, flyState === "idle" && "bg-cobalt-800 text-sand-50 hover:bg-cobalt-700")}
                >
                  <PlayIcon size={18} strokeWidth={2.25} aria-hidden className={flyState === "playing" ? "" : "fill-current"} />
                  {playLabel}
                </button>
                {flyState !== "idle" ? (
                  <>
                    <Segmented
                      label="Velocidad"
                      options={[
                        { id: "1", label: "x1" },
                        { id: "2", label: "x2" },
                      ]}
                      value={rate}
                      onChange={(r) => {
                        setRate(r);
                        if (flyRef.current) flyRef.current.rate = r === "2" ? 2 : 1;
                      }}
                    />
                    <span ref={readoutRef} className="bg-sand-50 px-3 py-2 text-[15px] font-semibold leading-tight tabular" aria-hidden />
                  </>
                ) : null}
              </>
            )}
            {following ? (
              <button type="button" onClick={overview} className={keyClass}>
                <Scan size={18} strokeWidth={2.25} aria-hidden />
                Vista general
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {flyover ? (
        <div className="paper shrink-0 px-4 pb-2 pt-3">
          <ElevationProfile ref={profileRef} data={profile} onScrub={canFly ? seek : undefined} onHover={canFly ? hoverAt : undefined} />
        </div>
      ) : null}

      {wpSlots.map((s) => {
        const w = route.waypoints.find((x) => x.id === s.key);
        if (!w) return null;
        const wd = wps.find((x) => x.id === w.id)?.d;
        return createPortal(
          <WaypointPin wp={w} onActivate={canFly && wd !== undefined ? () => seek(wd, "end") : undefined} />,
          s.el,
          s.key,
        );
      })}
      {meeting
        ? meetingSlots.map((s) => createPortal(<MeetingPin name={meeting.name} />, s.el, s.key))
        : null}
    </div>
  );
}
