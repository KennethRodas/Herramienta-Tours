"use client";

import type {
  Booking,
  BookingInput,
  BookingResult,
  Departure,
  Hold,
  Message,
  MessageKind,
  SimEvent,
  SimEventType,
  Tour,
} from "@/lib/domain/types";
import { GUIDES, TOURS, VEHICLES, BUSINESS, meetingPointById, tourById } from "@/content/catalog";
import {
  BOOKING_CUTOFF_MS,
  HOLD_MS,
  makeBookingCode,
  seatsLeft,
  validateBooking,
} from "@/lib/domain/availability";
import { detectConflicts } from "@/lib/domain/conflicts";
import { departureRef } from "@/lib/domain/refs";
import { formatDayShort, formatUsd, normalizePhone, plural, svISO, HOUR } from "@/lib/domain/format";
import * as wa from "@/lib/whatsapp/templates";
import { handleAdminMessage, type BotAction } from "@/lib/whatsapp/admin-bot";
import { handleCustomerMessage } from "@/lib/whatsapp/customer-bot";
import { createSeedState, makeDeparture } from "./seed";
import { MAX_EVENTS, MAX_MESSAGES, simNow, type SimSettings, type SimState, type TourOverride } from "./state";

// The simulation runs entirely in the browser. Every write goes through
// `commit`, which takes a Web Lock, re-reads the latest state from
// localStorage, applies the change and broadcasts it to the other tabs.
// Two tabs (or forty bots) booking the last seat at once are serialised,
// which is exactly the guarantee the Supabase `create_booking` RPC gives.

const KEY = "wilber.sim.v2";
const CHANNEL = "wilber-sim";
const LOCK = "wilber-sim-write";

let state: SimState | null = null;
const listeners = new Set<() => void>();
let channel: BroadcastChannel | null = null;
let booted = false;

const isBrowser = () => typeof window !== "undefined";

function read(): SimState | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SimState;
    if (parsed?.version !== 2) return null;
    // Fields added after a state was saved.
    parsed.customers ??= [];
    parsed.loginCodes ??= [];
    parsed.knownContacts ??= [];
    return parsed;
  } catch {
    return null;
  }
}

function write(next: SimState) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked: keep running in memory.
    next.events = next.events.slice(0, 200);
    next.messages = next.messages.slice(0, 150);
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* in-memory only */
    }
  }
}

function emit() {
  for (const l of listeners) l();
}

function boot() {
  if (booted || !isBrowser()) return;
  booted = true;
  state = read();
  if (!state) {
    state = createSeedState(Math.floor(Math.random() * 1e9));
    write(state);
  }
  try {
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = () => {
      const latest = read();
      if (latest && latest.rev !== state?.rev) {
        state = latest;
        emit();
      }
    };
  } catch {
    window.addEventListener("storage", (e) => {
      if (e.key !== KEY) return;
      const latest = read();
      if (latest) {
        state = latest;
        emit();
      }
    });
  }
}

