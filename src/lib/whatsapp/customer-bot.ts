import type { Booking, Departure, Hold, Tour } from "@/lib/domain/types";
import { normalizeCode, seatsLeft } from "@/lib/domain/availability";
import { formatDayShort, formatTime, formatUsd } from "@/lib/domain/format";
import { siteUrl, ticketUrl } from "./templates";

// Auto-replies on Wilber's business number for people who are not Wilber.
// Anything it cannot answer is forwarded to Wilber as a note.

export interface CustomerBotData {
  tours: Tour[];
  departures: Departure[];
  bookings: Booking[];
  holds: Hold[];
  now: number;
}

export interface CustomerReply {
  text: string;
  buttons?: string[];
  /** When true, Wilber gets a heads-up to answer personally. */
  forwardToWilber?: boolean;
}

const strip = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[¿?¡!.,]/g, " ").replace(/\s+/g, " ").trim();

export function handleCustomerMessage(raw: string, phone: string, data: CustomerBotData): CustomerReply {
  const text = strip(raw);
  const code = raw.toUpperCase().match(/WIL[\s-]?[A-Z0-9]{4}/);
  if (code) {
    const b = data.bookings.find((x) => x.code === normalizeCode(code[0]));
    if (!b) return { text: `No existe la reserva ${normalizeCode(code[0])}.` };
    const d = data.departures.find((x) => x.id === b.departureId);
    const t = data.tours.find((x) => x.id === b.tourId);
    return {
      text: `*${b.code}* · ${t?.name}\n${d ? `${formatDayShort(d.startsAt)}, ${formatTime(d.startsAt)}` : ""} · ${b.partySize} cupos\nBoleto: ${ticketUrl(b.code)}`,
      buttons: ["Qué llevar", "Hablar con Wilber"],
    };
  }

  if (/(salidas|fechas|cupos|disponib|reservar|precio|cuanto)/.test(text)) {
    const next = data.departures
      .filter((d) => d.status === "abierta" && Date.parse(d.startsAt) > data.now + 2 * 3600_000)
      .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
      .filter((d) => seatsLeft(d, data.holds, data.now) > 0)
      .slice(0, 5);
    if (!next.length) return { text: "No hay salidas con cupo por ahora.", forwardToWilber: true };
    const lines = next.map((d) => {
      const t = data.tours.find((x) => x.id === d.tourId);
      return `*${t?.shortName}* ${formatDayShort(d.startsAt)} · ${formatUsd(d.priceUsd)} · ${seatsLeft(d, data.holds, data.now)} cupos`;
    });
    return { text: `${lines.join("\n")}\n\nReservas: ${siteUrl()}/aventuras`, buttons: ["Hablar con Wilber"] };
  }

  const mine = data.bookings
    .filter((b) => b.phone === phone && b.status !== "cancelada")
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
  if (/(llevar|ropa|clima|hora|llegar|donde)/.test(text) && mine) {
    const t = data.tours.find((x) => x.id === mine.tourId);
    return { text: `${t?.shortName}: ${t?.bring.join(", ").toLowerCase()}.\nBoleto: ${ticketUrl(mine.code)}` };
  }

  if (/^(hola|buenas|buenos|info|informacion)/.test(text)) {
    return {
      text: "Escribí *salidas* para ver fechas con cupo, o tu código WIL-XXXX para ver tu reserva.",
      buttons: ["Salidas", "Hablar con Wilber"],
    };
  }

  return { text: "Wilber responde este mensaje personalmente.", forwardToWilber: true };
}
