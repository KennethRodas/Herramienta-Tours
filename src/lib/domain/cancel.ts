import { HOUR } from "./format";
import type { Booking, Departure } from "./types";

/** Visitors cancel online until this long before the departure; after that, through Wilber. */
export const CANCEL_CUTOFF_HOURS = 24;

export type CancelCheck =
  | { ok: true; until: number }
  /** "tarde": inside the cutoff, Wilber cancels it by WhatsApp. The rest have nothing to cancel. */
  | { ok: false; reason: "tarde" | "inactiva" | "pasada" };

export function canCancelOnline(b: Booking, dep: Departure, now: number): CancelCheck {
  if (b.status === "cancelada" || b.status === "check_in" || b.status === "no_show" || dep.status === "cancelada") {
    return { ok: false, reason: "inactiva" };
  }
  const start = Date.parse(dep.startsAt);
  if (now >= start) return { ok: false, reason: "pasada" };
  const until = start - CANCEL_CUTOFF_HOURS * HOUR;
  return now > until ? { ok: false, reason: "tarde" } : { ok: true, until };
}
