import { renderEmail, type EmailKind } from "@/emails/render";
import { DAY, normalizePhone, svDateKey } from "@/lib/domain/format";
import type { Booking, Departure, Message } from "@/lib/domain/types";
import { sendEmail } from "@/lib/integrations/email";
import { integrations, wilberAdminPhone } from "@/lib/integrations/config";
import { sendWhatsApp } from "@/lib/integrations/kapso";
import { dueJobs, runJobs } from "@/lib/sim/engine";
import { createSeedState } from "@/lib/sim/seed";
import { DEFAULT_SETTINGS, EMPTY_STATS, MAX_EVENTS, MAX_MESSAGES, simNow, type SimState } from "@/lib/sim/state";
import { setCommitBackend, sim } from "@/lib/sim/store";
import { casShared, insertShared, loadShared, localOnly, type StoredState } from "./db";
import type { Viewer } from "./session";

// Shared mode, server side. The same `sim` actions the browser uses in the
// simulation run here against the state in Supabase: load, mutate a copy,
// compare-and-swap on `rev`, retry on conflict. Two people booking the last
// seat at once: one write wins, the other re-runs on the new state and is told
// the departure is full. Real WhatsApp (Kapso) and email (Gmail/Resend) go out
// from here, never from a browser.

// ---------------------------------------------------------------------------
// State

/** A clean world for real people: the season's departures, no bookings, real time. */
function sharedSeed(now = Date.now()): SimState {
  const s = createSeedState(Math.floor(Math.random() * 1e9), now);
  s.departures = s.departures.filter((d) => Date.parse(d.endsAt) > now);
  for (const d of s.departures) d.seatsTaken = 0;
  s.bookings = [];
  s.holds = [];
  s.messages = [];
  s.customers = [];
  s.loginCodes = [];
  s.knownContacts = [];
  s.fired = {};
  s.scenario = null;
  s.stats = { ...EMPTY_STATS };
  s.clock = { anchorReal: now, anchorSim: now, speed: 1, paused: false };
  s.settings = { ...DEFAULT_SETTINGS, trafficPerHour: 0, wilberPhone: wilberAdminPhone() || DEFAULT_SETTINGS.wilberPhone };
  s.events = [
    { id: `e-compartido-${now}`, at: new Date(now).toISOString(), type: "sistema", actor: "sistema", summary: `Modo compartido: ${s.departures.length} salidas, sin reservas.` },
  ];
  s.rev = 1;
  return s;
}

/** The shared state, created on first use; always on the real clock and Wilber's real phone. */
export async function currentShared(): Promise<StoredState> {
  let row = await loadShared();
  if (!row) {
    await insertShared(sharedSeed());
    row = await loadShared();
  }
  if (!row) throw new Error("No se pudo crear el estado compartido.");
  const s = row.state;
  s.customers ??= [];
  s.loginCodes ??= [];
  s.knownContacts ??= [];
  s.rev = row.rev;
  s.clock = { anchorReal: 0, anchorSim: 0, speed: 1, paused: false };
  const admin = wilberAdminPhone();
  if (admin) s.settings.wilberPhone = admin;
  s.settings.trafficPerHour = 0;
  return row;
}

async function serverCommit<R>(mutate: (draft: SimState, now: number) => R): Promise<R> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const row = await currentShared();
    const draft = structuredClone(row.state);
    const now = simNow(draft.clock);
    const result = mutate(draft, now);
    draft.rev = row.rev + 1;
    draft.events = draft.events.slice(0, MAX_EVENTS);
    draft.messages = draft.messages.slice(-MAX_MESSAGES);
    if (await casShared(row.rev, draft)) return result;
    await new Promise((r) => setTimeout(r, 30 + Math.random() * 80 * (attempt + 1)));
  }
  throw new HttpError(409, "Hay muchos cambios a la vez. Intentá de nuevo.");
}

setCommitBackend(serverCommit);

/** The browser's actions, run on the server. */
export const serverSim = sim;

