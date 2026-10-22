"use client";

import { AnimatePresence, motion, useReducedMotion, type PanInfo } from "motion/react";
import { Lock, Plus } from "lucide-react";
import type { DepartureView } from "@/lib/sim/hooks";
import type { Tour } from "@/lib/domain/types";
import { GUIDES, VEHICLES } from "@/content/catalog";
import { needsTransport } from "@/lib/domain/conflicts";
import { addDays, formatTime24, plural } from "@/lib/domain/format";
import { EASE_OUT } from "@/lib/ease";
import { cn } from "@/lib/utils";
import { WEEKDAY_MON_FIRST, dayLabelLong, initials, keyParts, monthKey, vehicleShort } from "./lib";
import { SeatMeter } from "./ui";

export interface CalendarData {
  byDay: Map<string, DepartureView[]>;
  tours: Map<string, Tour>;
  refs: Map<string, string>;
  crossed: Set<string>;
  today: string;
}

const slide = {
  enter: (d: number) => ({ opacity: 0, x: d * 36 }),
  center: { opacity: 1, x: 0, transition: { duration: 0.24, ease: EASE_OUT } },
  exit: (d: number) => ({ opacity: 0, x: d * -24, transition: { duration: 0.14, ease: EASE_OUT } }),
};
const fade = {
  enter: { opacity: 0 },
  center: { opacity: 1, transition: { duration: 0.16 } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
};

/** Horizontal swipe on the calendar = previous / next page, like a paper planner. */
function useSwipe(onPage: (dir: number) => void) {
  return {
    drag: "x" as const,
    dragConstraints: { left: 0, right: 0 },
    dragElastic: 0.18,
    dragMomentum: false,
    onDragEnd: (_: unknown, info: PanInfo) => {
      if (info.offset.x < -60 || info.velocity.x < -500) onPage(1);
      else if (info.offset.x > 60 || info.velocity.x > 500) onPage(-1);
    },
  };
}

function Chip({ d, data, onOpen }: { d: DepartureView; data: CalendarData; onOpen: (id: string) => void }) {
  const tour = data.tours.get(d.tourId);
  const cancelled = d.status === "cancelada";
  const full = d.state === "llena";
  const crossed = data.crossed.has(d.id);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen(d.id);
      }}
      title={`${data.refs.get(d.id)} · ${tour?.name} · ${d.seatsTaken}/${d.capacity}`}
      className={cn(
        "pressable relative flex w-full flex-col gap-1 rounded-stub bg-ink/8 px-1.5 pt-1 pb-1.5 text-left hover:bg-ink/15",
        cancelled && "opacity-55",
        crossed && "bg-destructive/12 hover:bg-destructive/20",
      )}
    >
      <span className="flex min-w-0 items-center gap-1 text-[12px] leading-none">
        <span className={cn("font-semibold tabular", cancelled && "line-through")}>{formatTime24(d.startsAt)}</span>
        <span className={cn("truncate font-semibold", crossed && "text-destructive")}>{tour?.shortName}</span>
        {d.status === "cerrada" ? <Lock className="size-3 shrink-0 text-ink-soft" aria-label="Cerrada" /> : null}
        <span className={cn("ml-auto shrink-0 tabular", full ? "font-bold text-destructive" : "text-ink-soft")}>
          {cancelled ? "×" : `${d.seatsTaken}/${d.capacity}`}
        </span>
      </span>
      {!cancelled ? <SeatMeter taken={d.seatsTaken} capacity={d.capacity} tone={full ? "stamp" : "ink"} className="h-[3px]" /> : null}
    </button>
  );
}

// --- Month ---------------------------------------------------------------------------

