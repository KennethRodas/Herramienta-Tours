import type { Conflict, Departure, Guide, Tour, Vehicle } from "./types";
import { formatDayShort, formatTime, HOUR } from "./format";

// "Cruces": the problem this product exists for. In high season two groups were
// sent with the same guide and microbus, and fixing it on the spot cost $120.
export const CROSS_COST = { guide: 60, vehicle: 120 } as const;

/** Tours that meet on location (Juayúa, Suchitoto, El Tunco) do not use the microbus. */
export function needsTransport(tour: Pick<Tour, "includes">) {
  return tour.includes.some((i) => /^transporte/i.test(i));
}

/** Transfer time added on both ends: a microbus is not free the minute a hike ends. */
const BUFFER_MS = 1.5 * HOUR;

interface Ctx {
  departures: Departure[];
  tours: Tour[];
  guides: Guide[];
  vehicles: Vehicle[];
  now: number;
  /** Departures further away than this are ignored (default 21 days). */
  horizonMs?: number;
}

const live = (d: Departure, now: number, horizon: number) =>
  d.status !== "cancelada" &&
  d.status !== "realizada" &&
  Date.parse(d.endsAt) > now &&
  Date.parse(d.startsAt) < now + horizon;

const window = (d: Departure) => [Date.parse(d.startsAt) - BUFFER_MS, Date.parse(d.endsAt) + BUFFER_MS] as const;

export function overlaps(a: Departure, b: Departure) {
  const [as, ae] = window(a);
  const [bs, be] = window(b);
  return as < be && bs < ae;
}

function label(d: Departure, tours: Tour[]) {
  const t = tours.find((x) => x.id === d.tourId);
  return `${t?.shortName ?? "Salida"} ${formatDayShort(d.startsAt)} ${formatTime(d.startsAt)}`;
}

function freeGuide(dep: Departure, ctx: Ctx, needSenior: boolean, active: Departure[]) {
  return ctx.guides.find(
    (g) =>
      (!needSenior || g.senior) &&
      g.id !== dep.guideId &&
      !active.some((o) => o.id !== dep.id && o.guideId === g.id && overlaps(o, dep)),
  );
}

function freeVehicle(dep: Departure, ctx: Ctx, minSeats: number, active: Departure[]) {
  return ctx.vehicles
    .filter((v) => v.seats >= minSeats && v.id !== dep.vehicleId)
    .sort((a, b) => a.seats - b.seats)
    .find((v) => !active.some((o) => o.id !== dep.id && o.vehicleId === v.id && overlaps(o, dep)));
}

