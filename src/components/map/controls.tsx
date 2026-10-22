"use client";

import { useEffect, useRef, type ReactNode } from "react";
import type { Map as MLMap } from "maplibre-gl";
import { Minus, Navigation2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { FIRST_LABEL_LAYER, RELIEF_LAYERS, SATELLITE_LAYER, TERRAIN_EXAGGERATION, TERRAIN_SOURCE } from "./style";

// Map controls printed like the rest of the site: square paper keys on a
// sand strip, cobalt ink, pressed = scale(0.97). Each one says what it does.

export function ControlStack({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("pointer-events-auto grid gap-[2px] bg-sand-300 p-[2px]", className)}>{children}</div>;
}

export function ControlButton({
  label,
  onClick,
  children,
  size = "md",
  disabled,
  className,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  size?: "sm" | "md";
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "pressable grid place-items-center bg-sand-50 text-cobalt-800 hover:bg-sand-100 focus-visible:outline-2 focus-visible:-outline-offset-2 disabled:cursor-not-allowed disabled:text-cobalt-300 disabled:hover:bg-sand-50",
        size === "md" ? "size-10" : "size-9",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: {
  label: string;
  options: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("pointer-events-auto inline-grid grid-flow-col gap-[2px] bg-sand-300 p-[2px]", className)}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.id)}
            className={cn(
              "pressable h-9 min-w-11 px-3 text-[14px] font-semibold leading-none focus-visible:outline-2 focus-visible:-outline-offset-2",
              on ? "bg-cobalt-800 text-sand-50" : "bg-sand-50 text-cobalt-800 hover:bg-sand-100",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** A key that stays pressed (cobalt) while its option is on. */
export function ToggleKey({
  label,
  on,
  onToggle,
  children,
  size = "md",
}: {
  label: string;
  on: boolean;
  onToggle: () => void;
  children: ReactNode;
  size?: "sm" | "md";
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={on}
      title={label}
      onClick={onToggle}
      className={cn(
        "pressable grid place-items-center text-[13px] font-bold leading-none focus-visible:outline-2 focus-visible:-outline-offset-2",
        size === "md" ? "size-10" : "size-9",
        on ? "bg-cobalt-800 text-sand-50 hover:bg-cobalt-700" : "bg-sand-50 text-cobalt-800 hover:bg-sand-100",
      )}
    >
      {children}
    </button>
  );
}

/** Zoom keys; the compass shows the bearing and puts north up and the pitch back. */
export function NavKeys({ map, pitch, size = "md", children }: { map: MLMap; pitch: number; size?: "sm" | "md"; children?: ReactNode }) {
  const needleRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const update = () => {
      const el = needleRef.current;
      if (el) el.style.transform = `rotateX(${map.getPitch() * 0.6}deg) rotate(${-map.getBearing()}deg)`;
    };
    update();
    map.on("rotate", update);
    map.on("pitch", update);
    return () => {
      map.off("rotate", update);
      map.off("pitch", update);
    };
  }, [map]);

  const icon = size === "md" ? 20 : 18;
  return (
    <ControlStack>
      <ControlButton label="Acercar" size={size} onClick={() => map.zoomIn({ duration: 220 })}>
        <Plus size={icon} strokeWidth={2.25} aria-hidden />
      </ControlButton>
      <ControlButton label="Alejar" size={size} onClick={() => map.zoomOut({ duration: 220 })}>
        <Minus size={icon} strokeWidth={2.25} aria-hidden />
      </ControlButton>
      <ControlButton
        label="Norte arriba y vista inclinada"
        size={size}
        onClick={() => map.easeTo({ bearing: 0, pitch: map.getTerrain() ? pitch : 0, duration: 420 })}
      >
        <Navigation2 ref={needleRef} size={icon} strokeWidth={2.25} aria-hidden className="fill-current" />
      </ControlButton>
      {children}
    </ControlStack>
  );
}

export type Dimension = "3d" | "2d";
export type Basemap = "mapa" | "satelite";

export function setDimension(map: MLMap, dim: Dimension, pitch3d: number) {
  if (dim === "3d") {
    if (!map.getTerrain()) map.setTerrain({ source: TERRAIN_SOURCE, exaggeration: TERRAIN_EXAGGERATION });
    map.easeTo({ pitch: pitch3d, duration: 650 });
    return;
  }
  const flatten = () => {
    if (map.getTerrain()) map.setTerrain(null);
  };
  if (map.getPitch() < 1) {
    flatten();
    return;
  }
  map.once("moveend", flatten);
  map.easeTo({ pitch: 0, duration: 650 });
}

export function setBasemap(map: MLMap, base: Basemap) {
  const sat = base === "satelite";
  if (map.getLayer(SATELLITE_LAYER)) map.setLayoutProperty(SATELLITE_LAYER, "visibility", sat ? "visible" : "none");
  // Under the photo the relief is invisible: stop drawing it.
  for (const id of RELIEF_LAYERS) {
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", sat ? "none" : "visible");
  }
  // Labels sit on the photo with a paper halo.
  for (const id of ["l-peak", "l-village", "l-town", "l-city", FIRST_LABEL_LAYER]) {
    if (map.getLayer(id)) map.setPaintProperty(id, "text-halo-width", sat ? 2.2 : id === "l-city" ? 1.6 : 1.5);
  }
}
