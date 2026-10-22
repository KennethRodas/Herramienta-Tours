"use client";

import { useState } from "react";
import { toast } from "sonner";
import { getState, sim } from "@/lib/sim/store";
import { simNow } from "@/lib/sim/state";
import { HOUR } from "@/lib/domain/format";
import { cn } from "@/lib/utils";

// Each acceptance criterion of the course story map, with a button that sets
// the simulation up and opens the page where the criterion can be seen.

interface Criterion {
  story: string;
  given: string;
  then: string;
  prepare: () => Promise<string>;
}

const open = (path: string) => {
  window.open(path, "_blank", "noopener");
  return path;
};

function nextBookable(tourId = "t-santa-ana", minLeft = 1) {
  const s = getState()!;
  const now = simNow(s.clock);
  return s.departures
    .filter((d) => d.tourId === tourId && d.status === "abierta" && Date.parse(d.startsAt) > now + 3 * HOUR && d.capacity - d.seatsTaken >= minLeft)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))[0];
}

function recentBooking() {
  const s = getState()!;
  const now = simNow(s.clock);
  return s.bookings
    .filter((b) => b.status !== "cancelada")
    .map((b) => ({ b, d: s.departures.find((x) => x.id === b.departureId)! }))
    .filter(({ d }) => d && Date.parse(d.startsAt) > now)
    .sort((a, b) => Date.parse(a.d.startsAt) - Date.parse(b.d.startsAt))[0];
}

async function resetToggles() {
  await sim.updateSettings({ catalogEmpty: false, failConfirmations: false });
  await sim.setTourOverride("t-san-miguel", { active: true });
}

