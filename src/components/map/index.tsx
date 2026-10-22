"use client";

// Public API of the map module. Pages import ONLY from "@/components/map".
// The MAP agent replaces these placeholders with MapLibre implementations
// (loaded with next/dynamic, ssr: false) without changing the props.

import type { MeetingPoint, Route, Tour } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

export interface TerrainMapProps {
  /** Tours whose routes are drawn. */
  tours: Tour[];
  /** Tour to frame and highlight. */
  focusTourId?: string;
  onSelectTour?: (tourId: string) => void;
  /** "full": page-size explorer · "card": square/inline panel, fewer controls. */
  variant?: "full" | "card";
  className?: string;
}

export interface RouteMapProps {
  tour: Tour;
  /** Shows the "Recorrer la ruta" flyover control and the synced elevation profile. */
  flyover?: boolean;
  className?: string;
}

export interface MeetingPointMapProps {
  point: MeetingPoint;
  className?: string;
}

export interface RouteEditorProps {
  tour: Tour;
  onSave: (route: Route) => void;
  className?: string;
}

function Placeholder({ label, className }: { label: string; className?: string }) {
  return (
    <div className={cn("grid min-h-64 place-items-center bg-sand-300 text-cobalt-600", className)} role="img" aria-label={label}>
      <span className="font-sans text-sm">{label}</span>
    </div>
  );
}

export function TerrainMap(props: TerrainMapProps) {
  return <Placeholder label="Mapa de rutas" className={props.className} />;
}

export function RouteMap(props: RouteMapProps) {
  return <Placeholder label={`Ruta: ${props.tour.name}`} className={props.className} />;
}

export function MeetingPointMap(props: MeetingPointMapProps) {
  return <Placeholder label={props.point.name} className={props.className} />;
}

export function RouteEditor(props: RouteEditorProps) {
  return <Placeholder label={`Editor de ruta: ${props.tour.name}`} className={props.className} />;
}
