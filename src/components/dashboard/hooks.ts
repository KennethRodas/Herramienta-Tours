"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { Booking, Tour } from "@/lib/domain/types";
import { departureRef } from "@/lib/domain/refs";
import { svParts } from "@/lib/domain/format";
import { useNow, useSimState } from "@/lib/sim/hooks";
import { effectiveTours } from "@/lib/sim/store";
import { THEME_KEY } from "./theme-script";

// Client hooks shared by every screen of Wilber's panel.

/** One memoized index per simulation revision: tours, refs and bookings by departure. */
export function useIndex() {
  const s = useSimState();
  return useMemo(() => {
    if (!s) return null;
    const tours = effectiveTours(s);
    const tourById = new Map<string, Tour>(tours.map((t) => [t.id, t]));
    const refs = new Map<string, string>();
    for (const d of s.departures) refs.set(d.id, departureRef(d, tours, s.departures));
    const byDeparture = new Map<string, Booking[]>();
    for (const b of s.bookings) {
      const list = byDeparture.get(b.departureId);
      if (list) list.push(b);
      else byDeparture.set(b.departureId, [b]);
    }
    for (const list of byDeparture.values()) list.sort((a, b) => a.name.localeCompare(b.name, "es"));
    const departureById = new Map(s.departures.map((d) => [d.id, d]));
    const bookingById = new Map(s.bookings.map((b) => [b.id, b]));
    return { s, tours, tourById, refs, byDeparture, departureById, bookingById };
  }, [s]);
}

export type DashIndex = NonNullable<ReturnType<typeof useIndex>>;

// --- Media queries -------------------------------------------------------------

function subscribeMedia(query: string) {
  return (cb: () => void) => {
    if (typeof window === "undefined" || !window.matchMedia) return () => undefined;
    const mq = window.matchMedia(query);
    mq.addEventListener?.("change", cb);
    return () => mq.removeEventListener?.("change", cb);
  };
}

export function useMediaQuery(query: string, serverValue = false) {
  const subscribe = useMemo(() => subscribeMedia(query), [query]);
  return useSyncExternalStore(
    subscribe,
    () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query).matches : serverValue),
    () => serverValue,
  );
}

/** Sidebar + drawers from 1024px; tab bar + bottom sheets below. */
export const useIsDesktop = () => useMediaQuery("(min-width: 1024px)");
/** A finger is the main input: swipe rows instead of row buttons. */
export const useCoarsePointer = () => useMediaQuery("(pointer: coarse)");

// --- Small localStorage store ----------------------------------------------------

const EVENT = "wilber-panel-storage";

function readKey(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeKey(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* private mode: keep going in memory */
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribeStorage(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
}

/** undefined while rendering on the server / hydrating. */
export function useStoredValue(key: string): string | null | undefined {
  return useSyncExternalStore(
    subscribeStorage,
    () => readKey(key),
    () => undefined,
  );
}

// --- Session (PIN gate) ------------------------------------------------------------

export const SESSION_KEY = "wilber.panel.sesion";

/** true / false once known, undefined before hydration. */
export function useSession() {
  const raw = useStoredValue(SESSION_KEY);
  return raw === undefined ? undefined : raw !== null;
}

export function signIn() {
  writeKey(SESSION_KEY, String(Date.now()));
}

export function signOut() {
  writeKey(SESSION_KEY, null);
}

// --- Theme ------------------------------------------------------------------------

export type ThemeMode = "auto" | "dia" | "noche";
export const THEME_LABEL: Record<ThemeMode, string> = { auto: "Automático", dia: "Día", noche: "Noche" };

/** Night runs from 18:00 to 05:30, El Salvador time. */
export function isNightAt(t: number) {
  const p = svParts(t);
  const minutes = p.hour * 60 + p.minute;
  return minutes >= 18 * 60 || minutes < 5 * 60 + 30;
}

export function useThemeMode(): [ThemeMode, (m: ThemeMode) => void] {
  const raw = useStoredValue(THEME_KEY);
  const mode: ThemeMode = raw === "dia" || raw === "noche" ? raw : "auto";
  const set = useCallback((m: ThemeMode) => writeKey(THEME_KEY, m === "auto" ? null : m), []);
  return [mode, set];
}

/** undefined until the client knows the clock (keeps whatever the boot script set). */
export function useEffectiveTheme(): "dia" | "noche" | undefined {
  const [mode] = useThemeMode();
  const now = useNow(30_000);
  const raw = useStoredValue(THEME_KEY);
  if (raw === undefined) return undefined;
  if (mode !== "auto") return mode;
  if (now === null) return undefined;
  return isNightAt(now) ? "noche" : "dia";
}
