import type { Booking, Conflict, Departure, MeetingPoint, Tour } from "@/lib/domain/types";
import {
  formatDayLong,
  formatDayShort,
  formatPhone,
  formatTime,
  formatUsd,
  plural,
} from "@/lib/domain/format";
import { BUSINESS } from "@/content/catalog";

// WhatsApp copy, shared by the simulator, the Kapso sender and the webhook bot.
// Data only: code, tour, date, time, place, amount, link. No greetings, no slogans, no emoji.

export interface WaMessage {
  body: string;
  buttons?: string[];
  location?: { lat: number; lng: number; name: string; address: string };
}

export function siteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "https://wilbertours.vercel.app";
}

export const ticketUrl = (code: string) => `${siteUrl()}/reserva/${code}`;

function arrivalTime(dep: Departure, tour: Tour) {
  return formatTime(Date.parse(dep.startsAt) - tour.arriveMinutesBefore * 60_000);
}

export function bookingConfirmation(b: Booking, dep: Departure, tour: Tour, mp: MeetingPoint): WaMessage {
  const total = b.partySize * dep.priceUsd;
  const payLine =
    b.payment.method === "wompi"
      ? b.payment.status === "aprobado"
        ? `Anticipo pagado: ${formatUsd(b.payment.amountUsd)}. Saldo: ${formatUsd(total - b.payment.amountUsd)} el día de la salida.`
        : `Anticipo pendiente: ${formatUsd(b.payment.amountUsd)}.`
      : `Total: ${formatUsd(total)}, pago el día de la salida.`;
  return {
    body: [
      `*Reserva ${b.code} confirmada*`,
      `${tour.name} · ${plural(b.partySize, "persona", "personas")}`,
      `${formatDayLong(dep.startsAt)}, ${formatTime(dep.startsAt)}`,
      `Encuentro: ${mp.name}, ${arrivalTime(dep, tour)}`,
      payLine,
      `Boleto: ${ticketUrl(b.code)}`,
    ].join("\n"),
    buttons: ["Ver boleto", "Cómo llegar", "Hablar con Wilber"],
  };
}

export function reminder24h(b: Booking, dep: Departure, tour: Tour, mp: MeetingPoint, weather?: string): WaMessage {
  return {
    body: [
      `*Mañana: ${tour.name}*`,
      `Salida: ${formatTime(dep.startsAt)}, ${mp.name}`,
      `Llegar: ${arrivalTime(dep, tour)}`,
      weather ? `Clima: ${weather}` : null,
      `Llevar: ${tour.bring.slice(0, 4).join(", ").toLowerCase()}.`,
      dep.notes ? `Nota: ${dep.notes}` : null,
      `Boleto: ${ticketUrl(b.code)}`,
    ]
      .filter((l) => l !== null)
      .join("\n"),
    buttons: ["Confirmo", "Tengo una duda"],
  };
}

export function reminderDayOf(b: Booking, dep: Departure, tour: Tour, mp: MeetingPoint): WaMessage {
  return {
    body: [`*Hoy: ${tour.name} · ${b.code}*`, `Salida ${formatTime(dep.startsAt)}. Punto de encuentro:`].join("\n"),
    location: { lat: mp.lat, lng: mp.lng, name: mp.name, address: `${mp.address}, ${mp.city}` },
  };
}

export function reviewRequest(b: Booking, tour: Tour): WaMessage {
  return {
    body: `¿Cómo calificás el tour ${tour.name}? Respondé del 1 al 5.`,
    buttons: ["5", "4", "3 o menos"],
  };
}

export function weatherAlert(b: Booking, dep: Departure, tour: Tour, detail: string): WaMessage {
  return {
    body: [`*Aviso de clima · ${tour.shortName} ${formatDayShort(dep.startsAt)}*`, detail, "Para cambiar de fecha sin costo, respondé CAMBIAR."].join("\n"),
    buttons: ["Sigo en pie", "Cambiar fecha"],
  };
}

export function departureChanged(b: Booking, dep: Departure, tour: Tour, what: "cancelada" | "cambio", detail: string): WaMessage {
  return {
    body: [
      what === "cancelada" ? `*Salida cancelada · ${tour.shortName} ${formatDayShort(dep.startsAt)}*` : `*Cambio en la reserva ${b.code}*`,
      detail,
      "Respondé este mensaje para reprogramar.",
    ].join("\n"),
  };
}

export function paymentReceived(b: Booking, tour: Tour): WaMessage {
  return {
    body: [`*Pago recibido · ${b.code}*`, `${formatUsd(b.payment.amountUsd)} de anticipo para ${tour.name}.`].join("\n"),
  };
}


// --- Messages to Wilber ---------------------------------------------------

export function wilberNewBooking(b: Booking, dep: Departure, tour: Tour, ref: string, left: number): WaMessage {
  return {
    body: [
      `*Nueva reserva · ${b.code}*`,
      `${tour.shortName} ${formatDayShort(dep.startsAt)} (${ref}) · ${plural(b.partySize, "persona", "personas")}`,
      `${b.name} · ${formatPhone(b.phone)}`,
      `Quedan ${left} de ${dep.capacity}.${b.payment.method === "wompi" ? " Pago en línea pendiente." : ""}`,
    ].join("\n"),
    buttons: [`Lista ${ref}`, "Hoy"],
  };
}

export function wilberConflict(c: Conflict): WaMessage {
  return {
    body: [
      `*Cruce detectado*`,
      c.title,
      c.detail,
      c.costRiskUsd ? `Si nadie lo nota, cuesta unos ${formatUsd(c.costRiskUsd)}.` : "Es un riesgo de seguridad.",
      c.fix ? `Arreglo sugerido: ${c.fix.label}. Respondé *ARREGLAR* para aplicarlo.` : "Revisalo en el panel.",
    ].join("\n"),
    buttons: c.fix ? ["Arreglar", "Ver cruces"] : ["Ver cruces"],
  };
}

export function contactWilberText(code?: string) {
  return code ? `Hola Wilber, tengo la reserva ${code} y quiero consultar algo.` : "Hola Wilber, quiero información de los tours.";
}

export const WILBER_PUBLIC_PHONE = BUSINESS.whatsapp;