const CRITERIA: Criterion[] = [
  {
    story: "Explorar aventuras",
    given: "Ingresé al catálogo",
    then: "Veo cada tour con nombre, duración, dificultad, precio y descripción breve.",
    prepare: async () => {
      await resetToggles();
      return open("/aventuras");
    },
  },
  {
    story: "Explorar aventuras",
    given: "No hay tours activos",
    then: "Veo un mensaje claro de que no hay aventuras disponibles.",
    prepare: async () => {
      await sim.updateSettings({ catalogEmpty: true });
      return open("/aventuras");
    },
  },
  {
    story: "Filtrar por dificultad",
    given: "Filtro por dificultad",
    then: "Solo se muestran los tours de esa dificultad.",
    prepare: async () => {
      await resetToggles();
      return open("/aventuras?dificultad=moderada");
    },
  },
  {
    story: "Filtrar por dificultad",
    given: "Ningún tour coincide",
    then: "Veo un mensaje y la opción de limpiar el filtro.",
    prepare: async () => {
      await sim.updateSettings({ catalogEmpty: false });
      await sim.setTourOverride("t-san-miguel", { active: false });
      return open("/aventuras?dificultad=extrema");
    },
  },
  {
    story: "Elegir fecha y grupo",
    given: "Seleccioné un tour",
    then: "Veo solo fechas futuras con horario y cupos.",
    prepare: async () => {
      await resetToggles();
      return open("/aventuras/volcan-de-santa-ana");
    },
  },
  {
    story: "Elegir fecha y grupo",
    given: "Una fecha ya no tiene cupos",
    then: "Aparece sin disponibilidad y no se puede seleccionar.",
    prepare: async () => {
      const d = nextBookable();
      if (d) await sim.fillDeparture(d.id, 0);
      return open("/aventuras/volcan-de-santa-ana");
    },
  },
  {
    story: "Detalle de una salida",
    given: "Abro una salida disponible",
    then: "Veo horario, precio, punto de encuentro y cupos restantes.",
    prepare: async () => {
      const d = nextBookable();
      return d ? open(`/salidas/${d.id}`) : "No hay salidas abiertas.";
    },
  },
  {
    story: "Detalle de una salida",
    given: "La salida se llena mientras la reviso",
    then: "Se me informa que ya no hay cupos y puedo volver a las fechas.",
    prepare: async () => {
      const d = nextBookable("t-santa-ana", 2);
      if (!d) return "No hay salidas abiertas.";
      open(`/salidas/${d.id}`);
      window.setTimeout(() => {
        void sim.fillDeparture(d.id, 0);
        toast("La salida se llenó en la otra pestaña");
      }, 12000);
      return "Se llena en 12 segundos.";
    },
  },
  {
    story: "Reservar cupo",
    given: "Completo nombre, contacto y grupo",
    then: "Se registra la reserva con código único y se descuentan los cupos.",
    prepare: async () => {
      await resetToggles();
      const d = nextBookable("t-boqueron", 3) ?? nextBookable();
      return d ? open(`/salidas/${d.id}`) : "No hay salidas abiertas.";
    },
  },
  {
    story: "Reservar cupo",
    given: "El grupo supera los cupos restantes",
    then: "No se crea la reserva y se informan los cupos disponibles.",
    prepare: async () => {
      const d = nextBookable("t-santa-ana", 3);
      if (!d) return "No hay salidas abiertas.";
      await sim.fillDeparture(d.id, 2);
      return open(`/salidas/${d.id}`);
    },
  },
  {
    story: "Revisar el resumen",
    given: "Completé los datos",
    then: "Veo tour, fecha, grupo y contacto antes de enviar.",
    prepare: async () => {
      const d = nextBookable();
      return d ? open(`/salidas/${d.id}`) : "No hay salidas abiertas.";
    },
  },
  {
    story: "Revisar el resumen",
    given: "Falta un dato obligatorio",
    then: "Se marca el campo y no se envía.",
    prepare: async () => {
      const d = nextBookable();
      return d ? open(`/salidas/${d.id}`) : "No hay salidas abiertas.";
    },
  },
  {
    story: "Confirmar y prepararme",
    given: "Mi reserva se registró",
    then: "Recibo confirmación con código, fecha, horario y punto de encuentro.",
    prepare: async () => {
      const r = recentBooking();
      return r ? open(`/reserva/${r.b.code}`) : "No hay reservas futuras.";
    },
  },
  {
    story: "Confirmar y prepararme",
    given: "Falla el envío de la confirmación",
    then: "Veo la reserva registrada y cómo contactar a Wilber.",
    prepare: async () => {
      await sim.updateSettings({ failConfirmations: true });
      const d = nextBookable();
      return d ? `${open(`/salidas/${d.id}`)} · reservá y mirá el boleto` : "No hay salidas abiertas.";
    },
  },
  {
    story: "Qué llevar y cuándo llegar",
    given: "Tengo una reserva confirmada",
    then: "Veo qué llevar, a qué hora llegar y el punto de encuentro.",
    prepare: async () => {
      const r = recentBooking();
      if (!r) return "No hay reservas futuras.";
      await sim.updateDeparture(r.d.id, { prepReady: true });
      return open(`/reserva/${r.b.code}`);
    },
  },
  {
    story: "Qué llevar y cuándo llegar",
    given: "Las indicaciones aún no están listas",
    then: "Veo un aviso con el contacto de Wilber.",
    prepare: async () => {
      const r = recentBooking();
      if (!r) return "No hay reservas futuras.";
      await sim.updateDeparture(r.d.id, { prepReady: false });
      return open(`/reserva/${r.b.code}`);
    },
  },
];

export function CriteriaList({ className }: { className?: string }) {
  const [busy, setBusy] = useState<number | null>(null);
  const [done, setDone] = useState<Record<number, string>>({});
  return (
    <ol className={cn("grid gap-2 font-sans md:grid-cols-2", className)}>
      {CRITERIA.map((c, i) => (
        <li key={i} className="flex flex-col justify-between gap-3 rounded-ticket bg-cobalt-900 p-4">
          <div>
            <p className="text-[14px] font-semibold text-cobalt-300">{c.story}</p>
            <p className="mt-1 text-[16px] leading-snug">
              <span className="text-cobalt-200">Dado que </span>
              {c.given.charAt(0).toLowerCase() + c.given.slice(1)}:
            </p>
            <p className="text-[16px] font-semibold leading-snug">{c.then}</p>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="min-w-0 truncate text-[13px] text-cobalt-300">{done[i] ?? ""}</span>
            <button
              type="button"
              disabled={busy !== null}
              onClick={async () => {
                setBusy(i);
                try {
                  const out = await c.prepare();
                  setDone((d) => ({ ...d, [i]: out }));
                } finally {
                  setBusy(null);
                }
              }}
              className="pressable h-10 shrink-0 rounded-full bg-sand-100 px-4 text-[15px] font-semibold text-cobalt-800 hover:bg-sand-50 disabled:opacity-50"
            >
              {busy === i ? "Preparando…" : "Preparar y abrir"}
            </button>
          </div>
        </li>
      ))}
    </ol>
  );
}
