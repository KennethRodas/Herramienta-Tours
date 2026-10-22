"use client";

import type { Booking, BookingInput, Message } from "@/lib/domain/types";
import { GUIDES, VEHICLES, meetingPointById } from "@/content/catalog";
import { detectConflicts } from "@/lib/domain/conflicts";
import { seatsLeft } from "@/lib/domain/availability";
import { DAY, HOUR, svDateKey, svParts } from "@/lib/domain/format";
import { simForecast } from "@/lib/domain/weather";
import * as wa from "@/lib/whatsapp/templates";
import { handleAdminMessage } from "@/lib/whatsapp/admin-bot";
import { fakePerson, weighted } from "./rng";
import { effectiveTours, getState, sim } from "./store";
import { simNow, type SimState } from "./state";

// The engine runs in exactly one tab (Web Locks leader election): it fires
// scheduled WhatsApp/email automations, moves departures through their life,
// generates simulated traffic and dispatches queued messages.

const TICK_MS = 1000;
let started = false;
let leader = false;
let trafficAcc = 0;
let lastTick = 0;
const inFlight = new Set<string>();

type Job =
  | { kind: "r24"; bookingId: string }
  | { kind: "rday"; bookingId: string }
  | { kind: "review"; bookingId: string }
  | { kind: "digest"; dateKey: string }
  | { kind: "conflict"; id: string }
  | { kind: "finish"; departureId: string }
  | { kind: "abandon"; bookingId: string }
  | { kind: "holds" };

const live = (b: Booking) => b.status !== "cancelada" && b.status !== "no_show";

function dueJobs(s: SimState, now: number): Job[] {
  const jobs: Job[] = [];
  if (s.holds.some((h) => Date.parse(h.expiresAt) <= now)) jobs.push({ kind: "holds" });
  for (const d of s.departures) {
    if ((d.status === "abierta" || d.status === "cerrada") && Date.parse(d.endsAt) < now) jobs.push({ kind: "finish", departureId: d.id });
  }
  if (!s.settings.autoMessages) return jobs;
  for (const b of s.bookings) {
    if (!live(b)) continue;
    const dep = s.departures.find((d) => d.id === b.departureId);
    if (!dep || dep.status === "cancelada") continue;
    const start = Date.parse(dep.startsAt);
    // Only automate around "now": never replay months of history at boot.
    if (start - 24 * HOUR <= now && now < start - 3 * HOUR && !s.fired[`r24:${b.id}`]) jobs.push({ kind: "r24", bookingId: b.id });
    if (start - 2 * HOUR <= now && now < start && !s.fired[`rday:${b.id}`]) jobs.push({ kind: "rday", bookingId: b.id });
    const end = Date.parse(dep.endsAt);
    if (b.status === "check_in" && end + 3 * HOUR <= now && now < end + 2 * DAY && !s.fired[`review:${b.id}`]) {
      jobs.push({ kind: "review", bookingId: b.id });
    }
    if (b.status === "pendiente_pago" && now - Date.parse(b.createdAt) > 30 * 60_000) jobs.push({ kind: "abandon", bookingId: b.id });
  }
  const p = svParts(now);
  const dk = svDateKey(now);
  if (p.hour >= 18 && !s.fired[`digest:${dk}`]) jobs.push({ kind: "digest", dateKey: dk });
  const conflicts = detectConflicts({ departures: s.departures, tours: effectiveTours(s), guides: GUIDES, vehicles: VEHICLES, now, horizonMs: 7 * DAY });
  // WhatsApp alerts only for real crosses (double-booked guide or vehicle, unsafe or too small);
  // missing assignments stay on the dashboard.
  for (const c of conflicts) if (c.severity === "alta" && !s.fired[`conflict:${c.id}`]) jobs.push({ kind: "conflict", id: c.id });
  return jobs;
}

