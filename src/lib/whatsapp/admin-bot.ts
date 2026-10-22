import type { Booking, Conflict, Departure, Guide, Hold, Tour, Vehicle } from "@/lib/domain/types";
import { detectConflicts } from "@/lib/domain/conflicts";
import { seatsLeft } from "@/lib/domain/availability";
import { departureRef, findByRef } from "@/lib/domain/refs";
import {
  DAY,
  formatDayLong,
  formatDayShort,
  formatPhone,
  formatTime,
  formatUsd,
  plural,
  svDateKey,
  svStartOfDay,
} from "@/lib/domain/format";
import { normalizeCode } from "@/lib/domain/availability";

// Wilber runs the business from WhatsApp. This is the command parser behind his
// number: pure, so the simulator, the dashboard chat and the Kapso webhook share it.

export interface BotData {
  tours: Tour[];
  departures: Departure[];
  bookings: Booking[];
  holds: Hold[];
  guides: Guide[];
  vehicles: Vehicle[];
  now: number;
}

export type BotAction =
  | { type: "closeDeparture"; departureId: string }
  | { type: "openDeparture"; departureId: string }
  | { type: "checkIn"; bookingId: string; count: number }
  | { type: "cancelBooking"; bookingId: string }
  | { type: "applyFix"; conflictId: string };

export interface BotReply {
  text: string;
  buttons?: string[];
  actions?: BotAction[];
}

