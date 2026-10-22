import type { Booking, Departure } from "@/lib/domain/types";
import type { FormState } from "./booking-flow";

// Dev-only worst case for the booking form and the ticket (break-ui).
// Every value is something a real visitor or Wilber can produce, or the
// limit the schema accepts. Swapped in at the data boundary with ?data=peor
// (development builds only); production never reads it.

const NOTES_280 =
  "Vamos 3 adultos y 2 niños de 10 y 12 años; uno de los adultos tiene una lesión vieja de rodilla y baja despacio. ¿Se puede llevar una mochila portabebé? Pagamos el resto en efectivo. Ubicación del hotel: https://maps.example.com/p/9f8e7d6c5b4a?z=16&ll=13.9381";

export const WORST_FORM: FormState = {
  // 80 characters is the schema's limit for the name.
  name: "Aleksandra Wiśniewska-Kowalczyk de la Cruz y Fernández-Oberhauser-Wettstein III",
  phone: "7777 8888",
  email: "bartholomew.fitzgerald@northwind-industries-holdings.example.com",
  notes: NOTES_280.slice(0, 280),
  pay: "wompi",
};

/** Longest tour name and meeting point, a 25-seat coaster, the longest date in Spanish. */
export const WORST_DEPARTURE: Departure = {
  id: "d-lt-2027-09-29",
  tourId: "t-los-tercios",
  startsAt: "2027-09-29T07:00:00-06:00",
  endsAt: "2027-09-29T21:00:00.000Z",
  capacity: 25,
  seatsTaken: 25,
  priceUsd: 60,
  status: "abierta",
  guideId: "josue",
  vehicleId: "la-coaster",
  meetingPointId: "suchitoto",
  notes:
    "Si llueve la víspera, te escribo antes de las 6 p. m. para confirmar. Llevamos bastones extra; avisá si alguien del grupo tiene una lesión de rodilla o tobillo para ajustar el ritmo en la bajada a la poza.",
  prepReady: true,
  createdAt: "2026-10-01T12:00:00.000Z",
};

export const WORST_BOOKING: Booking = {
  id: "b-wmwm-peor",
  // W and M are the widest glyphs the code alphabet has.
  code: "WIL-WMWM",
  departureId: WORST_DEPARTURE.id,
  tourId: "t-los-tercios",
  name: WORST_FORM.name,
  phone: "50377778888",
  email: WORST_FORM.email,
  partySize: 25,
  notes: WORST_FORM.notes,
  status: "pendiente_pago",
  payment: { method: "wompi", status: "pendiente", amountUsd: 500 },
  source: "web",
  checkedIn: 0,
  createdAt: "2026-10-22T18:00:00.000Z",
  confirmation: "fallida",
};

export const devWorstCase = process.env.NODE_ENV !== "production";
