"use client";

import { createContext, useContext } from "react";

// One overlay at a time, with a navigation stack inside it (iOS sheet style):
// a departure can push one of its bookings and come back.

export type Overlay =
  | { kind: "departure"; id: string }
  | { kind: "booking"; id: string }
  | { kind: "new-departure"; tourId?: string; dateKey?: string }
  | { kind: "new-booking"; departureId?: string }
  | { kind: "weather"; departureId?: string };

export interface DashApi {
  stack: Overlay[];
  /** Replace whatever is open. */
  open: (o: Overlay) => void;
  /** Go one level deeper inside the open sheet. */
  push: (o: Overlay) => void;
  /** Swap the top of the stack (a form that became a record). */
  replace: (o: Overlay) => void;
  back: () => void;
  close: () => void;
  openPalette: () => void;
}

export const DashContext = createContext<DashApi | null>(null);

export function useDash() {
  const ctx = useContext(DashContext);
  if (!ctx) throw new Error("useDash must be used inside Wilber's panel");
  return ctx;
}