// ---------------------------------------------------------------------------
// Actions from browsers

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Anyone may do these; each is checked against who is asking below. */
const PUBLIC = new Set(["hold", "releaseHold", "book", "cancelByVisitor", "requestLoginCode", "verifyLoginCode", "saveCustomer"]);
/** Wilber's panel (admin cookie). Simulation-only actions (clock, fills, reset) are not here. */
const ADMIN = new Set([
  ...PUBLIC,
  "settlePayment",
  "cancelBooking",
  "checkIn",
  "markNoShow",
  "createDeparture",
  "updateDeparture",
  "cancelDeparture",
  "weatherAlert",
  "applyFix",
  "assign",
  "setTourOverride",
  "wilberSays",
  "updateSettings",
]);

export interface ActionOutcome {
  result: unknown;
  /** Set when a visitor just proved their phone (WhatsApp code). */
  signedInPhone?: string;
  /** A booking code this browser may now see (the one it just made). */
  code?: string;
}

export async function runAction(name: string, args: unknown[], viewer: Viewer): Promise<ActionOutcome> {
  if (!(viewer.admin ? ADMIN : PUBLIC).has(name)) {
    if (!viewer.admin && ADMIN.has(name)) throw new HttpError(403, "Solo desde el panel de Wilber.");
    throw new HttpError(400, "Acción no disponible.");
  }
  const a = args as never[];
  switch (name) {
    case "book": {
      const [input] = args as [Parameters<typeof sim.book>[0], string?];
      const result = await sim.book(input, viewer.admin && args[1] === "wilber" ? "wilber" : "visitante");
      return { result, code: result.ok ? result.booking.code : undefined };
    }
    case "cancelByVisitor": {
      const [bookingId] = args as [string];
      const { state } = await currentShared();
      const b = state.bookings.find((x) => x.id === bookingId);
      if (!b || !(viewer.admin || b.phone === viewer.phone || viewer.codes.includes(b.code))) throw new HttpError(403, "Esa reserva no es tuya.");
      return { result: await sim.cancelByVisitor(bookingId) };
    }
    case "requestLoginCode": {
      const phone = normalizePhone(String(args[0] ?? ""));
      if (!/^\d{8,15}$/.test(phone)) throw new HttpError(400, "Número inválido.");
      const { state } = await currentShared();
      const last = state.loginCodes.find((c) => c.phone === phone);
      // One code every 30 seconds per number: each one is a real WhatsApp.
      if (last && Date.parse(last.expiresAt) - 10 * 60_000 > Date.now() - 30_000) throw new HttpError(429, "Esperá unos segundos para pedir otro código.");
      const r = await sim.requestLoginCode(phone);
      return { result: { phone: r.phone, expiresAt: r.expiresAt } };
    }
    case "verifyLoginCode": {
      const r = await sim.verifyLoginCode(String(args[0] ?? ""), String(args[1] ?? ""));
      return { result: r, signedInPhone: r.ok ? r.customer.phone : undefined };
    }
    case "saveCustomer": {
      const [input] = args as [{ phone: string; name: string; email?: string }];
      if (!viewer.admin && normalizePhone(input?.phone ?? "") !== viewer.phone) throw new HttpError(403, "Entrá con tu número para cambiar tus datos.");
      return { result: await sim.saveCustomer(input) };
    }
    default: {
      const fn = (sim as unknown as Record<string, (...x: never[]) => Promise<unknown>>)[name];
      if (typeof fn !== "function") throw new HttpError(400, "Acción no disponible.");
      return { result: await fn(...a) };
    }
  }
}

// ---------------------------------------------------------------------------
// Real messages

/** Who really receives a queued message, or null to leave it simulated. */
function realTarget(m: Message, s: SimState): string | null {
  // MESSAGES_DRY_RUN=1 (previews, rehearsals): everything stays simulated.
  if (m.direction !== "saliente" || localOnly() || process.env.MESSAGES_DRY_RUN === "1") return null;
  if (m.channel === "whatsapp") {
    if (!integrations.kapso) return null;
    if (m.to === s.settings.wilberPhone) return wilberAdminPhone() || null;
    // Only numbers a person typed (booking, login) or that wrote to the business.
    return s.knownContacts.includes(m.to) ? m.to : null;
  }
  if (!integrations.email) return null;
  if (m.kind === "wilber_resumen") return process.env.ADMIN_EMAIL?.trim().toLowerCase() || null;
  const to = m.to.trim().toLowerCase();
  return s.knownContacts.includes(to) ? to : null;
}

