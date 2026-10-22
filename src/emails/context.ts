import type { Booking, Departure, MeetingPoint, Tour } from "@/lib/domain/types";
import { meetingPointById, tourById } from "@/content/catalog";
import { formatDayLong, formatTime, formatUsd } from "@/lib/domain/format";

// What every booking email needs, resolved once from the raw EmailData.

export interface BookingCtx {
  booking: Booking;
  departure: Departure;
  tour: Tour;
  point?: MeetingPoint;
  siteUrl: string;
  start: number;
  arrive: number;
  total: number;
  ticketUrl: string;
}

export const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function bookingCtx(booking: Booking, departure: Departure, siteUrl: string): BookingCtx | null {
  const tour = tourById(booking.tourId) ?? tourById(departure.tourId);
  if (!tour) return null;
  const start = Date.parse(departure.startsAt);
  return {
    booking,
    departure,
    tour,
    point: meetingPointById(departure.meetingPointId),
    siteUrl,
    start,
    arrive: start - tour.arriveMinutesBefore * 60_000,
    total: booking.partySize * departure.priceUsd,
    ticketUrl: `${siteUrl}/reserva/${booking.code}`,
  };
}

/** "Pago: $140 el día de la salida." and its online-deposit variants. */
export function paymentText(c: BookingCtx) {
  const p = c.booking.payment;
  if (p.method === "wompi" && p.status === "aprobado") return `Anticipo pagado: ${formatUsd(p.amountUsd)}. Saldo: ${formatUsd(c.total - p.amountUsd)} el día de la salida.`;
  if (p.method === "wompi" && p.status === "pendiente") return `Anticipo pendiente: ${formatUsd(p.amountUsd)}. El resto, el día de la salida.`;
  return `Pago: ${formatUsd(c.total)} el día de la salida.`;
}

export const longDay = (t: number | string) => capital(formatDayLong(t));
export const time = (t: number | string) => formatTime(t);

/** Plain-text email: lines, blank lines between blocks, no markup. */
export function plain(blocks: (string | null | undefined | false | (string | null | undefined | false)[])[]) {
  return blocks
    .map((b) => (Array.isArray(b) ? b.filter(Boolean).join("\n") : b || ""))
    .filter((b) => b.trim().length > 0)
    .join("\n\n");
}
