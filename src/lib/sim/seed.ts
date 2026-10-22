import type { Booking, Departure, Tour } from "@/lib/domain/types";
import { GUIDES, TOURS, VEHICLES } from "@/content/catalog";
import { makeBookingCode } from "@/lib/domain/availability";
import { needsTransport, overlaps } from "@/lib/domain/conflicts";
import { addDays, DAY, HOUR, svDateKey, svISO, svParts } from "@/lib/domain/format";
import { between, fakePerson, mulberry32, pick, weighted, type Rng } from "./rng";
import { DEFAULT_SETTINGS, EMPTY_STATS, type SimState } from "./state";

const PAST_DAYS = 28;
const FUTURE_DAYS = 45;

/** Montecristo closes to visitors during the rainy season (May–October). */
function runsInMonth(tour: Tour, month: number) {
  if (tour.id === "t-montecristo") return month >= 11 || month <= 4;
  return true;
}

const PARTY: [number, number][] = [
  [1, 14], [2, 30], [3, 18], [4, 20], [5, 8], [6, 6], [8, 3],
];

const NOTES = [
  "Si llueve la víspera, te escribo antes de las 6 p. m. para confirmar.",
  "Llevamos bastones extra para quien los necesite.",
  "Desayuno incluido; avisá si sos vegetariano.",
];

function occupancyTarget(rng: Rng, daysAhead: number, weekday: number) {
  const weekend = weekday === 0 || weekday === 6;
  let base: number;
  if (daysAhead < 0) base = 0.65 + rng() * 0.35;
  else if (daysAhead <= 3) base = 0.5 + rng() * 0.5;
  else if (daysAhead <= 10) base = 0.25 + rng() * 0.55;
  else if (daysAhead <= 21) base = rng() * 0.45;
  else base = rng() * 0.2;
  return Math.min(1, base + (weekend ? 0.12 : -0.08));
}

export function makeDeparture(tour: Tour, dateKey: string, createdAt: string, overrides: Partial<Departure> = {}): Departure {
  const startsAt = svISO(dateKey, tour.departureTime);
  const endsAt = new Date(Date.parse(startsAt) + tour.durationHours * HOUR).toISOString();
  return {
    id: `d-${tour.code.toLowerCase()}-${dateKey}`,
    tourId: tour.id,
    startsAt,
    endsAt,
    capacity: tour.capacity,
    seatsTaken: 0,
    priceUsd: tour.priceUsd,
    status: "abierta",
    guideId: null,
    vehicleId: null,
    meetingPointId: tour.meetingPointId,
    prepReady: true,
    createdAt,
    ...overrides,
  };
}

/** Greedy assignment of guides and vehicles that respects overlaps. */
function assignResources(deps: Departure[], rng: Rng) {
  const sorted = [...deps].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  for (const d of sorted) {
    const tour = TOURS.find((t) => t.id === d.tourId)!;
    const hard = tour.difficulty === "exigente" || tour.difficulty === "extrema";
    const guides = [...GUIDES].sort(() => rng() - 0.5).filter((g) => !hard || g.senior);
    d.guideId = guides.find((g) => !sorted.some((o) => o !== d && o.guideId === g.id && overlaps(o, d)))?.id ?? null;
    if (!needsTransport(tour)) {
      d.vehicleId = null;
      continue;
    }
    const vehicles = VEHICLES.filter((v) => v.seats >= Math.min(d.capacity, 14)).sort((a, b) => a.seats - b.seats);
    d.vehicleId = vehicles.find((v) => !sorted.some((o) => o !== d && o.vehicleId === v.id && overlaps(o, d)))?.id ?? null;
  }
}

