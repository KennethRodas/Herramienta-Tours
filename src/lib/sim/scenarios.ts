"use client";

import { GUIDES, VEHICLES } from "@/content/catalog";
import { seatsLeft } from "@/lib/domain/availability";
import { DAY, HOUR, addDays, formatDayShort, svDateKey, svParts } from "@/lib/domain/format";
import * as wa from "@/lib/whatsapp/templates";
import { rush } from "./engine";
import { effectiveTours, getState, sim } from "./store";
import { simNow } from "./state";

// One-click situations for the presentation. Each one changes the shared state,
// so every open tab (site, Wilber's panel, simulator) reacts at the same time.

export interface Scenario {
  id: string;
  title: string;
  description: string;
  /** What to look at after running it. */
  watch: string;
  run: () => Promise<string>;
}

const nextOpen = (minHours = 4) => {
  const s = getState()!;
  const now = simNow(s.clock);
  return s.departures
    .filter((d) => d.status === "abierta" && Date.parse(d.startsAt) > now + minHours * HOUR)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
};

export const SCENARIOS: Scenario[] = [
  {
    id: "ultimo-cupo",
    title: "Carrera por los últimos cupos",
    description: "Una salida queda con 2 cupos y 12 visitantes intentan reservar en el mismo instante.",
    watch: "El registro de eventos: entran las que caben y el resto se rechaza. Sobreventas: cero.",
    run: async () => {
      const dep = nextOpen(6).find((d) => d.capacity - d.seatsTaken >= 2);
      if (!dep) return "No hay una salida abierta con cupos para la prueba.";
      await sim.fillDeparture(dep.id, 2);
      const r = await rush(dep.id, 12);
      return `${r.ok} reservas entraron y ${r.rejected} fueron rechazadas. Nadie quedó sin asiento en el microbús.`;
    },
  },
  {
    id: "temporada-alta",
    title: "Semana Santa",
    description: "Temporada alta: llegan 40 reservas por hora simulada y Wilber abre salidas extra.",
    watch: "Las salidas se llenan en vivo y aparecen cruces de guía y microbús en el panel de Wilber.",
    run: async () => {
      const s = getState()!;
      const now = simNow(s.clock);
      const today = svDateKey(now);
      for (let i = 1; i <= 4; i++) {
        const dateKey = addDays(today, i);
        await sim.createDeparture({ tourId: "t-santa-ana", dateKey, guideId: "wilber", vehicleId: "la-chula" });
        await sim.createDeparture({ tourId: "t-boqueron", dateKey, time: "06:00", guideId: "wilber", vehicleId: "la-chula" });
      }
      await sim.updateSettings({ trafficPerHour: 40 });
      if (s.clock.speed < 600) await sim.setClock({ speed: 600 });
      return "Abiertas 8 salidas extra (algunas con el mismo guía y microbús) y tráfico a 40 reservas por hora. El reloj corre 10 minutos por segundo.";
    },
  },
  {
    id: "cruce",
    title: "Cruce de guía",
    description: "Wilber asigna el mismo guía y microbús a dos salidas de mañana, como pasó en la temporada pasada.",
    watch: "Le llega una alerta por WhatsApp y el panel muestra el arreglo de un clic.",
    run: async () => {
      const s = getState()!;
      const now = simNow(s.clock);
      const tomorrow = addDays(svDateKey(now), 1);
      const a = await sim.createDeparture({ tourId: "t-santa-ana", dateKey: tomorrow, guideId: "josue", vehicleId: "el-cipote" });
      const b = await sim.createDeparture({ tourId: "t-coatepeque", dateKey: tomorrow, guideId: "josue", vehicleId: "el-cipote" });
      await sim.fillDeparture(a.id, 6);
      await sim.fillDeparture(b.id, 5);
      return `Creado el cruce: ${formatDayShort(a.startsAt)} Santa Ana y Coatepeque con Josué y «El Cipote».`;
    },
  },
  {
    id: "lluvia",
    title: "Tormenta tropical",
    description: "El pronóstico anuncia lluvia fuerte para la próxima salida con gente: avisos a todos por WhatsApp.",
    watch: "Los teléfonos de los visitantes reciben el aviso con botones para cambiar de fecha.",
    run: async () => {
      const dep = nextOpen(10).find((d) => d.seatsTaken > 0);
      if (!dep) return "No hay salidas con reservas para avisar.";
      await sim.commit((d, now) => {
        const target = d.departures.find((x) => x.id === dep.id)!;
        const tour = effectiveTours(d).find((t) => t.id === target.tourId)!;
        target.notes = "Pronóstico de tormenta: si se confirma, cambiamos de fecha sin costo.";
        for (const b of d.bookings.filter((x) => x.departureId === dep.id && x.status !== "cancelada")) {
          sim.queueWa(d, now, b.phone, "alerta_clima", wa.weatherAlert(b, target, tour, "El MARN anuncia lluvia fuerte desde la madrugada. Decidimos a las 6 p. m. de la víspera."), { bookingId: b.id, departureId: dep.id });
        }
        sim.logEvent(d, now, "mensaje.enviado", "wilber", `Aviso de clima a ${target.seatsTaken} personas de ${tour.shortName} ${formatDayShort(target.startsAt)}.`);
      });
      return "Avisos de clima enviados a todos los grupos de esa salida.";
    },
  },
  {
    id: "catalogo-vacio",
    title: "Catálogo vacío",
    description: "Wilber pausa todos los tours (fin de temporada). El sitio debe decirlo con claridad.",
    watch: "La portada y el catálogo muestran el aviso sin aventuras disponibles.",
    run: async () => {
      const s = getState()!;
      await sim.updateSettings({ catalogEmpty: !s.settings.catalogEmpty });
      return s.settings.catalogEmpty ? "Catálogo restaurado." : "Todos los tours en pausa. Volvé a correr el escenario para restaurarlos.";
    },
  },
  {
    id: "confirmacion-falla",
    title: "Falla el WhatsApp",
    description: "Las confirmaciones dejan de salir. La reserva igual se registra y el boleto explica cómo contactar a Wilber.",
    watch: "Hacé una reserva: el boleto muestra el aviso y el botón directo a Wilber.",
    run: async () => {
      const s = getState()!;
      await sim.updateSettings({ failConfirmations: !s.settings.failConfirmations });
      return s.settings.failConfirmations ? "Las confirmaciones vuelven a salir." : "Confirmaciones caídas. Corré de nuevo el escenario para restaurarlas.";
    },
  },
  {
    id: "pago-rechazado",
    title: "Pago rechazado",
    description: "El banco rechaza el anticipo en línea (Wompi simulado).",
    watch: "La reserva sigue en pie con pago el día de la salida; nadie pierde su cupo.",
    run: async () => {
      const s = getState()!;
      const next = s.settings.wompiOutcome === "aprobar" ? "rechazar" : "aprobar";
      await sim.updateSettings({ wompiOutcome: next, onlineDeposit: true });
      return next === "rechazar" ? "Los próximos pagos simulados serán rechazados." : "Los pagos simulados vuelven a aprobarse.";
    },
  },
  {
    id: "dia-de-salida",
    title: "Adelantar a la madrugada",
    description: "Mueve el reloj a dos horas antes de la próxima salida con gente.",
    watch: "Salen los recordatorios con ubicación y el panel de Wilber pasa al modo «Hoy».",
    run: async () => {
      const dep = nextOpen(2).find((d) => d.seatsTaken > 0);
      if (!dep) return "No hay salidas próximas con gente.";
      await sim.setClock({ setTo: Date.parse(dep.startsAt) - 2 * HOUR - 60_000 });
      return `Reloj en ${formatDayShort(dep.startsAt)}, dos horas antes de salir.`;
    },
  },
];

/** Moves the clock one simulated day forward and reports what happened. */
export async function skipDay() {
  await sim.setClock({ jumpMs: DAY });
}

export function busiestUpcoming(limit = 5) {
  const s = getState();
  if (!s) return [];
  const now = simNow(s.clock);
  return s.departures
    .filter((d) => Date.parse(d.startsAt) > now && d.status !== "cancelada")
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
    .slice(0, limit)
    .map((d) => ({ d, left: seatsLeft(d, s.holds, now), weekday: svParts(d.startsAt).weekday }));
}

export const RESOURCES = { GUIDES, VEHICLES };
