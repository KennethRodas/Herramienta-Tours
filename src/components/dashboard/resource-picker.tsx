"use client";

import { motion, useReducedMotion } from "motion/react";
import { useId } from "react";
import type { Departure, Tour } from "@/lib/domain/types";
import { GUIDES, VEHICLES } from "@/content/catalog";
import { needsTransport } from "@/lib/domain/conflicts";
import { SPRING_LAYOUT } from "@/lib/ease";
import { cn } from "@/lib/utils";
import { clashesFor, vehicleShort } from "./lib";

interface Option {
  id: string | null;
  name: string;
  detail?: string;
  /** Problem this choice would cause, in stamp red. */
  problem?: string;
  note?: string;
}

/**
 * Guide or vehicle picker that shows, before you tap, what each choice would
 * cross with: the $120 problem caught at the moment of assigning.
 */
export function ResourcePicker({
  kind,
  departure,
  departures,
  tour,
  value,
  onChange,
  now,
  refs,
  disabled,
  className,
}: {
  kind: "guide" | "vehicle";
  departure: Departure;
  departures: Departure[];
  tour: Tour | undefined;
  value: string | null;
  onChange: (id: string | null) => void;
  now: number;
  refs: Map<string, string>;
  disabled?: boolean;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const group = useId();
  const hard = tour ? tour.difficulty === "exigente" || tour.difficulty === "extrema" : false;
  const refList = (deps: Departure[]) => deps.map((d) => refs.get(d.id) ?? "otra salida").join(", ");
  const untilStart = Date.parse(departure.startsAt) - now;
  // A cancelled or finished departure has nothing left to cross with.
  const inactive = departure.status === "cancelada" || departure.status === "realizada" || Date.parse(departure.endsAt) <= now;
  const soonWithPeople = !inactive && departure.seatsTaken > 0 && untilStart > 0 && untilStart < 72 * 3_600_000;

  const options: Option[] =
    kind === "guide"
      ? [
          ...GUIDES.map((g) => {
            const clash = clashesFor(departure, departures, { guideId: g.id }, now);
            return {
              id: g.id,
              name: g.name,
              detail: g.senior ? "Senior" : "Guía",
              problem: clash.length ? `Cruza con ${refList(clash)}` : hard && !g.senior ? `No guía rutas ${tour?.difficulty}s` : undefined,
            };
          }),
          { id: null, name: "Sin guía", problem: soonWithPeople ? "Sale en menos de 72 h" : undefined },
        ]
      : [
          ...VEHICLES.map((v) => {
            const clash = clashesFor(departure, departures, { vehicleId: v.id }, now);
            return {
              id: v.id,
              name: vehicleShort(v.name),
              detail: `${v.seats} asientos`,
              problem: clash.length
                ? `Cruza con ${refList(clash)}`
                : departure.seatsTaken > v.seats
                  ? `No caben ${departure.seatsTaken}`
                  : undefined,
              note: !clash.length && departure.capacity > v.seats && departure.seatsTaken <= v.seats ? `Cupo ${departure.capacity}` : undefined,
            };
          }),
          tour && !needsTransport(tour)
            ? { id: null, name: "Sin vehículo", detail: "Encuentro en el lugar" }
            : { id: null, name: "Sin vehículo", problem: soonWithPeople ? "Sale en menos de 72 h" : undefined },
        ];

  return (
    <div role="radiogroup" aria-label={kind === "guide" ? "Guía" : "Vehículo"} className={cn("grid grid-cols-2 gap-1.5", className)}>
      {options.map((o) => {
        const on = o.id === value;
        const problem = inactive ? undefined : o.problem;
        const bad = Boolean(problem);
        return (
          <button
            key={o.id ?? "none"}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            onClick={() => !on && onChange(o.id)}
            className={cn(
              "pressable relative isolate flex min-h-[64px] flex-col items-start justify-center gap-0.5 rounded-field px-3.5 py-2 text-left select-none disabled:opacity-50",
              !on && "bg-ink/6 hover:bg-ink/12",
            )}
          >
            {on ? (
              <motion.span
                layoutId={`${group}-on`}
                transition={reduce ? { duration: 0 } : SPRING_LAYOUT}
                // Radius in style so Motion keeps the corners true while the highlight travels.
                style={{ borderRadius: 14 }}
                className={cn("absolute inset-0 -z-10", bad ? "bg-destructive" : "bg-ink")}
              />
            ) : null}
            <span className={cn("text-[15px] font-semibold leading-tight", on ? "text-paper" : "text-ink")}>{o.name}</span>
            <span
              className={cn(
                "text-[13px] font-medium leading-tight",
                on ? "text-paper/85" : bad ? "text-destructive" : "text-ink-soft",
              )}
            >
              {problem ?? (on ? "Asignado" : (o.note ?? o.detail ?? "Libre"))}
            </span>
          </button>
        );
      })}
    </div>
  );
}