export function MonthGrid({
  days,
  month,
  data,
  dir,
  compact,
  selected,
  onSelectDay,
  onOpen,
  onNew,
  onPage,
}: {
  days: string[];
  month: string;
  data: CalendarData;
  dir: number;
  compact: boolean;
  selected?: string;
  onSelectDay: (key: string) => void;
  onOpen: (id: string) => void;
  onNew: (key: string) => void;
  onPage: (dir: number) => void;
}) {
  const reduce = useReducedMotion();
  const swipe = useSwipe(onPage);
  const max = compact ? 3 : 4;
  return (
    <div className="overflow-hidden">
      <div className="grid grid-cols-7 gap-1 pb-1">
        {WEEKDAY_MON_FIRST.map((w) => (
          <span key={w} className="px-1 text-[13px] font-semibold text-ink-soft">
            {w}
          </span>
        ))}
      </div>
      <AnimatePresence mode="popLayout" initial={false} custom={dir}>
        <motion.div
          key={month}
          custom={dir}
          variants={reduce ? fade : slide}
          initial="enter"
          animate="center"
          exit="exit"
          {...(compact && !reduce ? swipe : {})}
          className={cn("grid grid-cols-7 gap-1", compact && "touch-pan-y")}
        >
          {days.map((key) => {
            const list = data.byDay.get(key) ?? [];
            const inMonth = monthKey(key) === month;
            const isToday = key === data.today;
            const past = key < data.today;
            const p = keyParts(key);
            const crossed = list.some((d) => data.crossed.has(d.id));
            if (compact) {
              const on = key === selected;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onSelectDay(key)}
                  aria-pressed={on}
                  aria-label={`${dayLabelLong(key)}: ${plural(list.length, "salida", "salidas")}`}
                  className={cn(
                    "pressable relative flex h-[62px] flex-col items-stretch gap-1 rounded-field px-1 pt-1 pb-1.5 text-left transition-colors duration-150",
                    on ? "bg-ink text-paper" : inMonth ? "bg-paper text-paper-ink" : "bg-transparent text-ink-soft",
                    past && !on && "opacity-60",
                  )}
                >
                  <span className="flex items-center justify-between">
                    <span
                      className={cn(
                        "grid size-6 place-items-center rounded-full text-[14px] font-bold tabular leading-none",
                        isToday && !on && "bg-ink text-paper",
                      )}
                    >
                      {p.day}
                    </span>
                    {crossed ? <span className={cn("size-2 rounded-full", on ? "bg-paper" : "bg-destructive")} aria-label="Cruce" /> : null}
                  </span>
                  <span className="mt-auto flex flex-col gap-[3px]">
                    {list.slice(0, max).map((d) => (
                      <span key={d.id} className={cn("relative block h-[5px] overflow-hidden rounded-full", on ? "bg-paper/25" : "bg-ink/15", d.status === "cancelada" && "opacity-30")}>
                        <span
                          className={cn("absolute inset-y-0 left-0 rounded-full", d.state === "llena" ? "bg-destructive" : on ? "bg-paper" : "bg-ink")}
                          style={{ width: `${d.capacity ? Math.round((d.seatsTaken / d.capacity) * 100) : 0}%` }}
                        />
                      </span>
                    ))}
                  </span>
                </button>
              );
            }
            return (
              <div
                key={key}
                className={cn(
                  "group relative flex min-h-[132px] flex-col gap-1 rounded-field p-1.5",
                  inMonth ? "bg-paper text-paper-ink" : "bg-ink/4 text-ink-soft",
                  past && "opacity-70",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className={cn("grid h-7 min-w-7 place-items-center rounded-full px-1 text-[14px] font-bold tabular", isToday && "bg-ink text-paper")}>{p.day}</span>
                  {!past ? (
                    <button
                      type="button"
                      onClick={() => onNew(key)}
                      aria-label={`Nueva salida el ${dayLabelLong(key)}`}
                      className="pressable grid size-7 place-items-center rounded-full text-ink-soft opacity-0 transition-opacity duration-150 group-hover:opacity-100 hover:bg-ink/10 hover:text-ink focus-visible:opacity-100"
                    >
                      <Plus className="size-4" />
                    </button>
                  ) : null}
                </div>
                <div className="flex flex-col gap-1">
                  {list.slice(0, max).map((d) => (
                    <Chip key={d.id} d={d} data={data} onOpen={onOpen} />
                  ))}
                  {list.length > max ? (
                    <button type="button" onClick={() => onSelectDay(key)} className="pressable px-1.5 py-0.5 text-left text-[12px] font-semibold text-ink-soft hover:text-ink">
                      +{list.length - max} más
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// --- Week ----------------------------------------------------------------------------

export function WeekGrid({
  start,
  data,
  dir,
  onOpen,
  onNew,
  onPage,
}: {
  start: string;
  data: CalendarData;
  dir: number;
  onOpen: (id: string) => void;
  onNew: (key: string) => void;
  onPage: (dir: number) => void;
}) {
  const reduce = useReducedMotion();
  const swipe = useSwipe(onPage);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return (
    <div className="overflow-hidden">
      <AnimatePresence mode="popLayout" initial={false} custom={dir}>
        <motion.div
          key={start}
          custom={dir}
          variants={reduce ? fade : slide}
          initial="enter"
          animate="center"
          exit="exit"
          {...(!reduce ? swipe : {})}
          className="grid touch-pan-y grid-cols-1 gap-1.5 md:grid-cols-7 md:gap-1"
        >
          {days.map((key) => {
            const list = data.byDay.get(key) ?? [];
            const isToday = key === data.today;
            const past = key < data.today;
            const people = list.filter((d) => d.status !== "cancelada").reduce((n, d) => n + d.seatsTaken, 0);
            return (
              <div key={key} className={cn("flex flex-col gap-1.5 rounded-ticket bg-paper p-2 text-paper-ink md:min-h-[420px]", past && "opacity-70")}>
                <div className="flex items-center justify-between gap-2 px-0.5">
                  <span className={cn("rounded-full px-2 py-1 text-[14px] font-bold", isToday && "bg-ink text-paper")}>{dayLabelLong(key)}</span>
                  <span className="text-[12px] font-medium text-ink-soft">{list.length ? `${people} pers.` : ""}</span>
                </div>
                {list.map((d) => {
                  const tour = data.tours.get(d.tourId);
                  const guide = GUIDES.find((g) => g.id === d.guideId);
                  const vehicle = VEHICLES.find((v) => v.id === d.vehicleId);
                  const crossed = data.crossed.has(d.id);
                  const cancelled = d.status === "cancelada";
                  const full = d.state === "llena";
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => onOpen(d.id)}
                      className={cn(
                        "pressable relative flex flex-col gap-1.5 rounded-field bg-ink/7 px-2.5 py-2 text-left hover:bg-ink/14",
                        crossed && "bg-destructive/12 hover:bg-destructive/20",
                        cancelled && "opacity-55",
                      )}
                    >
                      <span className="flex items-baseline justify-between gap-2">
                        <span className={cn("font-display text-[20px] font-bold leading-none tabular", cancelled && "line-through")}>{formatTime24(d.startsAt)}</span>
                        <span className={cn("text-[13px] font-semibold tabular", full ? "text-destructive" : "text-ink-soft")}>
                          {cancelled ? "Cancelada" : `${d.seatsTaken}/${d.capacity}`}
                        </span>
                      </span>
                      <span className="flex min-w-0 items-baseline gap-1.5">
                        <span className="font-display text-[15px] font-bold uppercase">{data.refs.get(d.id)}</span>
                        <span className={cn("truncate text-[14px] font-semibold", crossed && "text-destructive")}>{tour?.shortName}</span>
                        {d.status === "cerrada" ? <Lock className="size-3 shrink-0" aria-label="Cerrada" /> : null}
                      </span>
                      <span className="flex gap-1.5 text-[12px] font-semibold">
                        <span className={cn("rounded-full px-1.5 py-0.5", guide ? "bg-ink/10" : "bg-destructive/15 text-destructive")} title={guide?.name ?? "Sin guía"}>
                          {guide ? initials(guide.name) : "Sin guía"}
                        </span>
                        <span
                          className={cn("truncate rounded-full px-1.5 py-0.5", vehicle || !(tour && needsTransport(tour)) ? "bg-ink/10" : "bg-destructive/15 text-destructive")}
                          title={vehicle?.name ?? "Sin vehículo"}
                        >
                          {vehicle ? vehicleShort(vehicle.name) : tour && !needsTransport(tour) ? "En el lugar" : "Sin vehículo"}
                        </span>
                      </span>
                      {!cancelled ? <SeatMeter taken={d.seatsTaken} capacity={d.capacity} tone={full ? "stamp" : "ink"} /> : null}
                    </button>
                  );
                })}
                {!past ? (
                  <button
                    type="button"
                    onClick={() => onNew(key)}
                    className="pressable mt-auto flex h-9 items-center justify-center gap-1 rounded-full text-[13px] font-semibold text-ink-soft hover:bg-ink/8 hover:text-ink"
                  >
                    <Plus className="size-4" /> Salida
                  </button>
                ) : null}
              </div>
            );
          })}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
