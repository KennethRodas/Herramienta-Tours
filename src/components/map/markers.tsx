"use client";

import { useEffect, useMemo } from "react";
import type { Map as MLMap } from "maplibre-gl";
import { DIFFICULTY_LABEL } from "@/content/catalog";
import { formatMeters, formatUsd } from "@/lib/domain/format";
import type { Tour, Waypoint } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import type { LL } from "./geo";
import type { MapLibre } from "./maplibre";

export const KIND_LABEL: Record<Waypoint["kind"], string> = {
  inicio: "Inicio",
  mirador: "Mirador",
  cima: "Cima",
  agua: "Agua",
  descanso: "Descanso",
  fin: "Fin",
  peligro: "Peligro",
};

export const KIND_ORDER: Waypoint["kind"][] = ["inicio", "mirador", "cima", "agua", "descanso", "peligro", "fin"];

/** Which ticket keeps its label when two collide. */
export const KIND_PRIORITY: Record<Waypoint["kind"], number> = {
  cima: 100,
  inicio: 96,
  fin: 95,
  peligro: 94,
  agua: 92,
  mirador: 91,
  descanso: 90,
};

export interface MarkerSpec {
  key: string;
  lngLat: LL;
}

export interface MarkerSlot extends MarkerSpec {
  el: HTMLDivElement;
}

/**
 * One maplibre marker per spec, each with its own element for a React portal.
 * Pass a memoised `specs` array: new elements are made only when it changes.
 */
export function useMarkerSlots(map: MLMap | null, ml: MapLibre | null, specs: MarkerSpec[]): MarkerSlot[] {
  const slots = useMemo(
    () =>
      specs.map((spec) => {
        const el = document.createElement("div");
        el.className = "wm-marker";
        return { ...spec, el };
      }),
    [specs],
  );

  useEffect(() => {
    if (!map || !ml) return;
    const markers = slots.map((slot) =>
      new ml.Marker({ element: slot.el, anchor: "bottom", offset: [0, 5], subpixelPositioning: true, opacityWhenCovered: "0.35" })
        .setLngLat(slot.lngLat)
        .addTo(map),
    );
    return () => markers.forEach((m) => m.remove());
  }, [map, ml, slots]);

  return slots;
}

export function waypointMeta(wp: Pick<Waypoint, "kind" | "altitude">) {
  return [KIND_LABEL[wp.kind], wp.altitude != null ? formatMeters(Math.round(wp.altitude)) : null].filter(Boolean).join(" · ");
}

export function WaypointPin({ wp, onActivate, selected }: { wp: Waypoint; onActivate?: () => void; selected?: boolean }) {
  const meta = waypointMeta(wp);
  const tone = wp.kind === "peligro" || selected ? "ink" : undefined;
  const body = (
    <>
      <span className="wm-ticket ticket-notch">
        <span className="wm-ticket-name">{wp.name}</span>
        <span className="wm-ticket-meta">{meta}</span>
      </span>
      <span className="wm-stem" aria-hidden />
      <span className="wm-dot" aria-hidden />
    </>
  );
  if (!onActivate) {
    return (
      <span className="wm-pin cursor-default" data-tone={tone} role="img" aria-label={`${wp.name}. ${meta}`}>
        {body}
      </span>
    );
  }
  return (
    <button
      type="button"
      className="wm-pin"
      data-tone={tone}
      data-selected={selected ? "true" : undefined}
      aria-pressed={selected}
      onClick={onActivate}
      aria-label={`${wp.name}. ${meta}`}
    >
      {body}
    </button>
  );
}

export function TourPin({
  tour,
  active,
  dim,
  onSelect,
  onHover,
}: {
  tour: Pick<Tour, "id" | "name" | "shortName" | "priceUsd" | "difficulty">;
  active: boolean;
  dim: boolean;
  onSelect?: (id: string) => void;
  onHover?: (id: string | null) => void;
}) {
  return (
    <button
      type="button"
      className="wm-pin"
      data-tone={active ? "ink" : undefined}
      data-dim={dim ? "true" : undefined}
      aria-pressed={active}
      aria-label={`${tour.name}. ${formatUsd(tour.priceUsd)}, ${DIFFICULTY_LABEL[tour.difficulty]}`}
      onClick={() => onSelect?.(tour.id)}
      onPointerEnter={(e) => e.pointerType !== "touch" && onHover?.(tour.id)}
      onPointerLeave={() => onHover?.(null)}
      onFocus={() => onHover?.(tour.id)}
      onBlur={() => onHover?.(null)}
    >
      <span className="wm-ticket ticket-notch">
        <span className="wm-ticket-title">{tour.shortName}</span>
        <span className="wm-ticket-meta">
          {formatUsd(tour.priceUsd)} · {DIFFICULTY_LABEL[tour.difficulty]}
        </span>
      </span>
      <span className="wm-stem" aria-hidden />
      <span className="wm-dot" aria-hidden />
    </button>
  );
}

export function MeetingPin({ name, detail, className }: { name: string; detail?: string; className?: string }) {
  return (
    <span className={cn("wm-pin cursor-default", className)} data-shape="square" data-tone="ink" role="img" aria-label={`Punto de encuentro: ${name}`}>
      <span className="wm-ticket ticket-notch">
        <span className="wm-ticket-name">{name}</span>
        <span className="wm-ticket-meta">{detail ?? "Punto de encuentro"}</span>
      </span>
      <span className="wm-stem" aria-hidden />
      <span className="wm-dot" aria-hidden />
    </span>
  );
}