async function runJobs(jobs: Job[]) {
  await sim.commit((d, now) => {
    const tours = effectiveTours(d);
    for (const job of jobs) {
      // Jobs were planned on a snapshot: skip any another tab already fired.
      const key =
        job.kind === "r24" || job.kind === "rday" || job.kind === "review"
          ? `${job.kind}:${job.bookingId}`
          : job.kind === "digest"
            ? `digest:${job.dateKey}`
            : job.kind === "conflict"
              ? `conflict:${job.id}`
              : null;
      if (key && d.fired[key]) continue;
      if (job.kind === "holds") d.holds = d.holds.filter((h) => Date.parse(h.expiresAt) > now);
      if (job.kind === "finish") {
        const dep = d.departures.find((x) => x.id === job.departureId);
        if (!dep || dep.status === "realizada" || dep.status === "cancelada") continue;
        dep.status = "realizada";
        for (const b of d.bookings.filter((x) => x.departureId === dep.id && (x.status === "confirmada" || x.status === "pagada"))) {
          // Wilber took attendance on the trail; the simulation fills it in.
          if (Math.random() < 0.92) {
            b.status = "check_in";
            b.checkedIn = b.partySize;
          } else b.status = "no_show";
        }
        sim.logEvent(d, now, "salida.actualizada", "sistema", `${sim.ctxFor(d, dep).ref} terminó: ${dep.seatsTaken} personas.`);
      }
      const booking = "bookingId" in job ? d.bookings.find((x) => x.id === job.bookingId) : undefined;
      const dep = booking ? d.departures.find((x) => x.id === booking.departureId) : undefined;
      const tour = dep ? tours.find((t) => t.id === dep.tourId) : undefined;
      const mp = dep ? meetingPointById(dep.meetingPointId) : undefined;
      if (job.kind === "r24" && booking && dep && tour && mp) {
        d.fired[`r24:${booking.id}`] = now;
        const weather = simForecast(tour, dep.startsAt).summary;
        sim.queueWa(d, now, booking.phone, "recordatorio_24h", wa.reminder24h(booking, dep, tour, mp, weather), { bookingId: booking.id, departureId: dep.id });
        if (booking.email) sim.queueEmail(d, now, booking.email, "recordatorio_24h", `Mañana: ${tour.name} · qué llevar`, { bookingId: booking.id, departureId: dep.id });
      }
      if (job.kind === "rday" && booking && dep && tour && mp) {
        d.fired[`rday:${booking.id}`] = now;
        sim.queueWa(d, now, booking.phone, "recordatorio_salida", wa.reminderDayOf(booking, dep, tour, mp), { bookingId: booking.id, departureId: dep.id });
      }
      if (job.kind === "review" && booking && tour) {
        d.fired[`review:${booking.id}`] = now;
        sim.queueWa(d, now, booking.phone, "resena", wa.reviewRequest(booking, tour), { bookingId: booking.id });
      }
      if (job.kind === "abandon" && booking && dep && booking.status === "pendiente_pago") {
        booking.status = "confirmada";
        booking.payment = { method: "en_sitio", status: "no_aplica", amountUsd: 0 };
        sim.logEvent(d, now, "pago.rechazado", "sistema", `${booking.code} no completó el anticipo: queda con pago el día de la salida.`);
        sim.queueWa(d, now, booking.phone, "confirmacion", wa.bookingConfirmation(booking, dep, tour!, mp!), { bookingId: booking.id, departureId: dep.id });
        booking.confirmation = "enviada";
      }
      if (job.kind === "digest") {
        d.fired[`digest:${job.dateKey}`] = now;
        const reply = handleAdminMessage("mañana", { tours, departures: d.departures, bookings: d.bookings, holds: d.holds, guides: GUIDES, vehicles: VEHICLES, now });
        sim.queueWa(d, now, d.settings.wilberPhone, "wilber_resumen", { body: `*Resumen de las 6 p. m.*\n${reply.text}`, buttons: reply.buttons });
        sim.queueEmail(d, now, "wilber@correo.sv", "wilber_resumen", `Mañana: resumen de salidas`);
      }
      if (job.kind === "conflict") {
        d.fired[`conflict:${job.id}`] = now;
        const c = detectConflicts({ departures: d.departures, tours, guides: GUIDES, vehicles: VEHICLES, now, horizonMs: 7 * DAY }).find((x) => x.id === job.id);
        if (c) {
          sim.queueWa(d, now, d.settings.wilberPhone, "wilber_cruce", wa.wilberConflict(c));
          sim.logEvent(d, now, "cruce.detectado", "sistema", c.title, { conflictId: c.id });
        }
      }
    }
  });
}

const PARTY: [number, number][] = [[1, 12], [2, 30], [3, 18], [4, 22], [5, 9], [6, 6]];

/** One simulated visitor tries to book something in the next three weeks. */
export async function simulatedVisitor() {
  const s = getState();
  if (!s) return null;
  const now = simNow(s.clock);
  const tours = effectiveTours(s).filter((t) => t.active);
  const open = s.departures.filter(
    (d) => d.status === "abierta" && Date.parse(d.startsAt) > now + 3 * HOUR && Date.parse(d.startsAt) < now + 21 * DAY && tours.some((t) => t.id === d.tourId),
  );
  if (!open.length) return null;
  // Popular tours and close dates attract more people.
  const dep = weighted(
    Math.random,
    open.map((d) => [d, 1 + (d.tourId === "t-santa-ana" ? 2 : 0) + Math.max(0, 10 - (Date.parse(d.startsAt) - now) / DAY) * 0.3] as [typeof d, number]),
  );
  const person = fakePerson(Math.random);
  const input: BookingInput = {
    departureId: dep.id,
    name: person.name,
    phone: person.phone,
    email: person.email,
    partySize: weighted(Math.random, PARTY),
    paymentMethod: s.settings.onlineDeposit && Math.random() < 0.25 ? "wompi" : "en_sitio",
    source: "simulacion",
  };
  const result = await sim.book(input, "bot");
  if (result.ok && input.paymentMethod === "wompi") {
    setTimeout(() => void sim.settlePayment(result.booking.id, Math.random() < 0.85 ? "aprobar" : "rechazar"), 1500);
  }
  return result;
}

