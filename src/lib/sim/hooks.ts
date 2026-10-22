"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { Booking, Conflict, Departure, Message, SimEvent, Tour } from "@/lib/domain/types";
import { GUIDES, VEHICLES } from "@/content/catalog";
import { departureState, seatsLeft, type DepartureState } from "@/lib/domain/availability";
import { detectConflicts } from "@/lib/domain/conflicts";
import { effectiveTours, getServerState, getState, subscribe } from "./store";
import { simNow, type SimSettings, type SimState, type SimStats } from "./state";

// Read side of the simulation. On the server (and during hydration) every hook
// returns its "not ready" value, so pages render a static shell and fill in live.

export function useSimState(): SimState | null {
  return useSyncExternalStore(subscribe, getState, getServerState);
}

export function useHydrated() {
  return useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
}

/** Simulated "now", re-rendering every `everyMs`. Null until hydrated. */
export function useNow(everyMs = 1000): number | null {
  const s = useSimState();
  const [, force] = useState(0);
  const clockRef = useRef(s?.clock);
  clockRef.current = s?.clock;
  useEffect(() => {
    const id = window.setInterval(() => force((n) => n + 1), everyMs);
    return () => window.clearInterval(id);
  }, [everyMs]);
  return s ? simNow(s.clock) : null;
}

export function useClock() {
  return useSimState()?.clock ?? null;
}

export function useSettings(): SimSettings | null {
  return useSimState()?.settings ?? null;
}

export function useStats(): SimStats | null {
  return useSimState()?.stats ?? null;
}

/** Tours with Wilber's edits applied. Static catalog until hydrated (SEO-safe). */
export function useTours(opts: { includeInactive?: boolean } = {}): Tour[] {
  const s = useSimState();
  return useMemo(() => {
    const list = effectiveTours(s);
    return opts.includeInactive ? list : list.filter((t) => t.active);
  }, [s, opts.includeInactive]);
}

export interface DepartureView extends Departure {
  left: number;
  state: DepartureState;
}

function view(d: Departure, s: SimState, now: number): DepartureView {
  return { ...d, left: seatsLeft(d, s.holds, now), state: departureState(d, now, s.holds) };
}

/** Future departures of a tour (PRD: only future dates), soonest first. */
export function useTourDepartures(tourId: string | undefined, limit = 12): DepartureView[] | null {
  const s = useSimState();
  const now = useNow(5000);
  return useMemo(() => {
    if (!s || now === null || !tourId) return null;
    return s.departures
      .filter((d) => d.tourId === tourId && Date.parse(d.startsAt) > now && d.status !== "cancelada")
      .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
      .slice(0, limit)
      .map((d) => view(d, s, now));
  }, [s, now, tourId, limit]);
}

export function useDeparture(id: string | undefined): DepartureView | null | undefined {
  const s = useSimState();
  const now = useNow(1000);
  return useMemo(() => {
    if (!s || now === null) return undefined; // loading
    const d = s.departures.find((x) => x.id === id);
    return d ? view(d, s, now) : null; // null = not found
  }, [s, now, id]);
}

export function useDepartures(filter?: (d: Departure) => boolean): DepartureView[] | null {
  const s = useSimState();
  const now = useNow(5000);
  return useMemo(() => {
    if (!s || now === null) return null;
    return s.departures
      .filter((d) => (filter ? filter(d) : true))
      .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
      .map((d) => view(d, s, now));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s, now]);
}

/** Next departure with seats for each tour (catalog "próxima salida"). */
export function useNextDepartures(): Record<string, DepartureView | undefined> | null {
  const s = useSimState();
  const now = useNow(10000);
  return useMemo(() => {
    if (!s || now === null) return null;
    const out: Record<string, DepartureView | undefined> = {};
    for (const d of [...s.departures].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))) {
      if (out[d.tourId] || Date.parse(d.startsAt) <= now) continue;
      const v = view(d, s, now);
      if (v.state === "disponible" || v.state === "ultimos") out[d.tourId] = v;
    }
    return out;
  }, [s, now]);
}

export function useBookingByCode(code: string | undefined): Booking | null | undefined {
  const s = useSimState();
  return useMemo(() => {
    if (!s) return undefined;
    return s.bookings.find((b) => b.code === code) ?? null;
  }, [s, code]);
}

export function useBookings(filter?: (b: Booking) => boolean): Booking[] | null {
  const s = useSimState();
  return useMemo(() => {
    if (!s) return null;
    return s.bookings.filter((b) => (filter ? filter(b) : true)).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s]);
}

export function useMessages(filter?: (m: Message) => boolean): Message[] | null {
  const s = useSimState();
  return useMemo(() => {
    if (!s) return null;
    return s.messages.filter((m) => (filter ? filter(m) : true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s]);
}

export function useEvents(limit = 80): SimEvent[] | null {
  const s = useSimState();
  return useMemo(() => (s ? s.events.slice(0, limit) : null), [s, limit]);
}

export function useConflicts(): Conflict[] | null {
  const s = useSimState();
  const now = useNow(15000);
  return useMemo(() => {
    if (!s || now === null) return null;
    return detectConflicts({ departures: s.departures, tours: effectiveTours(s), guides: GUIDES, vehicles: VEHICLES, now });
  }, [s, now]);
}

/** Stable per-tab id used for seat holds. */
export function useSessionId() {
  const [id] = useState(() => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `s-${Math.random().toString(36).slice(2)}`));
  return id;
}
