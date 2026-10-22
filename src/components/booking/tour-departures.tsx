"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { ArrowRight } from "lucide-react";
import type { Tour } from "@/lib/domain/types";
import { BUSINESS } from "@/content/catalog";
import { BOOKING_CUTOFF_MS, DEPARTURE_STATE_LABEL, isBookable } from "@/lib/domain/availability";
import { DAY, formatDayShort, formatMonth, formatRelativeDay, formatTime, formatUsd, svParts, waLink } from "@/lib/domain/format";
import { useNow, useTourDepartures, useTours, type DepartureView } from "@/lib/sim/hooks";
import { buttonClass } from "@/components/ui/button";
import { cx as cn } from "./cx";
import { BoletoStrip } from "./boleto-strip";
import { PaperStyles, Stamp } from "./paper";

// "Próximas salidas": the departures of one tour as a stack of boletos.
// PRD: only future dates; full or closed ones stay visible but cannot be chosen.

const NOTCH_10 = { "--n": "10px" } as CSSProperties;

export function TourDepartures({ tour }: { tour: Pick<Tour, "id" | "name" | "slug"> }) {
  const departures = useTourDepartures(tour.id, 12);
  const live = useTours({ includeInactive: true }).find((t) => t.id === tour.id);
  const now = useNow(30_000);

  return (
    <section id="salidas" aria-labelledby="salidas-titulo" className="mx-auto w-full max-w-[1240px] scroll-mt-28 px-(--gutter)">
      <PaperStyles />
      <h2 id="salidas-titulo" className="font-display text-head font-bold uppercase">
        Próximas salidas
      </h2>
      <div className="mt-6">
        {departures === null || now === null ? (
          <SkeletonRows />
        ) : live && !live.active ? (
          <EmptyNote text="Este tour está en pausa." tourName={tour.name} />
        ) : departures.length === 0 ? (
          <EmptyNote text="No hay salidas programadas." tourName={tour.name} />
        ) : (
          <DepartureList departures={departures} now={now} />
        )}
      </div>
    </section>
  );
}

function DepartureList({ departures, now }: { departures: DepartureView[]; now: number }) {
  const thisMonth = svParts(now).month;
  return (
    <ol className="flex flex-col gap-2">
      {departures.map((d, i) => {
        const month = formatMonth(d.startsAt);
        const previous = i > 0 ? formatMonth(departures[i - 1].startsAt) : null;
        const showMonth = previous ? previous !== month : svParts(d.startsAt).month !== thisMonth;
        return (
          <li key={d.id} className="bk-rise" style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}>
            {showMonth ? <p className={cn("mb-2 font-display text-lead font-semibold uppercase", i > 0 && "mt-6")}>{month}</p> : null}
            <DepartureRow d={d} now={now} />
          </li>
        );
      })}
    </ol>
  );
}

