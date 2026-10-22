import type { Booking, Departure, MeetingPoint, Tour } from "@/lib/domain/types";
import { formatTime, plural } from "@/lib/domain/format";

// "Agregar al calendario": an iCalendar file built in the browser.
// The event starts at the arrival time (when the group has to be there) and
// ends when the tour is back; a reminder fires the evening before.

const stamp = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

const escape = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** RFC 5545 line folding: 75 octets, continuation lines start with a space. */
function fold(line: string) {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let current = "";
  let size = 0;
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length;
    if (size + n > (out.length ? 74 : 75)) {
      out.push(current);
      current = "";
      size = 0;
    }
    current += ch;
    size += n;
  }
  out.push(current);
  return out.join("\r\n ");
}

export function buildIcs({ booking, departure, tour, point, url, now }: { booking: Booking; departure: Departure; tour: Tour; point?: MeetingPoint; url: string; now: number }) {
  const start = Date.parse(departure.startsAt);
  const arrive = start - tour.arriveMinutesBefore * 60_000;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Wilber//Reservas//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${booking.code}@wilber`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${stamp(arrive)}`,
    `DTEND:${stamp(Date.parse(departure.endsAt))}`,
    `SUMMARY:${escape(`${tour.name} · ${booking.code}`)}`,
    point ? `LOCATION:${escape(`${point.name}, ${point.address}, ${point.city}`)}` : null,
    point ? `GEO:${point.lat};${point.lng}` : null,
    `DESCRIPTION:${escape(
      [
        `Salida ${formatTime(start)} · llegar a las ${formatTime(arrive)}`,
        plural(booking.partySize, "persona", "personas") + ".",
        `Qué llevar: ${tour.bring.join(", ")}.`,
        `Boleto: ${url}`,
      ].join("\n"),
    )}`,
    `URL:${url}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT12H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escape(`Mañana: ${tour.name}, llegar a las ${formatTime(arrive)}`)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter((l): l is string => l !== null);
  return lines.map(fold).join("\r\n") + "\r\n";
}

export function downloadIcs(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(href), 2000);
}
