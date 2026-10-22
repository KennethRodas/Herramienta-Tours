"use client";

import Link from "next/link";
import { useMemo } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { BoletoStrip } from "@/components/booking/boleto-strip";
import { NumberTicker } from "@/components/motion/number-ticker";
import { ButtonLink } from "@/components/ui/button";
import { BUSINESS, meetingPointById } from "@/content/catalog";
import { BOOKING_CUTOFF_MS, isBookable } from "@/lib/domain/availability";
import { formatDayShort, formatRelativeDay, formatTime, formatUsd, waLink } from "@/lib/domain/format";
import { EASE_OUT } from "@/lib/ease";
import { useDepartures, useHydrated, useNow, useTours } from "@/lib/sim/hooks";

const SHOWN = 3;

/**
 * The live part of the home page: the next three departures that still take
 * bookings, each with its strip of boletos (one per seat). Seats sold in any
 * other tab or by the simulation tear off here as they happen.
 */
export function HeroDepartures() {
  const hydrated = useHydrated();
  const tours = useTours();
  const departures = useDepartures();
  const now = useNow(30_000);
  const reduce = useReducedMotion();

  const rows = useMemo(() => {
    if (!departures || now === null) return null;
    const byId = new Map(tours.map((t) => [t.id, t]));
    return departures
      .filter((d) => isBookable(d.state) && byId.has(d.tourId) && Date.parse(d.startsAt) - now > BOOKING_CUTOFF_MS)
      .slice(0, SHOWN)
      .map((d) => ({ d, tour: byId.get(d.tourId)! }));
  }, [departures, tours, now]);

  if (!hydrated || rows === null || now === null) return <Skeleton />;

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-start gap-4 py-2">
        <p className="text-body font-semibold">
          {tours.length === 0 ? "No hay aventuras disponibles por ahora." : "No hay salidas con cupos por ahora."}
        </p>
        <ButtonLink href={waLink(BUSINESS.whatsapp, "Hola Wilber, ¿cuándo es la próxima salida?")} variant="quiet" target="_blank" rel="noopener noreferrer">
          Escribir a Wilber por WhatsApp
        </ButtonLink>
      </div>
    );
  }

  return (
    <ol aria-label="Próximas salidas con cupos" className="flex flex-col">
      <AnimatePresence initial={false} mode="popLayout">
        {rows.map(({ d, tour }, i) => {
          const meeting = meetingPointById(d.meetingPointId);
          const held = Math.max(0, d.capacity - d.seatsTaken - d.left);
          return (
            <motion.li
              key={d.id}
              layout={reduce ? false : "position"}
              initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(14px)" }}
              animate={{ opacity: 1, transform: "translateY(0px)" }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(-10px)" }}
              transition={{ duration: 0.34, ease: EASE_OUT }}
            >
              {i > 0 && <div aria-hidden className="perforation-x mx-3" style={{ ["--perf" as string]: "var(--cobalt-800)" }} />}
              <Link
                href={`/salidas/${d.id}`}
                className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-5 gap-y-1.5 px-3 py-4 transition-[background-color,transform] duration-[var(--dur-fast)] ease-[var(--ease-out)] hover:bg-sand-100 active:scale-[0.99] lg:grid-cols-[8.75rem_minmax(0,1fr)_auto_4.5rem] lg:gap-y-0 lg:py-3.5"
              >
                <span className="col-start-1 row-start-1 flex items-baseline gap-2 lg:block">
                  <span className="font-display text-lead font-bold uppercase leading-none">{formatDayShort(d.startsAt)}</span>
                  <span className="text-small lg:mt-1 lg:block">{formatRelativeDay(d.startsAt, now)}</span>
                </span>
                <span className="col-span-2 row-start-2 min-w-0 lg:col-span-1 lg:col-start-2 lg:row-start-1">
                  <span className="block text-body font-semibold leading-tight">{tour.name}</span>
                  <span className="mt-0.5 block text-small">
                    {formatTime(d.startsAt)}, {meeting?.name ?? "punto de encuentro"}
                  </span>
                </span>
                <span className="col-span-2 row-start-3 flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 lg:col-span-1 lg:col-start-3 lg:row-start-1 lg:flex-col lg:items-end lg:pt-0">
                  <BoletoStrip size="sm" capacity={d.capacity} taken={d.seatsTaken} held={held} className="[&>div]:flex-nowrap" />
                  <span className={d.left <= 3 ? "text-small font-bold" : "text-small"}>
                    <NumberTicker value={d.left} /> de {d.capacity} libres
                  </span>
                </span>
                <span className="col-start-2 row-start-1 text-right font-display text-lead font-bold leading-none tabular lg:col-start-4">
                  {formatUsd(d.priceUsd)}
                </span>
              </Link>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ol>
  );
}

function Skeleton() {
  return (
    <div aria-busy="true" className="flex flex-col">
      <span className="sr-only">Cargando las próximas salidas</span>
      {Array.from({ length: SHOWN }, (_, i) => (
        <div key={i}>
          {i > 0 && <div aria-hidden className="perforation-x mx-3" style={{ ["--perf" as string]: "var(--cobalt-800)" }} />}
          <div aria-hidden className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-5 gap-y-2 px-3 py-4 lg:grid-cols-[8.75rem_minmax(0,1fr)_15rem_4.5rem] lg:py-3.5">
            <span className="h-6 w-28 bg-sand-200" />
            <span className="col-span-2 row-start-2 flex flex-col gap-2 lg:col-span-1 lg:col-start-2 lg:row-start-1">
              <span className="h-5 w-[70%] bg-sand-200" />
              <span className="h-3.5 w-[45%] bg-sand-200" />
            </span>
            <span className="col-span-2 row-start-3 h-[22px] w-full max-w-[235px] bg-sand-200 lg:col-span-1 lg:col-start-3 lg:row-start-1 lg:justify-self-end" />
            <span className="col-start-2 row-start-1 h-6 w-12 justify-self-end bg-sand-200 lg:col-start-4" />
          </div>
        </div>
      ))}
    </div>
  );
}