export function detectConflicts(ctx: Ctx): Conflict[] {
  const horizon = ctx.horizonMs ?? 21 * 24 * HOUR;
  const active = ctx.departures
    .filter((d) => live(d, ctx.now, horizon))
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const out: Conflict[] = [];

  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i];
      const b = active[j];
      if (!overlaps(a, b)) continue;
      if (a.guideId && a.guideId === b.guideId) {
        const guide = ctx.guides.find((g) => g.id === a.guideId);
        const tourB = ctx.tours.find((t) => t.id === b.tourId);
        const alt = freeGuide(b, ctx, tourB ? tourB.difficulty === "exigente" || tourB.difficulty === "extrema" : false, active);
        out.push({
          id: `guia:${a.id}:${b.id}`,
          kind: "guia_doble",
          severity: "alta",
          departureIds: [a.id, b.id],
          resourceId: a.guideId,
          title: `${guide?.name ?? "Un guía"} está en dos salidas a la vez`,
          detail: `${label(a, ctx.tours)} y ${label(b, ctx.tours)} se cruzan, contando el traslado.`,
          costRiskUsd: CROSS_COST.guide,
          fix: alt ? { label: `Pasar ${tourB?.shortName ?? "la segunda"} a ${alt.name}`, departureId: b.id, guideId: alt.id } : undefined,
        });
      }
      if (a.vehicleId && a.vehicleId === b.vehicleId) {
        const v = ctx.vehicles.find((x) => x.id === a.vehicleId);
        const alt = freeVehicle(b, ctx, Math.max(b.seatsTaken, 1), active);
        const tourB = ctx.tours.find((t) => t.id === b.tourId);
        out.push({
          id: `vehiculo:${a.id}:${b.id}`,
          kind: "vehiculo_doble",
          severity: "alta",
          departureIds: [a.id, b.id],
          resourceId: a.vehicleId,
          title: `${v?.name ?? "Un vehículo"} tiene dos viajes encimados`,
          detail: `${label(a, ctx.tours)} y ${label(b, ctx.tours)} necesitan el mismo vehículo.`,
          costRiskUsd: CROSS_COST.vehicle,
          fix: alt ? { label: `Mandar ${tourB?.shortName ?? "la segunda"} en ${alt.name}`, departureId: b.id, vehicleId: alt.id } : undefined,
        });
      }
    }
  }

  for (const d of active) {
    const tour = ctx.tours.find((t) => t.id === d.tourId);
    const soon = Date.parse(d.startsAt) - ctx.now < 72 * HOUR;
    const vehicle = ctx.vehicles.find((v) => v.id === d.vehicleId);
    if (vehicle && d.seatsTaken > vehicle.seats) {
      const alt = freeVehicle(d, ctx, d.seatsTaken, active);
      out.push({
        id: `pequeno:${d.id}`,
        kind: "vehiculo_pequeno",
        severity: "alta",
        departureIds: [d.id],
        resourceId: vehicle.id,
        title: `${d.seatsTaken} personas no caben en ${vehicle.name}`,
        detail: `${label(d, ctx.tours)}: el vehículo tiene ${vehicle.seats} asientos.`,
        costRiskUsd: CROSS_COST.vehicle,
        fix: alt ? { label: `Cambiar a ${alt.name}`, departureId: d.id, vehicleId: alt.id } : undefined,
      });
    }
    if (soon && d.seatsTaken > 0 && !d.guideId) {
      const alt = freeGuide(d, ctx, tour ? tour.difficulty === "exigente" || tour.difficulty === "extrema" : false, active);
      out.push({
        id: `singuia:${d.id}`,
        kind: "sin_guia",
        severity: "media",
        departureIds: [d.id],
        title: `${label(d, ctx.tours)} no tiene guía`,
        detail: `Sale en menos de tres días con ${d.seatsTaken} personas.`,
        costRiskUsd: CROSS_COST.guide,
        fix: alt ? { label: `Asignar a ${alt.name}`, departureId: d.id, guideId: alt.id } : undefined,
      });
    }
    if (soon && d.seatsTaken > 0 && !d.vehicleId && tour && needsTransport(tour)) {
      const alt = freeVehicle(d, ctx, d.seatsTaken, active);
      out.push({
        id: `sinvehiculo:${d.id}`,
        kind: "sin_vehiculo",
        severity: "media",
        departureIds: [d.id],
        title: `${label(d, ctx.tours)} no tiene transporte`,
        detail: `Sale en menos de tres días con ${d.seatsTaken} personas.`,
        costRiskUsd: CROSS_COST.vehicle,
        fix: alt ? { label: `Asignar ${alt.name}`, departureId: d.id, vehicleId: alt.id } : undefined,
      });
    }
    const guide = ctx.guides.find((g) => g.id === d.guideId);
    if (guide && !guide.senior && tour && (tour.difficulty === "exigente" || tour.difficulty === "extrema")) {
      const alt = freeGuide(d, ctx, true, active);
      out.push({
        id: `noapto:${d.id}`,
        kind: "guia_no_apto",
        severity: "alta",
        departureIds: [d.id],
        resourceId: guide.id,
        title: `${guide.name} todavía no guía rutas ${tour.difficulty}s`,
        detail: `${label(d, ctx.tours)} necesita un guía senior.`,
        costRiskUsd: 0,
        fix: alt ? { label: `Asignar a ${alt.name}`, departureId: d.id, guideId: alt.id } : undefined,
      });
    }
  }
  return out;
}

export const CONFLICT_KIND_LABEL: Record<Conflict["kind"], string> = {
  guia_doble: "Guía en dos salidas",
  vehiculo_doble: "Vehículo encimado",
  vehiculo_pequeno: "No caben",
  sin_guia: "Sin guía",
  sin_vehiculo: "Sin transporte",
  guia_no_apto: "Guía sin experiencia",
};