const strip = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[¿?¡!.,;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const live = (b: Booking) => b.status !== "cancelada";

function tourOf(d: Departure, data: BotData) {
  return data.tours.find((t) => t.id === d.tourId);
}

function dayDepartures(data: BotData, dayOffset: number) {
  const start = svStartOfDay(data.now) + dayOffset * DAY;
  return data.departures
    .filter((d) => d.status !== "cancelada")
    .filter((d) => {
      const t = Date.parse(d.startsAt);
      return t >= start && t < start + DAY;
    })
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
}

function depLine(d: Departure, data: BotData, withRef = true) {
  const tour = tourOf(d, data);
  const ref = departureRef(d, data.tours, data.departures);
  const guide = data.guides.find((g) => g.id === d.guideId)?.name ?? "sin guía";
  const vehicle = data.vehicles.find((v) => v.id === d.vehicleId)?.name ?? "sin transporte";
  const status = d.status === "cerrada" ? " · cerrada" : "";
  return `${withRef ? `*${ref}* ` : ""}${formatTime(d.startsAt)} ${tour?.shortName ?? ""} · ${d.seatsTaken}/${d.capacity}${status}\n   ${guide} · ${vehicle}`;
}

function menu(): BotReply {
  return {
    text: [
      "*Comandos*",
      "*hoy* / *mañana* · salidas del día",
      "*semana* · lo que viene en 7 días",
      "*lista SA24* · quién va en una salida",
      "*cupos* · disponibilidad por tour",
      "*reservas* · las últimas que entraron",
      "*WIL-7K2Q* · buscar una reserva",
      "*llegó WIL-7K2Q* · marcar que llegó",
      "*cerrar SA24* / *abrir SA24*",
      "*cruces* · guías o vehículos encimados",
      "*caja* · plata de la semana",
    ].join("\n"),
    buttons: ["Hoy", "Cruces", "Caja"],
  };
}

function dayReport(data: BotData, offset: number): BotReply {
  const deps = dayDepartures(data, offset);
  const label = offset === 0 ? "Hoy" : offset === 1 ? "Mañana" : formatDayLong(svStartOfDay(data.now) + offset * DAY);
  if (!deps.length) {
    return { text: `*${label}:* sin salidas.`, buttons: ["Semana"] };
  }
  const people = deps.reduce((n, d) => n + d.seatsTaken, 0);
  const checked = deps
    .flatMap((d) => data.bookings.filter((b) => b.departureId === d.id && live(b)))
    .reduce((n, b) => n + b.checkedIn, 0);
  const lines = deps.map((d) => depLine(d, data));
  const head = `*${label}, ${formatDayShort(deps[0].startsAt)}* · ${plural(deps.length, "salida", "salidas")} · ${plural(people, "persona", "personas")}`;
  const progress = offset === 0 && checked ? `\nYa llegaron ${checked} de ${people}.` : "";
  return {
    text: `${head}${progress}\n\n${lines.join("\n")}`,
    buttons: deps.slice(0, 2).map((d) => `Lista ${departureRef(d, data.tours, data.departures)}`),
  };
}

function weekReport(data: BotData): BotReply {
  const end = data.now + 7 * DAY;
  const deps = data.departures
    .filter((d) => d.status !== "cancelada" && Date.parse(d.startsAt) > data.now && Date.parse(d.startsAt) < end)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  if (!deps.length) return { text: "No hay salidas en los próximos 7 días." };
  const byDay = new Map<string, Departure[]>();
  for (const d of deps) {
    const k = svDateKey(d.startsAt);
    byDay.set(k, [...(byDay.get(k) ?? []), d]);
  }
  const blocks = [...byDay.values()].map(
    (list) =>
      `*${formatDayShort(list[0].startsAt)}*\n` +
      list
        .map((d) => `   ${departureRef(d, data.tours, data.departures)} ${tourOf(d, data)?.shortName} ${d.seatsTaken}/${d.capacity}`)
        .join("\n"),
  );
  const sold = deps.reduce((n, d) => n + d.seatsTaken, 0);
  const cap = deps.reduce((n, d) => n + d.capacity, 0);
  return { text: `*Próximos 7 días* · ${sold} de ${cap} cupos vendidos\n\n${blocks.join("\n")}` };
}

function manifest(dep: Departure, data: BotData): BotReply {
  const tour = tourOf(dep, data);
  const ref = departureRef(dep, data.tours, data.departures);
  const list = data.bookings.filter((b) => b.departureId === dep.id && live(b));
  if (!list.length) {
    return { text: `*${ref}* ${tour?.shortName} ${formatDayShort(dep.startsAt)}: todavía no hay reservas.` };
  }
  const rows = list.map((b) => {
    const pay =
      b.payment.method === "wompi"
        ? b.payment.status === "aprobado"
          ? "anticipo pagado"
          : "pago pendiente"
        : `paga ${formatUsd(b.partySize * dep.priceUsd)}`;
    const mark = b.status === "check_in" || b.checkedIn >= b.partySize ? "[llegó] " : b.status === "no_show" ? "[no vino] " : "";
    return `${mark}${b.name} × ${b.partySize}\n   ${b.code} · ${formatPhone(b.phone)} · ${pay}`;
  });
  return {
    text: `*${ref} · ${tour?.name}*\n${formatDayLong(dep.startsAt)}, ${formatTime(dep.startsAt)} · ${dep.seatsTaken}/${dep.capacity}\n\n${rows.join("\n")}`,
    buttons: dep.status === "cerrada" ? [`Abrir ${ref}`] : [`Cerrar ${ref}`],
  };
}

function availability(data: BotData, query: string): BotReply {
  const q = strip(query);
  const tours = data.tours.filter((t) => t.active && (!q || strip(`${t.name} ${t.shortName} ${t.code}`).includes(q)));
  if (!tours.length) return { text: `No encontré un tour con "${query}". Probá con *cupos santa ana*.` };
  const blocks = tours.slice(0, 6).map((t) => {
    const next = data.departures
      .filter((d) => d.tourId === t.id && d.status === "abierta" && Date.parse(d.startsAt) > data.now)
      .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
      .slice(0, 3);
    const line = next.length
      ? next.map((d) => `${formatDayShort(d.startsAt)}: ${seatsLeft(d, data.holds, data.now)} libres`).join(" · ")
      : "sin salidas abiertas";
    return `*${t.shortName}* — ${line}`;
  });
  return { text: blocks.join("\n") };
}

function recent(data: BotData): BotReply {
  const list = [...data.bookings]
    .filter(live)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 6);
  if (!list.length) return { text: "Todavía no hay reservas." };
  return {
    text:
      "*Últimas reservas*\n" +
      list
        .map((b) => {
          const d = data.departures.find((x) => x.id === b.departureId);
          const t = data.tours.find((x) => x.id === b.tourId);
          return `${b.code} · ${b.name} × ${b.partySize}\n   ${t?.shortName} ${d ? formatDayShort(d.startsAt) : ""}`;
        })
        .join("\n"),
  };
}

