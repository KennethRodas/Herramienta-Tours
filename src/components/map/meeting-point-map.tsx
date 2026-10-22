"use client";

import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ExternalLink } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MeetingFallback } from "./fallback";
import { readInks } from "./inks";
import { LoadingVeil } from "./lazy";
import { createMap, MAP_BOX, supportsWebGL2 } from "./maplibre";
import { MeetingPin, useMarkerSlots, type MarkerSpec } from "./markers";
import { buildStyle } from "./style";
import type { MeetingPointMapProps } from "./types";
import { useMap } from "./use-map";

export default function MeetingPointMapImpl({ point, className }: MeetingPointMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [supported] = useState(supportsWebGL2);
  const [ink] = useState(readInks);

  const { map, ml, status } = useMap(containerRef, supported, (lib, container) =>
    createMap(lib, {
      container,
      style: buildStyle(ink, { terrain: false }),
      center: [point.lng, point.lat],
      zoom: 15.6,
      pitch: 0,
      bearing: 0,
      cooperativeGestures: true,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      maxPitch: 0,
    }),
  );

  const specs = useMemo<MarkerSpec[]>(() => [{ key: point.id, lngLat: [point.lng, point.lat] }], [point.id, point.lng, point.lat]);
  const slots = useMarkerSlots(map, ml, specs);

  if (status === "unsupported" || status === "error") return <MeetingFallback point={point} className={className} />;

  return (
    <div className={cn("wm-map bg-sand-300", className)}>
      <div ref={containerRef} style={MAP_BOX} />
      <LoadingVeil ready={status === "ready"} />
      <a
        href={point.mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonClass("primary", "md", "absolute bottom-3 left-3 h-10 px-4 text-[15px]")}
      >
        Abrir en Google Maps
        <ExternalLink size={16} strokeWidth={2.25} aria-hidden />
      </a>
      {slots.map((s) => createPortal(<MeetingPin name={point.name} />, s.el, s.key))}
    </div>
  );
}
