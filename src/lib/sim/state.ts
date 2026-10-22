import type { Booking, Customer, Departure, Hold, Message, SimEvent, Tour } from "@/lib/domain/types";

export type TourOverride = Partial<Pick<Tour, "active" | "priceUsd" | "capacity" | "route" | "departureTime">>;

export interface SimSettings {
  /** Reminders, confirmations and alerts are generated automatically. */
  autoMessages: boolean;
  /** Also push WhatsApp messages through Kapso (always redirected to testPhone). */
  realWhatsApp: boolean;
  testPhone: string;
  /** Also send emails through Resend (always redirected to testEmail). */
  realEmail: boolean;
  testEmail: string;
  /** Scenario: no active tours, to show the empty catalog. */
  catalogEmpty: boolean;
  /** Scenario: confirmations fail to send (PRD fallback). */
  failConfirmations: boolean;
  /** Offer the online deposit (Wompi, simulated until keys exist). */
  onlineDeposit: boolean;
  wompiOutcome: "aprobar" | "rechazar";
  /** Simulated visitors booking per simulated hour. */
  trafficPerHour: number;
  /** Wilber's dashboard PIN in the simulation. */
  adminPin: string;
  /** Wilber's phone inside the simulation (receives admin messages). */
  wilberPhone: string;
}

export interface SimClock {
  anchorReal: number;
  anchorSim: number;
  speed: number;
  paused: boolean;
}

export interface SimStats {
  bookingsCreated: number;
  seatsSold: number;
  rejected: number;
  overbookingsPrevented: number;
  conflictsResolved: number;
  moneyProtectedUsd: number;
  messagesSent: number;
}

export interface SimState {
  version: 2;
  seed: number;
  rev: number;
  createdAt: number;
  departures: Departure[];
  bookings: Booking[];
  holds: Hold[];
  messages: Message[];
  events: SimEvent[];
  tourOverrides: Record<string, TourOverride>;
  clock: SimClock;
  settings: SimSettings;
  stats: SimStats;
  /** Dedupe keys of automations already fired ("r24:<bookingId>"). */
  fired: Record<string, number>;
  scenario: string | null;
  /** Visitor accounts (login with a WhatsApp code). */
  customers: Customer[];
  /** Pending login codes, one per phone. */
  loginCodes: { phone: string; code: string; expiresAt: string; attempts: number }[];
  /** Phones and emails a person typed in this browser (only these may get real messages). */
  knownContacts: string[];
}

export const DEFAULT_SETTINGS: SimSettings = {
  autoMessages: true,
  realWhatsApp: false,
  testPhone: "",
  realEmail: false,
  testEmail: "",
  catalogEmpty: false,
  failConfirmations: false,
  onlineDeposit: true,
  wompiOutcome: "aprobar",
  trafficPerHour: 0,
  adminPin: "2381",
  // Wilber's personal phone (different from the business number the bots answer on).
  wilberPhone: "50371112233",
};

export const EMPTY_STATS: SimStats = {
  bookingsCreated: 0,
  seatsSold: 0,
  rejected: 0,
  overbookingsPrevented: 0,
  conflictsResolved: 0,
  moneyProtectedUsd: 0,
  messagesSent: 0,
};

export function simNow(clock: SimClock, realNow = Date.now()) {
  if (clock.paused) return clock.anchorSim;
  return clock.anchorSim + (realNow - clock.anchorReal) * clock.speed;
}

export const MAX_EVENTS = 600;
export const MAX_MESSAGES = 500;