function DepartureRow({ d, now }: { d: DepartureView; now: number }) {
  const start = Date.parse(d.startsAt);
  const lateForWeb = start - BOOKING_CUTOFF_MS <= now;
  const bookable = isBookable(d.state) && !lateForWeb;
  const held = Math.max(0, d.capacity - d.seatsTaken - d.left);
  const soon = start - now < 7 * DAY;
  const label = lateForWeb && isBookable(d.state) ? "Solo por WhatsApp" : DEPARTURE_STATE_LABEL[d.state];
  const stamped = d.state === "llena" || d.state === "cerrada";

  const body = (
    <>
      <div className="flex min-w-0 flex-1 flex-col gap-3 py-4 pl-6 pr-5 sm:flex-row sm:items-center sm:gap-6 sm:pl-8 sm:pr-6">
        <p className="flex min-w-0 flex-wrap items-baseline gap-x-3 sm:w-56 sm:flex-col sm:items-start sm:gap-0">
          <span className="font-display text-lead font-bold uppercase leading-none tracking-[-0.005em]">{formatDayShort(d.startsAt)}</span>
          <span className="whitespace-nowrap sm:mt-1">
            <span className="text-body">{formatTime(d.startsAt)}</span>
            {soon ? <span className="text-small text-ink-soft"> · {formatRelativeDay(d.startsAt, now)}</span> : null}
          </span>
        </p>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <BoletoStrip capacity={d.capacity} taken={d.seatsTaken} held={held} size="sm" />
          <p className="text-body">
            <span className="tabular font-semibold text-ink">{d.left}</span> de <span className="tabular">{d.capacity}</span> libres
          </p>
        </div>
        <p className="tabular text-lead font-semibold sm:w-20 sm:text-right">{formatUsd(d.priceUsd)}</p>
      </div>
      <div
        className={cn(
          "relative flex shrink-0 items-center justify-between gap-3 py-3 pl-6 pr-6 sm:w-44 sm:flex-col sm:items-start sm:justify-center sm:pl-6",
          bookable && "transition-colors duration-200 group-hover:bg-cobalt-800 group-hover:text-sand-50 group-focus-visible:bg-cobalt-800 group-focus-visible:text-sand-50",
        )}
      >
        <span aria-hidden className="perforation-x absolute inset-x-3 -top-[5px] sm:hidden" />
        <span aria-hidden className="perforation-y absolute inset-y-3 -left-[5px] hidden sm:block" />
        <span className={cn("text-body font-semibold leading-tight", !bookable && "text-ink-soft", stamped && "sr-only")}>{label}</span>
        {bookable ? (
          <span className="inline-flex items-center gap-1.5 text-small font-semibold">
            Elegir
            <ArrowRight aria-hidden className="size-4 transition-transform duration-200 group-hover:translate-x-1" strokeWidth={2.5} />
          </span>
        ) : null}
        {stamped ? (
          <Stamp className="pointer-events-none my-1 text-body sm:my-0">{DEPARTURE_STATE_LABEL[d.state]}</Stamp>
        ) : null}
      </div>
    </>
  );

  const shell = "ticket-notch group relative flex flex-col overflow-hidden rounded-ticket text-ink sm:flex-row sm:items-stretch";
  if (bookable) {
    return (
      <Link
        href={`/salidas/${d.id}`}
        style={NOTCH_10}
        className={cn(shell, "bg-sand-50 outline-offset-4 transition-transform duration-150 ease-(--ease-out) active:scale-[0.99]")}
        aria-label={`${formatDayShort(d.startsAt)}, ${formatTime(d.startsAt)}, ${d.left} de ${d.capacity} cupos libres. ${formatUsd(d.priceUsd)} por persona. ${label}.`}
      >
        {body}
      </Link>
    );
  }
  return (
    <div className={cn(shell, "bg-sand-50")} style={NOTCH_10} aria-disabled="true">
      {body}
    </div>
  );
}

function EmptyNote({ text, tourName }: { text: string; tourName: string }) {
  return (
    <div className="paper flex flex-col items-start gap-5 px-6 py-7 sm:flex-row sm:items-center sm:justify-between sm:px-8">
      <p className="text-lead font-semibold">{text}</p>
      <a href={waLink(BUSINESS.whatsapp, `Fechas para ${tourName}`)} target="_blank" rel="noreferrer" className={buttonClass("primary", "md")}>
        Preguntar fechas por WhatsApp
      </a>
    </div>
  );
}

function SkeletonRows() {
  return (
    <div aria-busy="true" aria-label="Cargando salidas" className="flex flex-col gap-2">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="bk-skeleton ticket-notch flex h-[88px] items-center gap-6 rounded-ticket bg-sand-50 px-8" style={{ ...NOTCH_10, animationDelay: `${i * 120}ms` }}>
          <span className="h-5 w-28 rounded-full bg-sand-300" />
          <span className="hidden h-5 w-60 rounded-full bg-sand-300 sm:block" />
          <span className="ml-auto h-5 w-14 rounded-full bg-sand-300" />
        </div>
      ))}
    </div>
  );
}
