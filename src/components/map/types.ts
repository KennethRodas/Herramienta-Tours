import type { MeetingPoint, Route, Tour } from "@/lib/domain/types";

/** Pixels of the map covered by other UI, kept clear when framing routes. */
export type MapPadding = number | { top?: number; right?: number; bottom?: number; left?: number };

export interface TerrainMapProps {
  /** Tours whose routes are drawn. */
  tours: Tour[];
  /** Tour to frame and highlight. */
  focusTourId?: string;
  onSelectTour?: (tourId: string) => void;
  /** "full": page-size explorer · "card": square/inline panel, fewer controls. */
  variant?: "full" | "card";
  className?: string;
  /** Highlights a route without moving the camera (e.g. the row under the pointer in a list). */
  highlightTourId?: string | null;
  /** Pointer enters / leaves a route or its ticket on the map. */
  onHoverTour?: (tourId: string | null) => void;
  /** When given, a "Todas las rutas" key shows while a tour is focused. */
  onClearFocus?: () => void;
  /** Space covered by other UI over the map; framing keeps it clear. */
  padding?: MapPadding;
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