function bookingDetail(b: Booking, data: BotData): BotReply {
  const d = data.departures.find((x) => x.id === b.departureId);
  const t = data.tours.find((x) => x.id === b.tourId);
  const ref = d ? departureRef(d, data.tours, data.departures) : "";
  return {
    text: [
      `*${b.code}* · ${b.status.replace("_", " ")}`,
      `${b.name} × ${b.partySize} · ${formatPhone(b.phone)}`,
      `${t?.name ?? ""} ${d ? `${formatDayShort(d.startsAt)} ${formatTime(d.startsAt)} (${ref})` : ""}`,
      b.notes ? `Nota: ${b.notes}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
    buttons: [`Llegó ${b.code}`, ref ? `Lista ${ref}` : "Hoy"],
  };
}

function cashReport(data: BotData): BotReply {
  const weekStart = svStartOfDay(data.now) - 6 * DAY;
  const weekDeps = data.departures.filter((d) => {
    const t = Date.parse(d.startsAt);
    return t >= weekStart && t < svStartOfDay(data.now) + 8 * DAY && d.status !== "cancelada";
  });
  let collected = 0;
  let expected = 0;
  let pendingOnline = 0;
  for (const d of weekDeps) {
    for (const b of data.bookings.filter((x) => x.departureId === d.id && live(x))) {
      const total = b.partySize * d.priceUsd;
      if (Date.parse(d.startsAt) < data.now) collected += total;
      else expected += total;
      if (b.payment.method === "wompi" && b.payment.status === "pendiente") pendingOnline += b.payment.amountUsd;
    }
  }
  return {
    text: [
      "*Caja · 7 días atrás y 7 adelante*",
      `Cobrado en ruta: ${formatUsd(collected)}`,
      `Por cobrar en próximas salidas: ${formatUsd(expected)}`,
      pendingOnline ? `Anticipos en línea pendientes: ${formatUsd(pendingOnline)}` : "Sin anticipos pendientes.",
    ].join("\n"),
  };
}

function conflictsReport(conflicts: Conflict[]): BotReply {
  if (!conflicts.length) return { text: "Sin cruces." };
  const risk = conflicts.reduce((n, c) => n + c.costRiskUsd, 0);
  return {
    text:
      `*${plural(conflicts.length, "cruce", "cruces")}* · riesgo ${formatUsd(risk)}\n\n` +
      conflicts
        .slice(0, 5)
        .map((c, i) => `${i + 1}. ${c.title}\n   ${c.detail}${c.fix ? `\n   Arreglo: ${c.fix.label}` : ""}`)
        .join("\n") +
      (conflicts.some((c) => c.fix) ? "\n\nRespondé *arreglar 1* para aplicar el primero." : ""),
    buttons: conflicts[0]?.fix ? ["Arreglar 1"] : undefined,
  };
}

export function handleAdminMessage(raw: string, data: BotData): BotReply {
  const text = strip(raw);
  if (!text || ["hola", "menu", "ayuda", "comandos", "buenas", "buenos dias", "help"].includes(text)) return menu();

  const conflicts = () =>
    detectConflicts({ departures: data.departures, tours: data.tours, guides: data.guides, vehicles: data.vehicles, now: data.now });

  if (text === "hoy") return dayReport(data, 0);
  if (text === "manana" || text === "mañana") return dayReport(data, 1);
  if (text === "pasado manana") return dayReport(data, 2);
  if (["semana", "proximas", "proximos", "agenda"].includes(text)) return weekReport(data);
  if (["reservas", "ultimas", "nuevas"].includes(text)) return recent(data);
  if (["caja", "plata", "ingresos", "pisto"].includes(text)) return cashReport(data);
  if (["cruces", "conflictos", "ver cruces"].includes(text)) return conflictsReport(conflicts());

  const fixMatch = text.match(/^arreglar(?:\s+(\d+))?$/);
  if (fixMatch) {
    const list = conflicts().filter((c) => c.fix);
    const c = list[(Number(fixMatch[1] ?? 1) || 1) - 1];
    if (!c?.fix) return { text: "No hay un arreglo automático para ese cruce. Revisalo en el panel." };
    return { text: `Listo: ${c.fix.label}.`, actions: [{ type: "applyFix", conflictId: c.id }] };
  }

  const cupos = text.match(/^cupos?\s*(.*)$/);
  if (cupos) return availability(data, cupos[1] ?? "");

  const refCmd = text.match(/^(lista|cerrar|abrir)\s+([a-z]{2}\d{2}[a-z]?)$/);
  if (refCmd) {
    const dep = findByRef(refCmd[2], data.departures, data.tours, data.now);
    if (!dep) return { text: `No encontré la salida ${refCmd[2].toUpperCase()}. Mirá *semana* para ver los códigos.` };
    const ref = departureRef(dep, data.tours, data.departures);
    if (refCmd[1] === "lista") return manifest(dep, data);
    if (refCmd[1] === "cerrar") {
      if (dep.status === "cerrada") return { text: `${ref} ya estaba cerrada.` };
      return {
        text: `${ref} cerrada: nadie más puede reservar en línea. Quedaron ${dep.seatsTaken} de ${dep.capacity}.`,
        actions: [{ type: "closeDeparture", departureId: dep.id }],
      };
    }
    if (dep.status !== "cerrada") return { text: `${ref} ya está abierta.` };
    return { text: `${ref} abierta otra vez.`, actions: [{ type: "openDeparture", departureId: dep.id }] };
  }
  if (text === "lista") {
    const next = data.departures
      .filter((d) => d.status !== "cancelada" && Date.parse(d.endsAt) > data.now)
      .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))[0];
    return next ? manifest(next, data) : { text: "No hay salidas próximas." };
  }

  const codeMatch = raw.toUpperCase().match(/WIL[\s-]?([A-Z0-9]{4})/);
  if (codeMatch) {
    const code = normalizeCode(codeMatch[0]);
    const b = data.bookings.find((x) => x.code === code);
    if (!b) return { text: `No hay ninguna reserva ${code}.` };
    if (/^(llego|llegaron|check|vino|presente)/.test(text)) {
      if (b.status === "cancelada") return { text: `${code} está cancelada.` };
      return {
        text: `Anotado: llegó ${b.name} con ${plural(b.partySize, "persona", "personas")}.`,
        actions: [{ type: "checkIn", bookingId: b.id, count: b.partySize }],
      };
    }
    if (/^(cancelar|anular)/.test(text)) {
      return { text: `${code} cancelada y ${plural(b.partySize, "cupo liberado", "cupos liberados")}.`, actions: [{ type: "cancelBooking", bookingId: b.id }] };
    }
    return bookingDetail(b, data);
  }

  const search = text.match(/^buscar\s+(.+)$/);
  if (search) {
    const q = search[1];
    const hits = data.bookings.filter((b) => strip(b.name).includes(q) || b.phone.endsWith(q.replace(/\D/g, "") || "x"));
    if (!hits.length) return { text: `No encontré a "${search[1]}".` };
    if (hits.length === 1) return bookingDetail(hits[0], data);
    return { text: hits.slice(0, 6).map((b) => `${b.code} · ${b.name} × ${b.partySize}`).join("\n") };
  }

  return {
    text: `No entendí "${raw.trim()}". Escribí *menu* para ver los comandos.`,
    buttons: ["Menu", "Hoy"],
  };
}
