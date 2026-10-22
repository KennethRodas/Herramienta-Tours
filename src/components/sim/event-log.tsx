"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";
import type { SimEvent } from "@/lib/domain/types";
import { useEvents } from "@/lib/sim/hooks";
import { formatDayShort, formatTime } from "@/lib/domain/format";
import { cn } from "@/lib/utils";

const FILTERS: { id: string; label: string; match: (e: SimEvent) => boolean }[] = [
  { id: "todo", label: "Todo", match: () => true },
  { id: "reservas", label: "Reservas", match: (e) => e.type.startsWith("reserva") || e.type.startsWith("pago") },
  { id: "salidas", label: "Salidas", match: (e) => e.type.startsWith("salida") },
  { id: "cruces", label: "Cruces", match: (e) => e.type.startsWith("cruce") },
  { id: "mensajes", label: "Mensajes", match: (e) => e.type.startsWith("mensaje") },
];

const tone = (e: SimEvent) =>
  e.type === "reserva.rechazada" || e.type === "cruce.detectado" || e.type === "pago.rechazado"
    ? "bg-[#ff8b7e]"
    : e.type === "reserva.creada" || e.type === "cruce.resuelto" || e.type === "pago.aprobado"
      ? "bg-sand-100"
      : "bg-cobalt-300";

const ACTOR: Record<SimEvent["actor"], string> = { visitante: "Visitante", wilber: "Wilber", bot: "Bot", sistema: "Sistema" };

export function EventLog({ className, limit = 120 }: { className?: string; limit?: number }) {
  const events = useEvents(limit);
  const reduce = useReducedMotion();
  const [filter, setFilter] = useState("todo");
  const list = useMemo(() => (events ?? []).filter(FILTERS.find((f) => f.id === filter)!.match), [events, filter]);

  return (
    <div className={cn("flex min-h-0 flex-col font-sans", className)}>
      <div className="scrollbar-none mb-3 flex gap-1.5 overflow-x-auto">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={cn(
              "pressable h-9 shrink-0 rounded-full px-3.5 text-[14px] font-semibold",
              filter === f.id ? "bg-sand-100 text-cobalt-800" : "bg-cobalt-900 text-sand-100 hover:bg-cobalt-700",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>
      <ol data-lenis-prevent className="min-h-0 flex-1 space-y-px overflow-y-auto">
        <AnimatePresence initial={false}>
          {list.map((e) => (
            <motion.li
              key={e.id}
              layout={reduce ? false : "position"}
              initial={reduce ? false : { opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
              className="grid grid-cols-[10px_1fr] gap-3 bg-cobalt-900 px-3 py-2.5"
            >
              <span className={cn("mt-1.5 size-2.5 rounded-full", tone(e))} aria-hidden />
              <span className="min-w-0">
                <span className="block text-[15px] leading-snug text-sand-50">{e.summary}</span>
                <span className="block text-[13px] text-cobalt-300 tabular">
                  {formatDayShort(e.at)} {formatTime(e.at)} · {ACTOR[e.actor]}
                </span>
              </span>
            </motion.li>
          ))}
        </AnimatePresence>
        {list.length === 0 && <li className="p-4 text-[15px] text-cobalt-300">Sin eventos.</li>}
      </ol>
    </div>
  );
}
