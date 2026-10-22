// Domain model for Tours de Aventura de Wilber.
// Every date is an ISO-8601 string with offset; El Salvador is UTC-6 all year.

export type Difficulty = "suave" | "moderada" | "exigente" | "extrema";

export type TourTag = "volcan" | "cascada" | "bosque" | "lago" | "playa" | "pueblo" | "manglar";

export interface LngLat {
  lng: number;
  lat: number;
}

export interface Waypoint extends LngLat {
  id: string;
  name: string;
  /** What happens here, one line. */
  note?: string;
  kind: "inicio" | "mirador" | "cima" | "agua" | "descanso" | "fin" | "peligro";
  /** Metres above sea level, when known. */
  altitude?: number;
}

export interface Route {
  /** [lng, lat] pairs, in walking order. */
  path: [number, number][];
  waypoints: Waypoint[];
  /** Camera framing for the 3D map. */
  camera: { center: [number, number]; zoom: number; pitch: number; bearing: number };
}

export interface ItineraryStep {
  /** "04:30" — local time of the day of the tour. */
  time: string;
  label: string;
  detail?: string;
}

export interface Tour {
  id: string;
  slug: string;
  /** Two-letter code used in departure refs ("SA24") and WhatsApp commands. */
  code: string;
  name: string;
  /** Short name for tight places (tabs, WhatsApp, tickets). */
  shortName: string;
  /** Departamento. */
  region: string;
  /** Catalog line: one factual sentence, ≤ 90 characters. */
  summary: string;
  /** Detail paragraph. */
  description: string;
  difficulty: Difficulty;
  tags: TourTag[];
  durationHours: number;
  distanceKm: number;
  elevationGainM: number;
  maxAltitudeM: number;
  priceUsd: number;
  /** Optional deposit to hold seats online (Wompi, pending). */
  depositUsd: number;
  /** Default seats per departure — the microbus. */
  capacity: number;
  minAge: number;
  /** Weekdays this tour usually runs (0 = domingo). */
  weekdays: number[];
  /** Local departure time "HH:mm". */
  departureTime: string;
  meetingPointId: string;
  includes: string[];
  bring: string[];
  itinerary: ItineraryStep[];
  /** "Cuándo llegar" — minutes before departure the group must be there. */
  arriveMinutesBefore: number;
  photo: string; // key of PHOTO_CREDITS
  route: Route;
  active: boolean;
}

export interface MeetingPoint extends LngLat {
  id: string;
  name: string;
  address: string;
  city: string;
  instructions: string;
  mapsUrl: string;
}

export interface Guide {
  id: string;
  name: string;
  phone: string;
  /** Guides who can lead "exigente" / "extrema" tours. */
  senior: boolean;
}

export interface Vehicle {
  id: string;
  name: string;
  plate: string;
  /** Passenger seats, without the driver. */
  seats: number;
  driver: string;
}

export type DepartureStatus = "abierta" | "cerrada" | "cancelada" | "realizada";

export interface Departure {
  id: string;
  tourId: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  /** Seats already sold (sum of partySize of live bookings). */
  seatsTaken: number;
  priceUsd: number;
  status: DepartureStatus;
  guideId: string | null;
  vehicleId: string | null;
  meetingPointId: string;
  /** Wilber's note for the group (shown on the ticket). */
  notes?: string;
  /** False while Wilber has not published the preparation notes. */
  prepReady: boolean;
  createdAt: string;
}

export type BookingStatus = "confirmada" | "pendiente_pago" | "pagada" | "check_in" | "no_show" | "cancelada";

export type PaymentMethod = "en_sitio" | "wompi";
export type PaymentStatus = "no_aplica" | "pendiente" | "aprobado" | "rechazado";

export type BookingSource = "web" | "whatsapp" | "manual" | "simulacion";

