import type { Booking, BookingSource, BookingStatus, Conflict, Departure, Tour } from "@/lib/domain/types";
import { DAY, HOUR, addDays, formatUsd, svISO, svParts } from "@/lib/domain/format";
import { needsTransport, overlaps } from "@/lib/domain/conflicts";

// Pure helpers for Wilber's panel: labels, money, calendar keys.

export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  confirmada: "Confirmada",
  pendiente_pago: "Anticipo pendiente",
  pagada: "Anticipo pagado",
  check_in: "Llegó",
  no_show: "No vino",
  cancelada: "Cancelada",
};

export const BOOKING_STATUS_ORDER: BookingStatus[] = ["confirmada", "pendiente_pago", "pagada", "check_in", "no_show", "cancelada"];

export const SOURCE_LABEL: Record<BookingSource, string> = {
  web: "Web",
  whatsapp: "WhatsApp",
  manual: "Manual",
  simulacion: "Simulación",
};

export const SOURCE_ORDER: BookingSource[] = ["web", "whatsapp", "manual", "simulacion"];

/** Not cancelled. */
export const isLive = (b: Booking) => b.status !== "cancelada";
/** Still expected on the trail. */
export const isExpected = (b: Booking) => b.status !== "cancelada" && b.status !== "no_show";

export function bookingTotal(b: Booking, priceUsd: number) {
  return b.partySize * priceUsd;
}

/** One line about money for a booking, as Wilber would say it. */
export function paymentLine(b: Booking, priceUsd: number) {
  const total = bookingTotal(b, priceUsd);
  if (b.status === "cancelada") return "Sin cobro";
  if (b.payment.method === "wompi") {
    if (b.payment.status === "aprobado") return `Anticipo ${formatUsd(b.payment.amountUsd)} · saldo ${formatUsd(Math.max(0, total - b.payment.amountUsd))}`;
    if (b.payment.status === "pendiente") return `Anticipo ${formatUsd(b.payment.amountUsd)} pendiente`;
    if (b.payment.status === "rechazado") return `Anticipo rechazado · ${formatUsd(total)} el día`;
  }
  return `${formatUsd(total)} el día`;
}

/** Short payment label for tables. */
export function paymentShort(b: Booking) {
  if (b.payment.method !== "wompi") return "En sitio";
  if (b.payment.status === "aprobado") return `Anticipo ${formatUsd(b.payment.amountUsd)}`;
  if (b.payment.status === "pendiente") return "Pendiente";
  if (b.payment.status === "rechazado") return "Rechazado";
  return "En sitio";
}

/** Money in Wilber's hands for a booking whose departure already happened. */
export function collectedUsd(b: Booking, priceUsd: number) {
  const deposit = b.payment.status === "aprobado" ? b.payment.amountUsd : 0;
  if (b.status === "check_in") return Math.max(b.checkedIn * priceUsd, deposit);
  return deposit;
}

/** Money expected from a booking on a future departure. */
export function expectedUsd(b: Booking, priceUsd: number) {
  return isExpected(b) ? b.partySize * priceUsd : 0;
}

// --- Calendar keys (El Salvador dates, "YYYY-MM-DD") -------------------------

export const WEEKDAY_SHORT = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
export const WEEKDAY_MON_FIRST = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];
export const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];

export const keyNoon = (key: string) => Date.parse(svISO(key, "12:00"));
export const keyParts = (key: string) => svParts(keyNoon(key));
/** 0 = Monday … 6 = Sunday. */
export const mondayIndex = (key: string) => (keyParts(key).weekday + 6) % 7;
export const mondayOfKey = (key: string) => addDays(key, -mondayIndex(key));
export const monthKey = (key: string) => key.slice(0, 7);

export function monthGrid(year: number, month: number) {
  const first = `${year}-${String(month).padStart(2, "0")}-01`; // taste-skill-ignore: ISO date key
  const start = mondayOfKey(first);
  const days: string[] = [];
  for (let i = 0; i < 42; i++) days.push(addDays(start, i));
  // Trim a trailing week that belongs entirely to the next month.
  const lastWeekStart = days[35];
  if (monthKey(lastWeekStart) !== monthKey(first)) days.splice(35, 7);
  return { first, days };
}

