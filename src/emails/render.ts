// Email rendering contract. The BOOKING agent implements the React Email
// templates in src/emails/*.tsx and fills in renderEmail(); the API routes
// (/api/email/render, /api/email/send) call it on the server.

import type { Booking, Departure, MessageKind } from "@/lib/domain/types";

export type EmailKind = Extract<MessageKind, "confirmacion" | "recordatorio_24h" | "wilber_resumen" | "pago" | "cambio_salida">;

export interface EmailData {
  booking?: Booking;
  departure?: Departure;
  /** For Wilber's digest: tomorrow's departures with their bookings. */
  digest?: { departure: Departure; bookings: Booking[] }[];
  /** Absolute site URL for links in the email. */
  siteUrl: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export async function renderEmail(kind: EmailKind, data: EmailData): Promise<RenderedEmail> {
  const subject = `Wilber · ${kind}`;
  const text = `${kind} ${data.booking?.code ?? ""}`.trim();
  return { subject, text, html: `<p>${text}</p>` };
}
