// Email rendering contract. The templates live in src/emails/*.tsx; the API
// routes (/api/email/render, /api/email/send) call renderEmail() on the server.
// Every kind returns a subject, the HTML (React Email, 600px, email-safe
// tables) and a plain-text version written line by line, not scraped.

import { createElement } from "react";
import { render } from "@react-email/render";
import type { Booking, Departure, MessageKind } from "@/lib/domain/types";
import { CambioSalida, cambioSubject, cambioText, changeOf, type ChangeInfo } from "./cambio-salida";
import { Confirmacion, confirmacionSubject, confirmacionText } from "./confirmacion";
import { bookingCtx, plain } from "./context";
import { Pago, pagoSubject, pagoText } from "./pago";
import { Recordatorio, recordatorioSubject, recordatorioText } from "./recordatorio";
import { ResumenWilber, resumenSubject, resumenText } from "./resumen-wilber";
import { Fallback } from "./parts";

export type EmailKind = Extract<MessageKind, "confirmacion" | "recordatorio_24h" | "wilber_resumen" | "pago" | "cambio_salida">;

export interface EmailData {
  booking?: Booking;
  departure?: Departure;
  /** For Wilber's digest: tomorrow's departures with their bookings. */
  digest?: { departure: Departure; bookings: Booking[] }[];
  /** Absolute site URL for links in the email. */
  siteUrl: string;
  /** Optional, for "cambio_salida": what changed. Derived from the departure when absent. */
  change?: ChangeInfo;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export async function renderEmail(kind: EmailKind, data: EmailData): Promise<RenderedEmail> {
  const siteUrl = (data.siteUrl || "").replace(/\/$/, "");

  if (kind === "wilber_resumen") {
    const digest = data.digest ?? [];
    return {
      subject: resumenSubject(digest),
      html: await render(createElement(ResumenWilber, { digest, siteUrl })),
      text: resumenText(digest, siteUrl),
    };
  }

  const c = data.booking && data.departure ? bookingCtx(data.booking, data.departure, siteUrl) : null;
  if (!c) return missingData(kind, data, siteUrl);

  switch (kind) {
    case "confirmacion":
      return { subject: confirmacionSubject(c), html: await render(createElement(Confirmacion, { c })), text: confirmacionText(c) };
    case "recordatorio_24h":
      return { subject: recordatorioSubject(c), html: await render(createElement(Recordatorio, { c })), text: recordatorioText(c) };
    case "pago":
      return { subject: pagoSubject(c), html: await render(createElement(Pago, { c })), text: pagoText(c) };
    case "cambio_salida": {
      const change = changeOf(c, data.change);
      return { subject: cambioSubject(c, change), html: await render(createElement(CambioSalida, { c, change })), text: cambioText(c, change) };
    }
  }
}

/** A booking email asked for without its booking or departure: say what is missing. */
async function missingData(kind: EmailKind, data: EmailData, siteUrl: string): Promise<RenderedEmail> {
  const code = data.booking?.code;
  const subject = code ? `Reserva ${code}` : "Reserva";
  const line = "Faltan los datos de la reserva o de la salida para armar este correo.";
  const html = await render(createElement(Fallback, { title: subject, line, siteUrl }));
  return { subject, html, text: plain([subject, line, `(${kind})`]) };
}