export function subscribe(fn: () => void) {
  boot();
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getState(): SimState | null {
  boot();
  return state;
}

export function getServerState(): SimState | null {
  return null;
}

type Draft = SimState;

async function commit<R>(mutate: (draft: Draft, now: number) => R): Promise<R> {
  boot();
  const run = () => {
    const base = read() ?? state!;
    const draft: Draft = structuredClone(base);
    const now = simNow(draft.clock);
    const result = mutate(draft, now);
    draft.rev = base.rev + 1;
    draft.events = draft.events.slice(0, MAX_EVENTS);
    draft.messages = draft.messages.slice(-MAX_MESSAGES);
    write(draft);
    state = draft;
    emit();
    channel?.postMessage({ rev: draft.rev });
    return result;
  };
  if (isBrowser() && "locks" in navigator && navigator.locks) {
    return navigator.locks.request(LOCK, async () => run());
  }
  return run();
}

// ---------------------------------------------------------------------------
// Helpers used inside mutations

let counter = 0;
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function effectiveTours(s: Pick<SimState, "tourOverrides" | "settings"> | null): Tour[] {
  return TOURS.map((t) => {
    const o = s?.tourOverrides[t.id] ?? {};
    return { ...t, ...o, active: s?.settings.catalogEmpty ? false : (o.active ?? t.active) };
  });
}

/** Contacts typed by a person in this browser: the only ones that may get real WhatsApp/email. */
function remember(d: Draft, phone?: string, email?: string) {
  for (const c of [phone ? normalizePhone(phone) : "", email?.trim().toLowerCase() ?? ""]) {
    if (c && !d.knownContacts.includes(c)) d.knownContacts.push(c);
  }
}

function logEvent(d: Draft, now: number, type: SimEventType, actor: SimEvent["actor"], summary: string, data?: Record<string, unknown>) {
  d.events.unshift({ id: newId("e"), at: new Date(now).toISOString(), type, actor, summary, data });
}

function pushMessage(d: Draft, now: number, m: Omit<Message, "id" | "createdAt" | "status" | "real"> & { status?: Message["status"] }) {
  const msg: Message = {
    ...m,
    id: newId("m"),
    createdAt: new Date(now).toISOString(),
    status: m.status ?? (m.direction === "entrante" ? "entregado" : "en_cola"),
    real: false,
  };
  d.messages.push(msg);
  if (msg.direction === "saliente") d.stats.messagesSent++;
  return msg;
}

function queueWa(d: Draft, now: number, to: string, kind: MessageKind, m: wa.WaMessage, extra: Partial<Message> = {}) {
  return pushMessage(d, now, {
    channel: "whatsapp",
    kind,
    direction: "saliente",
    to,
    from: BUSINESS.whatsapp,
    body: m.body,
    buttons: m.buttons,
    location: m.location,
    ...extra,
  });
}

function queueEmail(d: Draft, now: number, to: string, kind: MessageKind, subject: string, extra: Partial<Message> = {}) {
  return pushMessage(d, now, { channel: "email", kind, direction: "saliente", to, from: BUSINESS.email, body: subject, ...extra });
}

function ctxFor(d: Draft, dep: Departure) {
  const tour = effectiveTours(d).find((t) => t.id === dep.tourId)!;
  const mp = meetingPointById(dep.meetingPointId)!;
  return { tour, mp, ref: departureRef(dep, TOURS, d.departures) };
}

function sendConfirmation(d: Draft, now: number, b: Booking, dep: Departure) {
  const { tour, mp, ref } = ctxFor(d, dep);
  const failed = d.settings.failConfirmations;
  const m = queueWa(d, now, b.phone, "confirmacion", wa.bookingConfirmation(b, dep, tour, mp), {
    bookingId: b.id,
    departureId: dep.id,
    status: failed ? "fallido" : "en_cola",
  });
  if (b.email && !failed) {
    queueEmail(d, now, b.email, "confirmacion", `Tu boleto ${b.code} · ${tour.name}, ${formatDayShort(dep.startsAt)}`, {
      bookingId: b.id,
      departureId: dep.id,
    });
  }
  b.confirmation = failed ? "fallida" : "enviada";
  if (failed) logEvent(d, now, "mensaje.enviado", "sistema", `No se pudo enviar la confirmación de ${b.code}; el boleto muestra cómo contactar a Wilber.`);
  queueWa(d, now, d.settings.wilberPhone, "wilber_nueva_reserva", wa.wilberNewBooking(b, dep, tour, ref, seatsLeft(dep, d.holds, now)), {
    bookingId: b.id,
    departureId: dep.id,
  });
  return m;
}

function applyBotActions(d: Draft, now: number, actions: BotAction[] | undefined) {
  for (const a of actions ?? []) {
    if (a.type === "closeDeparture" || a.type === "openDeparture") {
      const dep = d.departures.find((x) => x.id === a.departureId);
      if (dep) {
        dep.status = a.type === "closeDeparture" ? "cerrada" : "abierta";
        logEvent(d, now, a.type === "closeDeparture" ? "salida.cerrada" : "salida.actualizada", "wilber", `${ctxFor(d, dep).ref} ${a.type === "closeDeparture" ? "cerrada" : "abierta"} desde WhatsApp.`);
      }
    }
    if (a.type === "checkIn") {
      const b = d.bookings.find((x) => x.id === a.bookingId);
      if (b) {
        b.checkedIn = a.count;
        b.status = "check_in";
        logEvent(d, now, "reserva.check_in", "wilber", `Llegó ${b.name} (${b.code}).`);
      }
    }
    if (a.type === "cancelBooking") cancelInDraft(d, now, a.bookingId, "wilber");
    if (a.type === "applyFix") applyFixInDraft(d, now, a.conflictId, "wilber");
  }
}

function cancelInDraft(d: Draft, now: number, bookingId: string, actor: SimEvent["actor"]) {
  const b = d.bookings.find((x) => x.id === bookingId);
  if (!b || b.status === "cancelada") return;
  const dep = d.departures.find((x) => x.id === b.departureId);
  b.status = "cancelada";
  if (dep) dep.seatsTaken = Math.max(0, dep.seatsTaken - b.partySize);
  logEvent(d, now, "reserva.cancelada", actor, `${b.code} cancelada; se liberaron ${plural(b.partySize, "cupo", "cupos")}.`);
}

function applyFixInDraft(d: Draft, now: number, conflictId: string, actor: SimEvent["actor"]) {
  const conflicts = detectConflicts({ departures: d.departures, tours: effectiveTours(d), guides: GUIDES, vehicles: VEHICLES, now });
  const c = conflicts.find((x) => x.id === conflictId);
  if (!c?.fix) return false;
  const dep = d.departures.find((x) => x.id === c.fix!.departureId);
  if (!dep) return false;
  if (c.fix.guideId) dep.guideId = c.fix.guideId;
  if (c.fix.vehicleId) dep.vehicleId = c.fix.vehicleId;
  d.stats.conflictsResolved++;
  d.stats.moneyProtectedUsd += c.costRiskUsd;
  logEvent(d, now, "cruce.resuelto", actor, `${c.title}: ${c.fix.label}. Se evitó un gasto de ${formatUsd(c.costRiskUsd)}.`);
  return true;
}

function bookInDraft(d: Draft, now: number, input: BookingInput, actor: SimEvent["actor"]): BookingResult {
  const dep = d.departures.find((x) => x.id === input.departureId);
  if (!dep) return { ok: false, reason: "no_existe", seatsLeft: 0, message: "Esa salida ya no existe." };
  const left = seatsLeft(dep, d.holds, now, input.holdId);
  const reject = (reason: Exclude<BookingResult, { ok: true }>["reason"], message: string): BookingResult => {
    d.stats.rejected++;
    if (reason === "sin_cupos") d.stats.overbookingsPrevented++;
    logEvent(d, now, "reserva.rechazada", actor, message, { departureId: dep.id, partySize: input.partySize, seatsLeft: left });
    return { ok: false, reason, seatsLeft: left, message };
  };
  if (dep.status === "cancelada" || dep.status === "cerrada") return reject("salida_cerrada", "Wilber cerró esta salida; elegí otra fecha.");
  if (Date.parse(dep.startsAt) - BOOKING_CUTOFF_MS <= now) return reject("salida_pasada", "Esta salida ya no recibe reservas en línea.");
  const valid = validateBooking(input);
  if (!valid.ok) return { ok: false, reason: "datos_invalidos", seatsLeft: left, message: Object.values(valid.errors)[0] ?? "Revisá los datos." };
  if (input.partySize > left) {
    return reject(
      "sin_cupos",
      left === 0 ? "Se acaban de llenar los cupos de esta salida." : `Solo ${left === 1 ? "queda 1 cupo" : `quedan ${left} cupos`}: no alcanza para ${input.partySize} personas.`,
    );
  }
  const tour = effectiveTours(d).find((t) => t.id === dep.tourId)!;
  const code = makeBookingCode(Math.random, new Set(d.bookings.map((b) => b.code)));
  const online = valid.data.paymentMethod === "wompi";
  const booking: Booking = {
    id: newId("b"),
    code,
    departureId: dep.id,
    tourId: dep.tourId,
    name: valid.data.name.trim(),
    phone: valid.data.phone,
    email: valid.data.email || undefined,
    partySize: valid.data.partySize,
    notes: valid.data.notes || undefined,
    status: online ? "pendiente_pago" : "confirmada",
    payment: {
      method: valid.data.paymentMethod,
      status: online ? "pendiente" : "no_aplica",
      amountUsd: online ? tour.depositUsd * valid.data.partySize : 0,
    },
    source: input.source ?? (actor === "bot" ? "simulacion" : "web"),
    checkedIn: 0,
    createdAt: new Date(now).toISOString(),
    confirmation: "pendiente",
  };
  d.bookings.push(booking);
  dep.seatsTaken += booking.partySize;
  if (input.holdId) d.holds = d.holds.filter((h) => h.id !== input.holdId);
  d.stats.bookingsCreated++;
  d.stats.seatsSold += booking.partySize;
  logEvent(d, now, "reserva.creada", actor, `${booking.code}: ${booking.name} × ${booking.partySize} en ${tour.shortName} ${formatDayShort(dep.startsAt)}.`, {
    bookingId: booking.id,
    departureId: dep.id,
  });
  if (seatsLeft(dep, d.holds, now) === 0) logEvent(d, now, "salida.llena", "sistema", `${ctxFor(d, dep).ref} se llenó (${dep.capacity}/${dep.capacity}).`);
  if (!online) sendConfirmation(d, now, booking, dep);
  return { ok: true, booking };
}

// ---------------------------------------------------------------------------
// Public actions

export const sim = {
  async book(input: BookingInput, actor: SimEvent["actor"] = "visitante") {
    return commit((d, now) => {
      if (actor === "visitante") remember(d, input.phone, input.email);
      return bookInDraft(d, now, input, actor);
    });
  },

  /** Holds seats for 10 minutes while the visitor fills the form. */
  async hold(departureId: string, partySize: number, sessionId: string, previousHoldId?: string) {
    return commit((d, now) => {
      d.holds = d.holds.filter((h) => Date.parse(h.expiresAt) > now && h.id !== previousHoldId);
      const dep = d.departures.find((x) => x.id === departureId);
      if (!dep) return { ok: false as const, seatsLeft: 0 };
      const left = seatsLeft(dep, d.holds, now);
      if (partySize > left) return { ok: false as const, seatsLeft: left };
      const hold: Hold = { id: newId("h"), departureId, partySize, sessionId, expiresAt: new Date(now + HOLD_MS).toISOString() };
      d.holds.push(hold);
      return { ok: true as const, hold, seatsLeft: left - partySize };
    });
  },

  async releaseHold(holdId: string) {
    return commit((d) => {
      d.holds = d.holds.filter((h) => h.id !== holdId);
    });
  },

  /** Simulated Wompi result for an online deposit. */
  async settlePayment(bookingId: string, outcome: "aprobar" | "rechazar") {
    return commit((d, now) => {
      const b = d.bookings.find((x) => x.id === bookingId);
      if (!b) return null;
      const dep = d.departures.find((x) => x.id === b.departureId)!;
      const tour = effectiveTours(d).find((t) => t.id === b.tourId)!;
      if (outcome === "aprobar") {
        b.payment.status = "aprobado";
        b.payment.reference = `SIM-${Math.floor(100000 + Math.random() * 899999)}`;
        b.status = "pagada";
        logEvent(d, now, "pago.aprobado", "visitante", `Anticipo de ${formatUsd(b.payment.amountUsd)} aprobado para ${b.code}.`);
        sendConfirmation(d, now, b, dep);
        queueWa(d, now, b.phone, "pago", wa.paymentReceived(b, tour), { bookingId: b.id });
      } else {
        b.payment.status = "rechazado";
        b.status = "confirmada";
        b.payment.method = "en_sitio";
        b.payment.amountUsd = 0;
        logEvent(d, now, "pago.rechazado", "visitante", `El pago de ${b.code} fue rechazado; la reserva queda con pago el día de la salida.`);
        sendConfirmation(d, now, b, dep);
      }
      return b;
    });
  },

  async cancelBooking(bookingId: string, actor: SimEvent["actor"] = "wilber") {
    return commit((d, now) => cancelInDraft(d, now, bookingId, actor));
  },

  async checkIn(bookingId: string, count?: number) {
    return commit((d, now) => {
      const b = d.bookings.find((x) => x.id === bookingId);
      if (!b) return;
      b.checkedIn = count ?? b.partySize;
      b.status = b.checkedIn > 0 ? "check_in" : b.payment.status === "aprobado" ? "pagada" : "confirmada";
      logEvent(d, now, "reserva.check_in", "wilber", `${b.checkedIn} de ${b.partySize} llegaron: ${b.name} (${b.code}).`);
    });
  },

  async markNoShow(bookingId: string) {
    return commit((d, now) => {
      const b = d.bookings.find((x) => x.id === bookingId);
      if (!b) return;
      b.status = "no_show";
      b.checkedIn = 0;
      logEvent(d, now, "reserva.check_in", "wilber", `${b.name} (${b.code}) no llegó.`);
    });
  },

  async createDeparture(input: { tourId: string; dateKey: string; time?: string; capacity?: number; priceUsd?: number; guideId?: string | null; vehicleId?: string | null }) {
    return commit((d, now) => {
      const tour = effectiveTours(d).find((t) => t.id === input.tourId) ?? tourById(input.tourId)!;
      const base = makeDeparture({ ...tour, departureTime: input.time ?? tour.departureTime }, input.dateKey, new Date(now).toISOString());
      let id = base.id;
      let n = 2;
      while (d.departures.some((x) => x.id === id)) id = `${base.id}-${n++}`;
      const dep: Departure = {
        ...base,
        id,
        capacity: input.capacity ?? tour.capacity,
        priceUsd: input.priceUsd ?? tour.priceUsd,
        guideId: input.guideId ?? null,
        vehicleId: input.vehicleId ?? null,
      };
      d.departures.push(dep);
      logEvent(d, now, "salida.creada", "wilber", `Nueva salida: ${tour.shortName} ${formatDayShort(dep.startsAt)}.`, { departureId: dep.id });
      return dep;
    });
  },

  async updateDeparture(id: string, patch: Partial<Pick<Departure, "capacity" | "priceUsd" | "guideId" | "vehicleId" | "notes" | "prepReady" | "status" | "meetingPointId">>) {
    return commit((d, now) => {
      const dep = d.departures.find((x) => x.id === id);
      if (!dep) return null;
      if (patch.capacity !== undefined && patch.capacity < dep.seatsTaken) patch.capacity = dep.seatsTaken;
      Object.assign(dep, patch);
      logEvent(d, now, patch.status === "cerrada" ? "salida.cerrada" : "salida.actualizada", "wilber", `${ctxFor(d, dep).ref} actualizada.`, { departureId: id, patch });
      return dep;
    });
  },

  /** Cancels a departure and tells every booked group on WhatsApp. */
  async cancelDeparture(id: string, reason: string) {
    return commit((d, now) => {
      const dep = d.departures.find((x) => x.id === id);
      if (!dep) return;
      dep.status = "cancelada";
      const { tour } = ctxFor(d, dep);
      for (const b of d.bookings.filter((x) => x.departureId === id && x.status !== "cancelada")) {
        queueWa(d, now, b.phone, "cambio_salida", wa.departureChanged(b, dep, tour, "cancelada", reason), { bookingId: b.id, departureId: id });
      }
      logEvent(d, now, "salida.cerrada", "wilber", `${tour.shortName} ${formatDayShort(dep.startsAt)} cancelada: ${reason}`);
    });
  },

  /** Fills a departure on purpose (simulator: "se llenó mientras mirabas"). */
  async fillDeparture(id: string, leave = 0) {
    return commit((d, now) => {
      const dep = d.departures.find((x) => x.id === id);
      if (!dep) return;
      let guard = 0;
      while (seatsLeft(dep, d.holds, now) > leave && guard++ < 30) {
        const size = Math.min(1 + Math.floor(Math.random() * 3), seatsLeft(dep, d.holds, now) - leave);
        const names = ["Grupo de la UCA", "Familia Portillo", "Excursión del colegio", "Amigos de Santa Tecla"];
        bookInDraft(
          d,
          now,
          {
            departureId: id,
            name: names[guard % names.length],
            phone: `5037${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`,
            partySize: size,
            paymentMethod: "en_sitio",
            source: "simulacion",
          },
          "bot",
        );
      }
    });
  },

  async applyFix(conflictId: string) {
    return commit((d, now) => applyFixInDraft(d, now, conflictId, "wilber"));
  },

  async assign(departureId: string, patch: { guideId?: string | null; vehicleId?: string | null }) {
    return sim.updateDeparture(departureId, patch);
  },

  async setTourOverride(tourId: string, patch: TourOverride) {
    return commit((d, now) => {
      d.tourOverrides[tourId] = { ...d.tourOverrides[tourId], ...patch };
      logEvent(d, now, "sistema", "wilber", `Tour actualizado: ${tourById(tourId)?.shortName}.`);
    });
  },

  /**
   * Visitor login, step 1: a 6-digit code goes to that WhatsApp number.
   * In the simulation the code also comes back so the UI can show the
   * "message received" banner; with Supabase it would never leave the server.
   */
  async requestLoginCode(rawPhone: string) {
    return commit((d, now) => {
      const phone = normalizePhone(rawPhone);
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const expiresAt = new Date(now + 10 * 60_000).toISOString();
      d.loginCodes = d.loginCodes.filter((c) => c.phone !== phone && Date.parse(c.expiresAt) > now);
      d.loginCodes.push({ phone, code, expiresAt, attempts: 0 });
      remember(d, phone);
      queueWa(d, now, phone, "codigo", { body: `*${code}* es tu código para entrar a Wilber. Vence en 10 minutos.` });
      logEvent(d, now, "mensaje.enviado", "sistema", `Código de acceso enviado a +${phone}.`);
      return { phone, code, expiresAt };
    });
  },

  /** Visitor login, step 2. New numbers come back with `isNew` to ask for name and email. */
  async verifyLoginCode(rawPhone: string, code: string) {
    return commit((d, now) => {
      const phone = normalizePhone(rawPhone);
      const entry = d.loginCodes.find((c) => c.phone === phone);
      if (!entry || Date.parse(entry.expiresAt) <= now) return { ok: false as const, reason: "vencido" as const };
      if (entry.attempts >= 5) return { ok: false as const, reason: "intentos" as const };
      if (entry.code !== code.replace(/\D/g, "")) {
        entry.attempts++;
        return { ok: false as const, reason: "incorrecto" as const, left: 5 - entry.attempts };
      }
      d.loginCodes = d.loginCodes.filter((c) => c.phone !== phone);
      let customer = d.customers.find((c) => c.phone === phone);
      const isNew = !customer;
      if (!customer) {
        // A number that already booked is a known customer: reuse what we know.
        const last = [...d.bookings].reverse().find((b) => b.phone === phone);
        customer = { phone, name: last?.name ?? "", email: last?.email, createdAt: new Date(now).toISOString() };
        d.customers.push(customer);
      }
      customer.lastLoginAt = new Date(now).toISOString();
      logEvent(d, now, "sistema", "visitante", `${customer.name || `+${phone}`} entró a su cuenta.`);
      return { ok: true as const, customer: { ...customer }, isNew: isNew || !customer.name };
    });
  },

  async saveCustomer(input: { phone: string; name: string; email?: string }) {
    return commit((d, now) => {
      const phone = normalizePhone(input.phone);
      const existing = d.customers.find((c) => c.phone === phone);
      const record = { phone, name: input.name.trim(), email: input.email?.trim() || undefined };
      if (existing) Object.assign(existing, record);
      else d.customers.push({ ...record, createdAt: new Date(now).toISOString() });
      return d.customers.find((c) => c.phone === phone)!;
    });
  },

  /** Wilber types on his WhatsApp: the bot answers and applies any action. */
  async wilberSays(text: string) {
    return commit((d, now) => {
      pushMessage(d, now, { channel: "whatsapp", kind: "entrante", direction: "entrante", from: d.settings.wilberPhone, to: BUSINESS.whatsapp, body: text });
      const reply = handleAdminMessage(text, {
        tours: effectiveTours(d),
        departures: d.departures,
        bookings: d.bookings,
        holds: d.holds,
        guides: GUIDES,
        vehicles: VEHICLES,
        now,
      });
      applyBotActions(d, now, reply.actions);
      queueWa(d, now, d.settings.wilberPhone, "wilber_bot", { body: reply.text, buttons: reply.buttons });
      logEvent(d, now, "mensaje.recibido", "wilber", `Wilber escribió «${text}».`);
      return reply;
    });
  },

  /** A customer writes to the business number. */
  async customerSays(phone: string, text: string) {
    return commit((d, now) => {
      pushMessage(d, now, { channel: "whatsapp", kind: "entrante", direction: "entrante", from: phone, to: BUSINESS.whatsapp, body: text });
      const reply = handleCustomerMessage(text, phone, { tours: effectiveTours(d), departures: d.departures, bookings: d.bookings, holds: d.holds, now });
      queueWa(d, now, phone, "cliente_bot", { body: reply.text, buttons: reply.buttons });
      if (reply.forwardToWilber) {
        queueWa(d, now, d.settings.wilberPhone, "wilber_bot", { body: `*Mensaje de ${phone}*\n«${text}»`, buttons: ["Responder"] });
      }
      logEvent(d, now, "mensaje.recibido", "visitante", `Mensaje entrante de ${phone}.`);
      return reply;
    });
  },

  async updateSettings(patch: Partial<SimSettings>) {
    return commit((d, now) => {
      d.settings = { ...d.settings, ...patch };
      logEvent(d, now, "sistema", "sistema", `Ajustes de simulación: ${Object.keys(patch).join(", ")}.`);
    });
  },

  /** speed: 1 = real time, 60 = one minute per second, 3600 = one hour per second. */
  async setClock(patch: { speed?: number; paused?: boolean; jumpMs?: number; setTo?: number }) {
    return commit((d, now) => {
      const current = now;
      const target = patch.setTo ?? current + (patch.jumpMs ?? 0);
      d.clock = {
        anchorReal: Date.now(),
        anchorSim: target,
        speed: patch.speed ?? d.clock.speed,
        paused: patch.paused ?? d.clock.paused,
      };
      if (patch.jumpMs || patch.setTo) logEvent(d, target, "reloj.avanzado", "sistema", `Reloj movido a ${new Date(target).toLocaleString("es-SV", { timeZone: "America/El_Salvador" })}.`);
    });
  },

  async markMessages(ids: string[], status: Message["status"], real?: boolean) {
    return commit((d) => {
      for (const m of d.messages) {
        if (ids.includes(m.id)) {
          m.status = status;
          if (real !== undefined) m.real = real;
        }
      }
    });
  },

  /** Throws the whole world away and deals a new one (same seed = same world). */
  async reset(seed?: number) {
    boot();
    const run = () => {
      const base = read() ?? state;
      const fresh = createSeedState(seed ?? Math.floor(Math.random() * 1e9));
      fresh.rev = (base?.rev ?? 0) + 1;
      write(fresh);
      state = fresh;
      emit();
      channel?.postMessage({ rev: fresh.rev });
      return fresh;
    };
    if ("locks" in navigator && navigator.locks) return navigator.locks.request(LOCK, async () => run());
    return run();
  },

  /** Internal: lets automations/scenarios run a mutation under the same lock. */
  commit,
  logEvent,
  queueWa,
  queueEmail,
  bookInDraft,
  ctxFor,
};

export const internals = { newId, KEY, svISO, HOUR };