export function capitalize(s: string) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

export function monthTitle(year: number, month: number) {
  return `${capitalize(MONTHS[month - 1])} ${year}`;
}

/** "jue 22" */
export function dayLabel(key: string) {
  const p = keyParts(key);
  return `${WEEKDAY_SHORT[p.weekday]} ${p.day}`;
}

/** "jue 22 oct" */
export function dayLabelLong(key: string) {
  const p = keyParts(key);
  return `${WEEKDAY_SHORT[p.weekday]} ${p.day} ${MONTHS_SHORT[p.month - 1]}`;
}

// --- Departures ---------------------------------------------------------------

export const isActiveDeparture = (d: Departure) => d.status !== "cancelada";

/** In progress or upcoming, soonest first: the departure Wilber is working on. */
export function currentDeparture<T extends Departure>(deps: T[], now: number): T | undefined {
  return deps
    .filter((d) => d.status !== "cancelada" && Date.parse(d.endsAt) > now)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))[0];
}

export function isInProgress(d: Departure, now: number) {
  return Date.parse(d.startsAt) <= now && now < Date.parse(d.endsAt);
}

/** True when the departure should have a vehicle (tours that meet on location do not). */
export function wantsVehicle(d: Pick<Departure, "tourId">, tours: Map<string, Tour>) {
  const tour = tours.get(d.tourId);
  return tour ? needsTransport(tour) : true;
}

/** Departures in the next `hours` that lack a guide or a vehicle they need. */
export function unassignedSoon<T extends Departure>(deps: T[], now: number, tours: Map<string, Tour>, hours = 72): T[] {
  return deps.filter(
    (d) =>
      d.status !== "cancelada" &&
      Date.parse(d.startsAt) > now &&
      Date.parse(d.startsAt) - now < hours * HOUR &&
      (!d.guideId || (!d.vehicleId && wantsVehicle(d, tours))),
  );
}

/** Other live departures that would share a resource with `dep` (transfer buffer included). */
export function clashesFor(dep: Departure, all: Departure[], resource: { guideId?: string | null; vehicleId?: string | null }, now: number) {
  return all.filter(
    (o) =>
      o.id !== dep.id &&
      o.status !== "cancelada" &&
      o.status !== "realizada" &&
      Date.parse(o.endsAt) > now &&
      ((resource.guideId && o.guideId === resource.guideId) || (resource.vehicleId && o.vehicleId === resource.vehicleId)) &&
      overlaps(o, dep),
  );
}

export function conflictsForDeparture(conflicts: Conflict[], id: string) {
  return conflicts.filter((c) => c.departureIds.includes(id));
}

export const tourOf = (tours: Map<string, Tour>, d: Pick<Departure, "tourId">) => tours.get(d.tourId);

/** Average occupancy of departures between two instants. */
export function occupancy(deps: Departure[], from: number, to: number) {
  let seats = 0;
  let cap = 0;
  let count = 0;
  for (const d of deps) {
    const t = Date.parse(d.startsAt);
    if (d.status === "cancelada" || t < from || t > to) continue;
    seats += d.seatsTaken;
    cap += d.capacity;
    count++;
  }
  return { seats, cap, count, ratio: cap ? seats / cap : 0 };
}

export const daysBetween = (a: number, b: number) => Math.round((b - a) / DAY);

export function pct(ratio: number) {
  return `${Math.round(ratio * 100)} %`;
}

export function initials(name: string) {
  return name
    .replace(/[«»]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

/** "Microbús «La Chula»" → "La Chula". */
export function vehicleShort(name: string) {
  const m = name.match(/«(.+)»/);
  return m ? m[1] : name.replace(/ alquilada$/i, "");
}

export function guideShort(name: string) {
  return name.split(" ")[0];
}
