"use client";

import { motion, useReducedMotion } from "motion/react";
import { Tooltip } from "@/components/motion/tooltip";
import { GUIDES, VEHICLES } from "@/content/catalog";
import { needsTransport, overlaps } from "@/lib/domain/conflicts";
import type { Departure, Tour } from "@/lib/domain/types";
import { DAY, HOUR, addDays, formatDayShort, formatTime24, svDateKey, svStartOfDay } from "@/lib/domain/format";
import { EASE_OUT } from "@/lib/ease";
import { cn } from "@/lib/utils";
import { dayLabel, vehicleShort } from "./lib";

/** Same transfer time the cross detector adds on both ends of a departure. */
const BUFFER = 1.5 * HOUR;
const LABEL_W = 132;

interface Lane {
  id: string;
  name: string;
  detail: string;
  match: (d: Departure, tours: Map<string, Tour>) => boolean;
  missing?: boolean;
}

const LANES: Lane[] = [
  ...GUIDES.map((g) => ({ id: `g:${g.id}`, name: g.name, detail: g.senior ? "Guía senior" : "Guía", match: (d: Departure) => d.guideId === g.id })),
  ...VEHICLES.map((v) => ({ id: `v:${v.id}`, name: vehicleShort(v.name), detail: `${v.seats} asientos`, match: (d: Departure) => d.vehicleId === v.id })),
  { id: "sin-guia", name: "Sin guía", detail: "Con reservas", match: (d: Departure) => !d.guideId && d.seatsTaken > 0, missing: true },
  {
    id: "sin-vehiculo",
    name: "Sin vehículo",
    detail: "Con reservas",
    // Tours that meet on location do not need the microbus.
    match: (d: Departure, tours: Map<string, Tour>) => {
      const tour = tours.get(d.tourId);
      return !d.vehicleId && d.seatsTaken > 0 && (!tour || needsTransport(tour));
    },
    missing: true,
  },
];

/**
 * Two weeks of guides and vehicles. Every departure is a bar with its
 * transfer margin on both ends; where two bars of the same resource touch,
 * the overlap is printed in stamp red. This is the board that would have
 * saved the $120.
 */
