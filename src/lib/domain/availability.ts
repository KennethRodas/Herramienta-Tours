import { z } from "zod";
import type { BookingInput, Departure, Hold } from "./types";
import { normalizePhone } from "./format";

// Booking codes avoid look-alike characters (0/O, 1/I/L, 2/Z, 5/S, 8/B).
const CODE_ALPHABET = "ACDEFGHJKMNPQRTUVWXY34679";

export function makeBookingCode(random: () => number = Math.random, taken?: Set<string>) {
  for (let attempt = 0; attempt < 50; attempt++) {
    let s = "";
    for (let i = 0; i < 4; i++) s += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
    const code = `WIL-${s}`;
    if (!taken?.has(code)) return code;
  }
  throw new Error("No se pudo generar un código único");
}

export function normalizeCode(input: string) {
  const raw = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const body = raw.startsWith("WIL") ? raw.slice(3) : raw;
  return body.length === 4 ? `WIL-${body}` : input.trim().toUpperCase();
}

export function activeHolds(holds: Hold[], departureId: string, now: number, exceptHoldId?: string) {
  return holds.filter(
    (h) => h.departureId === departureId && h.id !== exceptHoldId && Date.parse(h.expiresAt) > now,
  );
}

/** Seats a visitor can still take: capacity − sold − other people's live holds. */
export function seatsLeft(dep: Departure, holds: Hold[] = [], now = Date.now(), exceptHoldId?: string) {
  const held = activeHolds(holds, dep.id, now, exceptHoldId).reduce((n, h) => n + h.partySize, 0);
  return Math.max(0, dep.capacity - dep.seatsTaken - held);
}

export type DepartureState = "disponible" | "ultimos" | "llena" | "cerrada" | "cancelada" | "pasada";

export function departureState(dep: Departure, now: number, holds: Hold[] = []): DepartureState {
  if (dep.status === "cancelada") return "cancelada";
  if (Date.parse(dep.startsAt) <= now || dep.status === "realizada") return "pasada";
  if (dep.status === "cerrada") return "cerrada";
  const left = seatsLeft(dep, holds, now);
  if (left <= 0) return "llena";
  if (left <= 3) return "ultimos";
  return "disponible";
}

export const DEPARTURE_STATE_LABEL: Record<DepartureState, string> = {
  disponible: "Con cupos",
  ultimos: "Últimos cupos",
  llena: "Llena",
  cerrada: "Cerrada",
  cancelada: "Cancelada",
  pasada: "Ya salió",
};

export function isBookable(state: DepartureState) {
  return state === "disponible" || state === "ultimos";
}

/** Online booking closes this long before departure (Wilber needs time to plan). */
export const BOOKING_CUTOFF_MS = 2 * 60 * 60 * 1000;
/** How long a seat hold lasts while the visitor fills the form. */
export const HOLD_MS = 10 * 60 * 1000;

export const bookingSchema = z.object({
  departureId: z.string().min(1),
  name: z
    .string()
    .trim()
    .min(3, "Escribí tu nombre y apellido.")
    .max(80, "El nombre es demasiado largo.")
    .refine((v) => v.split(/\s+/).length >= 2, "Escribí también tu apellido."),
  phone: z
    .string()
    .trim()
    .refine((v) => {
      const d = normalizePhone(v);
      return (d.startsWith("503") && d.length === 11 && /^503[67]/.test(d)) || (!d.startsWith("503") && d.length >= 10 && d.length <= 15);
    }, "Necesitamos un WhatsApp válido: 8 dígitos si es de El Salvador."),
  email: z
    .string()
    .trim()
    .email("Ese correo no parece válido.")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  partySize: z.number().int().min(1, "Al menos una persona.").max(25, "Para grupos de más de 25, escribile a Wilber."),
  notes: z.string().trim().max(280, "Máximo 280 caracteres.").optional(),
  paymentMethod: z.enum(["en_sitio", "wompi"]),
  source: z.enum(["web", "whatsapp", "manual", "simulacion"]).optional(),
  holdId: z.string().optional(),
});

export type BookingFieldErrors = Partial<Record<keyof BookingInput, string>>;

export function validateBooking(input: BookingInput): { ok: true; data: BookingInput } | { ok: false; errors: BookingFieldErrors } {
  const parsed = bookingSchema.safeParse(input);
  if (parsed.success) {
    return { ok: true, data: { ...parsed.data, phone: normalizePhone(parsed.data.phone) } as BookingInput };
  }
  const errors: BookingFieldErrors = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path[0] as keyof BookingInput;
    if (key && !errors[key]) errors[key] = issue.message;
  }
  return { ok: false, errors };
}