export interface Booking {
  id: string;
  /** Public code, e.g. "WIL-7K2Q". */
  code: string;
  departureId: string;
  tourId: string;
  name: string;
  /** WhatsApp number in E.164 without "+", e.g. "50370001234". */
  phone: string;
  email?: string;
  partySize: number;
  notes?: string;
  status: BookingStatus;
  payment: {
    method: PaymentMethod;
    status: PaymentStatus;
    amountUsd: number;
    reference?: string;
  };
  source: BookingSource;
  checkedIn: number;
  createdAt: string;
  /** Delivery state of the confirmation (PRD: show a clear fallback if it fails). */
  confirmation: "pendiente" | "enviada" | "fallida";
}

export interface Hold {
  id: string;
  departureId: string;
  partySize: number;
  expiresAt: string;
  sessionId: string;
}

export type Channel = "whatsapp" | "email";

export type MessageKind =
  | "confirmacion"
  | "recordatorio_24h"
  | "recordatorio_salida"
  | "alerta_clima"
  | "cambio_salida"
  | "resena"
  | "pago"
  | "wilber_nueva_reserva"
  | "wilber_resumen"
  | "wilber_cruce"
  | "wilber_bot"
  | "cliente_bot"
  | "codigo"
  | "entrante";

export interface Message {
  id: string;
  channel: Channel;
  kind: MessageKind;
  direction: "saliente" | "entrante";
  /** Phone (whatsapp) or email address. */
  to: string;
  from: string;
  /** WhatsApp-flavoured text (*bold*, _italic_) or email subject. */
  body: string;
  /** Optional interactive bits for the WhatsApp mockup. */
  buttons?: string[];
  location?: { lat: number; lng: number; name: string; address: string };
  bookingId?: string;
  departureId?: string;
  status: "en_cola" | "simulado" | "enviado" | "entregado" | "leido" | "fallido";
  /** True when it really went out through Kapso / Resend. */
  real: boolean;
  createdAt: string;
  /** Simulated scheduled time (reminders). */
  scheduledFor?: string;
}

export type ConflictKind =
  | "guia_doble"
  | "vehiculo_doble"
  | "vehiculo_pequeno"
  | "sin_guia"
  | "sin_vehiculo"
  | "guia_no_apto";

export interface Conflict {
  id: string;
  kind: ConflictKind;
  severity: "alta" | "media";
  departureIds: string[];
  resourceId?: string;
  title: string;
  detail: string;
  /** What this cross would cost Wilber if nobody noticed (the $120 lesson). */
  costRiskUsd: number;
  /** A one-click fix, when one exists. */
  fix?: { label: string; departureId: string; guideId?: string; vehicleId?: string };
}

export type SimEventType =
  | "reserva.creada"
  | "reserva.rechazada"
  | "reserva.cancelada"
  | "reserva.check_in"
  | "pago.aprobado"
  | "pago.rechazado"
  | "salida.creada"
  | "salida.actualizada"
  | "salida.cerrada"
  | "salida.llena"
  | "cruce.detectado"
  | "cruce.resuelto"
  | "mensaje.enviado"
  | "mensaje.recibido"
  | "reloj.avanzado"
  | "escenario.iniciado"
  | "sistema";

export interface SimEvent {
  id: string;
  at: string;
  type: SimEventType;
  actor: "visitante" | "wilber" | "bot" | "sistema";
  summary: string;
  data?: Record<string, unknown>;
}

/** A visitor account: identified by WhatsApp number, created on first login. */
export interface Customer {
  phone: string;
  name: string;
  email?: string;
  createdAt: string;
  lastLoginAt?: string;
}

export interface Business {
  name: string;
  legalName: string;
  guide: string;
  /** Wilber's WhatsApp, E.164 without "+". */
  whatsapp: string;
  whatsappDisplay: string;
  email: string;
  instagram: string;
  city: string;
  hours: { days: string; time: string }[];
}

export interface BookingInput {
  departureId: string;
  name: string;
  phone: string;
  email?: string;
  partySize: number;
  notes?: string;
  paymentMethod: PaymentMethod;
  source?: BookingSource;
  holdId?: string;
}

export type BookingResult =
  | { ok: true; booking: Booking }
  | {
      ok: false;
      reason: "sin_cupos" | "salida_cerrada" | "salida_pasada" | "no_existe" | "datos_invalidos";
      seatsLeft: number;
      message: string;
    };