export function ResourceTimeline({
  departures,
  tours,
  refs,
  now,
  crossed,
  onOpen,
  days = 14,
  dayWidth,
}: {
  departures: Departure[];
  tours: Map<string, Tour>;
  refs: Map<string, string>;
  now: number;
  crossed: Set<string>;
  onOpen: (id: string) => void;
  days?: number;
  dayWidth: number;
}) {
  const reduce = useReducedMotion();
  const start = svStartOfDay(now);
  const end = start + days * DAY;
  const width = days * dayWidth;
  const x = (t: number) => ((t - start) / (end - start)) * width;
  const live = departures.filter((d) => d.status !== "cancelada" && Date.parse(d.endsAt) + BUFFER > start && Date.parse(d.startsAt) - BUFFER < end);
  const todayKey = svDateKey(now);
  const dayKeys = Array.from({ length: days }, (_, i) => addDays(todayKey, i));

  return (
    <div className="overflow-x-auto overscroll-x-contain bg-paper text-paper-ink" role="region" aria-label="Guías y vehículos, próximos 14 días" tabIndex={0}>
      <div className="relative" style={{ width: LABEL_W + width }}>
        {/* Day header */}
        <div className="sticky top-0 z-20 flex h-11 bg-paper">
          <div className="sticky left-0 z-30 flex shrink-0 items-end bg-paper px-3 pb-2 text-[12px] font-semibold uppercase text-ink-soft" style={{ width: LABEL_W }}>
            Recurso
          </div>
          {dayKeys.map((k, i) => (
            <div
              key={k}
              className={cn("flex shrink-0 items-end px-2 pb-2 text-[13px] font-semibold", i % 2 ? "bg-ink/[0.035]" : "", k === todayKey ? "text-ink" : "text-ink-soft")}
              style={{ width: dayWidth }}
            >
              <span className={cn("px-1 py-0.5", k === todayKey && "bg-ink text-paper")}>{dayLabel(k)}</span>
            </div>
          ))}
        </div>

        {LANES.map((lane, li) => {
          const bars = live.filter((d) => lane.match(d, tours)).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
          if (lane.missing && !bars.length) return null;
          const clashes: { from: number; to: number; key: string }[] = [];
          if (!lane.missing) {
            for (let i = 0; i < bars.length; i++) {
              for (let j = i + 1; j < bars.length; j++) {
                if (!overlaps(bars[i], bars[j])) continue;
                const from = Math.max(Date.parse(bars[i].startsAt), Date.parse(bars[j].startsAt)) - BUFFER;
                const to = Math.min(Date.parse(bars[i].endsAt), Date.parse(bars[j].endsAt)) + BUFFER;
                clashes.push({ from, to, key: `${bars[i].id}-${bars[j].id}` });
              }
            }
          }
          return (
            <div key={lane.id} className={cn("relative flex h-[58px]", li === GUIDES.length && "mt-2")}>
              <div className="sticky left-0 z-10 flex shrink-0 flex-col justify-center bg-paper px-3" style={{ width: LABEL_W }}>
                <span className={cn("truncate text-[15px] font-semibold leading-tight", lane.missing && "text-destructive")}>{lane.name}</span>
                <span className="truncate text-[12px] leading-tight text-ink-soft">{lane.detail}</span>
              </div>
              <div className="relative shrink-0" style={{ width }}>
                {/* Alternate day bands */}
                {dayKeys.map((k, i) => (i % 2 ? <span key={k} aria-hidden className="absolute inset-y-0 bg-ink/[0.035]" style={{ left: i * dayWidth, width: dayWidth }} /> : null))}
                {clashes.map((c) => (
                  <motion.span
                    key={c.key}
                    aria-hidden
                    initial={reduce ? { opacity: 0 } : { opacity: 0, scaleY: 0.6 }}
                    animate={{ opacity: 1, scaleY: 1 }}
                    transition={{ duration: 0.3, ease: EASE_OUT }}
                    className="absolute inset-y-1 z-[1] bg-destructive/30"
                    style={{ left: Math.max(0, x(c.from)), width: Math.max(4, x(c.to) - Math.max(0, x(c.from))) }}
                  />
                ))}
                {bars.map((d) => {
                  const s = Date.parse(d.startsAt);
                  const e = Date.parse(d.endsAt);
                  const isCrossed = crossed.has(d.id);
                  const tour = tours.get(d.tourId);
                  const ref = refs.get(d.id) ?? "";
                  const barW = Math.max(6, x(e) - x(s));
                  return (
                    <Tooltip
                      key={d.id}
                      side="top"
                      content={
                        <span className="flex flex-col gap-0.5 text-[13px]">
                          <span className="font-semibold">
                            {ref} · {tour?.shortName}
                          </span>
                          <span>
                            {formatDayShort(d.startsAt)} {formatTime24(d.startsAt)}–{formatTime24(d.endsAt)} · {d.seatsTaken}/{d.capacity}
                          </span>
                          <span className="opacity-75">Con traslado: {formatTime24(s - BUFFER)}–{formatTime24(e + BUFFER)}</span>
                        </span>
                      }
                    >
                      <button
                        type="button"
                        onClick={() => onOpen(d.id)}
                        aria-label={`${ref} ${tour?.shortName ?? ""}, ${formatDayShort(d.startsAt)} ${formatTime24(d.startsAt)}${isCrossed ? ", con cruce" : ""}`}
                        className="pressable group absolute top-1/2 z-[2] h-8 -translate-y-1/2"
                        style={{ left: x(s - BUFFER), width: x(e + BUFFER) - x(s - BUFFER) }}
                      >
                        <span aria-hidden className={cn("absolute inset-0", isCrossed ? "bg-destructive/25" : "bg-ink/14")} />
                        <span
                          aria-hidden
                          className={cn(
                            "absolute inset-y-0 flex items-center overflow-hidden px-1 text-[12px] font-bold leading-none whitespace-nowrap transition-[filter] duration-150 group-hover:brightness-125",
                            isCrossed ? "bg-destructive text-paper" : "bg-ink text-paper",
                          )}
                          style={{ left: x(s) - x(s - BUFFER), width: barW }}
                        >
                          {barW > 30 ? ref : ""}
                        </span>
                      </button>
                    </Tooltip>
                  );
                })}
                {/* Now */}
                <span aria-hidden className="absolute inset-y-0 z-[3] w-0.5 bg-ink/60" style={{ left: x(now) }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