const EMAIL_KINDS: EmailKind[] = ["confirmacion", "recordatorio_24h", "wilber_resumen", "pago", "cambio_salida", "cancelacion"];

interface Outgoing {
  message: Message;
  to: string;
  booking?: Booking;
  departure?: Departure;
  digest?: { departure: Departure; bookings: Booking[] }[];
}

let dispatching: Promise<number> | null = null;

/** Sends every queued message that has a real recipient; the rest are marked simulated. */
export function dispatchQueued(siteUrl: string): Promise<number> {
  dispatching ??= dispatchOnce(siteUrl).finally(() => {
    dispatching = null;
  });
  return dispatching;
}

async function dispatchOnce(siteUrl: string): Promise<number> {
  const now = Date.now();
  // A message claimed by a request that died stays "enviando": retry it after 3 minutes.
  const ready = (m: Message) => m.status === "en_cola" || (m.status === "enviando" && now - Date.parse(m.createdAt) > 3 * 60_000);
  const { state } = await currentShared();
  if (!state.messages.some(ready)) return 0;

  const claimed = await serverCommit((d) => {
    const out: Outgoing[] = [];
    for (const m of d.messages) {
      if (!ready(m)) continue;
      const to = realTarget(m, d);
      if (!to || (m.channel === "email" && !EMAIL_KINDS.includes(m.kind as EmailKind))) {
        m.status = "simulado";
        m.real = false;
        continue;
      }
      m.status = "enviando";
      const booking = m.bookingId ? d.bookings.find((b) => b.id === m.bookingId) : undefined;
      const departure = booking ? d.departures.find((x) => x.id === booking.departureId) : m.departureId ? d.departures.find((x) => x.id === m.departureId) : undefined;
      let digest: Outgoing["digest"];
      if (m.kind === "wilber_resumen") {
        const tomorrow = svDateKey(Date.parse(m.createdAt) + DAY);
        digest = d.departures
          .filter((x) => svDateKey(x.startsAt) === tomorrow && x.status !== "cancelada")
          .map((x) => ({ departure: x, bookings: d.bookings.filter((b) => b.departureId === x.id && b.status !== "cancelada") }));
      }
      out.push(structuredClone({ message: m, to, booking, departure, digest }));
    }
    return out;
  });
  if (!claimed.length) return 0;

  const results = await Promise.all(
    claimed.map(async (o) => {
      try {
        if (o.message.channel === "whatsapp") {
          const r = await sendWhatsApp({ to: o.to, body: o.message.body, buttons: o.message.buttons, location: o.message.location });
          if (!r.ok) console.warn("kapso:", o.message.kind, r.status, r.error);
          return { id: o.message.id, ok: r.ok };
        }
        const mail = await renderEmail(o.message.kind as EmailKind, { booking: o.booking, departure: o.departure, digest: o.digest, siteUrl });
        const r = await sendEmail({ to: o.to, subject: mail.subject, html: mail.html, text: mail.text });
        if (!r.ok) console.warn("email:", o.message.kind, r.error);
        return { id: o.message.id, ok: r.ok };
      } catch (e) {
        console.warn("dispatch:", o.message.kind, (e as Error).message);
        return { id: o.message.id, ok: false };
      }
    }),
  );

  await serverCommit((d) => {
    for (const r of results) {
      const m = d.messages.find((x) => x.id === r.id);
      if (!m) continue;
      m.status = r.ok ? "enviado" : "fallido";
      m.real = r.ok;
    }
  });
  return results.filter((r) => r.ok).length;
}

// ---------------------------------------------------------------------------
// Automations

/** Reminders, day-of locations, reviews, Wilber's 6 p.m. digest and cross alerts, then delivery. */
export async function tickShared(siteUrl: string) {
  const { state } = await currentShared();
  const jobs = dueJobs(state, Date.now());
  if (jobs.length) await runJobs(jobs, { simulateAttendance: false });
  const sent = await dispatchQueued(siteUrl);
  return { jobs: jobs.length, sent };
}
