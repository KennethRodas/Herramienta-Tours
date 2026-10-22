import type { Departure, Tour } from "./types";
import { svParts } from "./format";

/**
 * Human reference for a departure that Wilber can type on WhatsApp:
 * tour code + day of month, with a letter when the same tour runs twice that day.
 * "SA24", "IZ31", "SA24B".
 */
export function departureRef(dep: Departure, tours: Tour[], all: Departure[]) {
  const tour = tours.find((t) => t.id === dep.tourId);
  const code = tour?.code ?? "SL";
  const p = svParts(dep.startsAt);
  const base = `${code}${String(p.day).padStart(2, "0")}`;
  const sameDay = all
    .filter((d) => d.tourId === dep.tourId && d.status !== "cancelada")
    .filter((d) => {
      const q = svParts(d.startsAt);
      return q.year === p.year && q.month === p.month && q.day === p.day;
    })
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const idx = sameDay.findIndex((d) => d.id === dep.id);
  return idx > 0 ? `${base}${String.fromCharCode(65 + idx)}` : base;
}

/** Finds the upcoming departure matching a ref typed by Wilber (closest in time first). */
export function findByRef(ref: string, deps: Departure[], tours: Tour[], now: number) {
  const wanted = ref.toUpperCase().replace(/\s+/g, "");
  return deps
    .filter((d) => Date.parse(d.endsAt) > now - 36 * 60 * 60 * 1000)
    .sort((a, b) => Math.abs(Date.parse(a.startsAt) - now) - Math.abs(Date.parse(b.startsAt) - now))
    .find((d) => departureRef(d, tours, deps) === wanted);
}