export function createSeedState(seed: number, realNow = Date.now()): SimState {
  const rng = mulberry32(seed);
  const today = svDateKey(realNow);
  const createdAt = new Date(realNow - (PAST_DAYS + 7) * DAY).toISOString();
  const departures: Departure[] = [];

  for (let offset = -PAST_DAYS; offset <= FUTURE_DAYS; offset++) {
    const dateKey = addDays(today, offset);
    const parts = svParts(Date.parse(svISO(dateKey, "12:00")));
    // Three guides: at most three departures on a weekend day, one or two on weekdays.
    const weekend = parts.weekday === 0 || parts.weekday === 6;
    const candidates = TOURS.filter((t) => t.active && t.weekdays.includes(parts.weekday) && runsInMonth(t, parts.month));
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    // Santa Ana is the classic: it leaves every weekend.
    candidates.sort((a, b) => Number(b.id === "t-santa-ana") - Number(a.id === "t-santa-ana"));
    const max = weekend ? 3 : rng() < 0.55 ? 1 : 2;
    for (const tour of candidates.slice(0, max)) {
      const dep = makeDeparture(tour, dateKey, createdAt, {
        prepReady: offset < 18 || rng() < 0.4,
        notes: rng() < 0.3 ? pick(rng, NOTES) : undefined,
      });
      departures.push(dep);
    }
  }

  assignResources(departures, rng);

  // Plant the season's problems so the dashboard has something real to catch:
  // the next Saturday sends Santa Ana and Izalco with the same guide and microbus.
  const nextSat = departures
    .filter((d) => Date.parse(d.startsAt) > realNow + 20 * HOUR && svParts(d.startsAt).weekday === 6)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const sa = nextSat.find((d) => d.tourId === "t-santa-ana");
  let iz = nextSat.find((d) => d.tourId === "t-izalco" && sa && svDateKey(d.startsAt) === svDateKey(sa.startsAt));
  if (sa && !iz) {
    iz = makeDeparture(TOURS.find((t) => t.id === "t-izalco")!, svDateKey(sa.startsAt), createdAt);
    departures.push(iz);
  }
  if (sa && iz) {
    sa.guideId = "wilber";
    iz.guideId = "wilber";
    sa.vehicleId = "la-chula";
    iz.vehicleId = "la-chula";
  }
  // A weekday departure two days out without a guide.
  const unguided = departures.find(
    (d) => Date.parse(d.startsAt) > realNow + 30 * HOUR && Date.parse(d.startsAt) < realNow + 72 * HOUR && d !== sa && d !== iz,
  );
  if (unguided) unguided.guideId = null;

  const bookings: Booking[] = [];
  const codes = new Set<string>();
  for (const d of departures) {
    const tour = TOURS.find((t) => t.id === d.tourId)!;
    const startMs = Date.parse(d.startsAt);
    const daysAhead = Math.floor((startMs - realNow) / DAY);
    const target = Math.round(d.capacity * occupancyTarget(rng, daysAhead, svParts(d.startsAt).weekday));
    let guard = 0;
    while (d.seatsTaken < target && guard++ < 40) {
      const left = d.capacity - d.seatsTaken;
      const size = Math.min(weighted(rng, PARTY), left);
      if (size <= 0) break;
      const person = fakePerson(rng);
      const created = Math.min(realNow - 5 * 60_000, startMs - between(rng, 3, 20 * 24) * HOUR);
      const past = startMs < realNow;
      const online = rng() < 0.28;
      const code = makeBookingCode(rng, codes);
      codes.add(code);
      const status: Booking["status"] = past ? (rng() < 0.93 ? "check_in" : "no_show") : online && rng() < 0.2 ? "pendiente_pago" : online ? "pagada" : "confirmada";
      bookings.push({
        id: `b-${code.slice(4).toLowerCase()}-${d.id.slice(2, 6)}`,
        code,
        departureId: d.id,
        tourId: tour.id,
        name: person.name,
        phone: person.phone,
        email: person.email,
        partySize: size,
        status,
        payment: {
          method: online ? "wompi" : "en_sitio",
          status: online ? (status === "pendiente_pago" ? "pendiente" : "aprobado") : "no_aplica",
          amountUsd: online ? tour.depositUsd * size : 0,
          reference: online ? `SIM-${between(rng, 100000, 999999)}` : undefined,
        },
        source: rng() < 0.7 ? "web" : rng() < 0.6 ? "whatsapp" : "manual",
        checkedIn: status === "check_in" ? size : 0,
        createdAt: new Date(created).toISOString(),
        confirmation: "enviada",
      });
      d.seatsTaken += size;
    }
    if (Date.parse(d.endsAt) < realNow) d.status = "realizada";
  }

  // Guarantee the states the PRD talks about exist in the next week:
  // one sold-out departure and one with its last seats.
  const soon = departures
    .filter((d) => d.status === "abierta" && Date.parse(d.startsAt) > realNow + 26 * HOUR && Date.parse(d.startsAt) < realNow + 8 * DAY)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const fillTo = (d: Departure, leave: number) => {
    const tour = TOURS.find((t) => t.id === d.tourId)!;
    while (d.capacity - d.seatsTaken > leave) {
      const size = Math.min(between(rng, 1, 4), d.capacity - d.seatsTaken - leave);
      const person = fakePerson(rng);
      const code = makeBookingCode(rng, codes);
      codes.add(code);
      bookings.push({
        id: `b-${code.slice(4).toLowerCase()}-${d.id.slice(2, 6)}`,
        code,
        departureId: d.id,
        tourId: tour.id,
        name: person.name,
        phone: person.phone,
        email: person.email,
        partySize: size,
        status: "confirmada",
        payment: { method: "en_sitio", status: "no_aplica", amountUsd: 0 },
        source: "web",
        checkedIn: 0,
        createdAt: new Date(realNow - between(rng, 2, 120) * HOUR).toISOString(),
        confirmation: "enviada",
      });
      d.seatsTaken += size;
    }
  };
  if (soon[1]) fillTo(soon[1], 0);
  if (soon[3]) fillTo(soon[3], 2);

  return {
    version: 2,
    seed,
    rev: 1,
    createdAt: realNow,
    departures,
    bookings,
    holds: [],
    messages: [],
    events: [
      {
        id: `e-seed-${seed}`,
        at: new Date(realNow).toISOString(),
        type: "sistema",
        actor: "sistema",
        summary: `Simulación lista: ${departures.length} salidas y ${bookings.length} reservas de ejemplo (semilla ${seed}).`,
      },
    ],
    tourOverrides: {},
    clock: { anchorReal: realNow, anchorSim: realNow, speed: 1, paused: false },
    settings: { ...DEFAULT_SETTINGS },
    stats: { ...EMPTY_STATS },
    fired: {},
    scenario: null,
    customers: [],
    loginCodes: [],
    knownContacts: [],
  };
}