/** Fires `count` visitors at the same departure at the same instant. */
export async function rush(departureId: string, count: number) {
  const attempts = Array.from({ length: count }, () => {
    const person = fakePerson(Math.random);
    return sim.book(
      {
        departureId,
        name: person.name,
        phone: person.phone,
        partySize: weighted(Math.random, [[1, 3], [2, 4], [3, 2], [4, 1]] as [number, number][]),
        paymentMethod: "en_sitio",
        source: "simulacion",
      },
      "bot",
    );
  });
  const results = await Promise.all(attempts);
  return {
    ok: results.filter((r) => r.ok).length,
    rejected: results.filter((r) => !r.ok).length,
    results,
  };
}

async function dispatch(s: SimState) {
  const queued = s.messages.filter((m) => m.status === "en_cola" && !inFlight.has(m.id));
  if (!queued.length) return;
  const simulated: string[] = [];
  const testPhone = s.settings.testPhone.replace(/\D/g, "");
  const testEmail = s.settings.testEmail.trim().toLowerCase();
  for (const m of queued) {
    // Only what is addressed to the tester (a booking made with their number)
    // or to Wilber goes out for real; simulated customers never flood the phone.
    const wantsReal =
      (m.channel === "whatsapp" && s.settings.realWhatsApp && testPhone && (m.to === testPhone || m.to === s.settings.wilberPhone)) ||
      (m.channel === "email" && s.settings.realEmail && testEmail && (m.to.toLowerCase() === testEmail || m.kind === "wilber_resumen"));
    if (!wantsReal) {
      simulated.push(m.id);
      continue;
    }
    inFlight.add(m.id);
    void sendReal(m, s).finally(() => inFlight.delete(m.id));
  }
  if (simulated.length) await sim.markMessages(simulated, "simulado", false);
}

async function sendReal(m: Message, s: SimState) {
  try {
    const booking = s.bookings.find((b) => b.id === m.bookingId);
    const departure = booking ? s.departures.find((d) => d.id === booking.departureId) : undefined;
    const res =
      m.channel === "whatsapp"
        ? await fetch("/api/whatsapp/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: s.settings.testPhone,
              // Wilber's own messages go to the tester as-is; customers' get a "para +503…" prefix.
              originalTo: m.kind.startsWith("wilber_") ? undefined : m.to,
              body: m.body,
              buttons: m.buttons,
              location: m.location,
            }),
          })
        : await fetch("/api/email/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ to: s.settings.testEmail, originalTo: m.to, kind: m.kind, subject: m.body, booking, departure }),
          });
    await sim.markMessages([m.id], res.ok ? "enviado" : "fallido", res.ok);
  } catch {
    await sim.markMessages([m.id], "fallido", false);
  }
}

async function tick() {
  const s = getState();
  if (!s) return;
  const now = simNow(s.clock);
  const jobs = dueJobs(s, now);
  if (jobs.length) await runJobs(jobs);

  const rate = s.settings.trafficPerHour;
  if (rate > 0 && !s.clock.paused) {
    const dt = lastTick ? now - lastTick : 0;
    trafficAcc += (rate * Math.max(0, dt)) / HOUR;
    let guard = 0;
    while (trafficAcc >= 1 && guard++ < 5) {
      trafficAcc -= 1;
      await simulatedVisitor();
    }
    if (trafficAcc > 5) trafficAcc = 0;
  }
  lastTick = now;
  const fresh = getState();
  if (fresh) await dispatch(fresh);
}

const LEADER_LOCK = "wilber-sim-leader";

/**
 * Leader election with Web Locks. The visible tab steals leadership, so the
 * engine never runs in a throttled background tab; a tab that loses it queues
 * up again and takes over if the leader closes.
 */
function acquireLeadership(steal: boolean) {
  navigator.locks
    .request(LEADER_LOCK, { steal }, () => {
      leader = true;
      return new Promise<void>(() => undefined);
    })
    .catch(() => {
      leader = false;
      acquireLeadership(false);
    });
}

/** Starts the engine once per tab; only the elected leader actually runs. */
export function startEngine() {
  if (started || typeof window === "undefined") return;
  started = true;
  const loop = () => {
    if (leader) void tick().catch(() => undefined);
  };
  const interval = window.setInterval(loop, TICK_MS);
  if ("locks" in navigator && navigator.locks) {
    acquireLeadership(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && !leader) acquireLeadership(true);
    });
  } else {
    leader = true;
  }
  window.addEventListener("pagehide", () => window.clearInterval(interval));
}

export function isEngineLeader() {
  return leader;
}

export function seatsLeftNow(departureId: string) {
  const s = getState();
  if (!s) return null;
  const dep = s.departures.find((d) => d.id === departureId);
  return dep ? seatsLeft(dep, s.holds, simNow(s.clock)) : null;
}
