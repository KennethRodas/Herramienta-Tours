"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import type { Tour } from "@/lib/domain/types";
import { guideById, meetingPointById, tourById } from "@/content/catalog";
import { formatDayLong, formatDayShort, formatTime, formatUsd, plural } from "@/lib/domain/format";
import { useDeparture, useTours, type DepartureView } from "@/lib/sim/hooks";
import { MeetingPointMap } from "@/components/map";
import { BottomSheet } from "@/components/motion/bottom-sheet";
import { AnimatedNumber } from "@/components/motion/animated-number";
import { buttonClass } from "@/components/ui/button";
import { BoletoStrip } from "./boleto-strip";
import { useBookingFlow, type BookingFlow, type FormState } from "./booking-flow";
import { BookingPanel } from "./booking-panel";
import { cx } from "./cx";
import { HoldBand } from "./hold-band";
import { PhotoPlate } from "./photo-plate";
import { Field, PaperStyles, SplitTicket, Stamp } from "./paper";
import { useMedia } from "./use-media";
import { devWorstCase, WORST_FORM } from "./worst-case";

// /salidas/[id]: the departure (PRD: horario, precio, punto de encuentro,
// cupos restantes, guía) next to the booking panel.

export function DepartureBooking({ id, worst = false }: { id: string; worst?: boolean }) {
  const dep = useDeparture(id);
  const tours = useTours({ includeInactive: true });

  if (dep === undefined) return <DetailSkeleton />;
  if (dep === null) return <Missing />;
  const tour = tours.find((t) => t.id === dep.tourId) ?? tourById(dep.tourId);
  if (!tour) return <Missing />;
  return <Loaded key={dep.id} dep={dep} tour={tour} prefill={devWorstCase && worst ? WORST_FORM : undefined} />;
}

function Loaded({ dep, tour, prefill }: { dep: DepartureView; tour: Tour; prefill?: FormState }) {
  const flow = useBookingFlow(dep, tour, prefill);
  const desktop = useMedia("(min-width: 1024px)");
  const [sheet, setSheet] = useState(false);

  return (
    <div className="mx-auto w-full max-w-[1240px] px-(--gutter) pt-8 lg:pt-12">
      <PaperStyles />
      <Link
        href={`/aventuras/${tour.slug}#salidas`}
        className="group -ml-3 inline-flex items-center gap-2 rounded-full px-3 py-2 text-body font-semibold transition-colors hover:bg-sand-300"
      >
        <ArrowLeft aria-hidden className="size-5 transition-transform duration-200 group-hover:-translate-x-1" strokeWidth={2.5} />
        Fechas de {tour.shortName}
      </Link>

      <div className="mt-8 grid grid-cols-[minmax(0,1fr)] items-start gap-10 sm:mt-4 lg:grid-cols-12 lg:gap-12">
        <div className="flex flex-col gap-12 lg:col-span-7">
          <DepartureTicket dep={dep} tour={tour} />
          {!desktop ? <MobileEntry flow={flow} onOpen={() => setSheet(true)} /> : null}
          {dep.notes ? (
            <p className="bk-rise rounded-field bg-sand-300 px-5 py-4 text-body leading-snug">
              <span className="font-semibold">Nota de Wilber:</span> {dep.notes}
            </p>
          ) : null}
          <PhotoPlate photo={tour.photo} className="aspect-[16/9] w-full" />
          <MeetingBlock dep={dep} tour={tour} />
        </div>

        {desktop ? (
          <StickyAside>
            <BookingPanel flow={flow} variant="inline" />
          </StickyAside>
        ) : (
          <BottomSheet
            open={sheet}
            onOpenChange={setSheet}
            snapPoints={[0.94]}
            title={`${tour.shortName} · ${formatDayLong(dep.startsAt)}`}
            className="paper print-corners max-w-xl rounded-t-ticket rounded-b-none border-0"
          >
            <BookingPanel flow={flow} variant="sheet" />
          </BottomSheet>
        )}
      </div>
    </div>
  );
}

function DepartureTicket({ dep, tour }: { dep: DepartureView; tour: Tour }) {
  const guide = guideById(dep.guideId);
  const arrival = formatTime(Date.parse(dep.startsAt) - tour.arriveMinutesBefore * 60_000);
  return (
    <SplitTicket
      as="article"
      split="sm"
      stubWidth="13.5rem"
      className="bk-rise"
      bodyClassName="px-5 pb-10 pt-6 sm:px-8 sm:pb-9 sm:pt-8"
      stubClassName="px-5 pb-6 pt-12 sm:flex sm:flex-col sm:justify-between sm:px-7 sm:py-8"
      body={
        <>
          <h1 className="flex flex-col gap-3">
            <span className="text-lead font-semibold leading-tight">{tour.name}</span>
            <span className="sr-only">{formatDayLong(dep.startsAt)}</span>
            <span aria-hidden className="font-display text-[min(var(--step-display),7.5rem)] font-bold uppercase leading-[0.82] tracking-[-0.02em]">
              {formatDayShort(dep.startsAt)}
            </span>
          </h1>
          <dl className="mt-7 grid grid-cols-2 gap-x-6 gap-y-5">
            <Field label="Salida">
              <span className="tabular">{formatTime(dep.startsAt)}</span>
            </Field>
            <Field label="Regreso aprox.">
              <span className="tabular">{formatTime(dep.endsAt)}</span>
            </Field>
            <Field label="Llegar a las">
              <span className="tabular">{arrival}</span>
            </Field>
            <Field label="Guía">{guide ? guide.name : "Por asignar"}</Field>
          </dl>
        </>
      }
      stub={
        <div className="flex items-end justify-between gap-6 sm:h-full sm:flex-col sm:items-start">
          <p className="flex flex-col">
            <span className="tabular font-display text-head font-bold leading-none">{formatUsd(dep.priceUsd)}</span>
            <span className="text-small">por persona</span>
          </p>
          <p className="flex flex-col items-end sm:items-start" aria-live="polite">
            <AnimatedNumber value={dep.left} format={(n) => String(Math.round(n))} className="font-display text-head font-bold leading-none" />
            <span className="text-small">
              {dep.left === 1 ? "cupo libre" : "cupos libres"} de <span className="tabular">{dep.capacity}</span>
            </span>
          </p>
        </div>
      }
    />
  );
}

function MobileEntry({ flow, onOpen }: { flow: BookingFlow; onOpen: () => void }) {
  const { dep } = flow;
  const mine = flow.holdLive && flow.hold ? flow.hold.partySize : 0;
  const blocked = flow.closed && !(flow.closed === "llena" && flow.holdLive);
  return (
    <section aria-label="Reservar" className="flex flex-col gap-3">
      <div className="paper print-corners overflow-hidden">
        <HoldBand flow={flow} />
        <div className="flex flex-col gap-4 px-4 py-5 sm:px-5">
          <BoletoStrip capacity={dep.capacity} taken={dep.seatsTaken} held={flow.othersHeld} selected={mine} size="md" />
          {blocked ? (
            <div className="flex flex-col gap-4">
              <Stamp className="self-start">{flow.closed === "llena" ? "Llena" : "Cerrada"}</Stamp>
              <p className="text-body font-semibold">
                {flow.closed === "llena" ? "Esta salida se llenó." : flow.closed === "tarde" ? "Esta salida ya no recibe reservas en línea." : "Esta salida no recibe reservas."}
              </p>
              <Link href={`/aventuras/${flow.tour.slug}#salidas`} className={buttonClass("primary", "lg", "w-full")}>
                Ver otras fechas
              </Link>
            </div>
          ) : (
            <button type="button" onClick={onOpen} className={buttonClass("primary", "lg", "h-14 w-full")}>
              {flow.hold ? "Seguir con la reserva" : `Reservar · ${plural(dep.left, "cupo libre", "cupos libres")}`}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function MeetingBlock({ dep, tour }: { dep: DepartureView; tour: Tour }) {
  const point = meetingPointById(dep.meetingPointId);
  if (!point) return null;
  const arrival = formatTime(Date.parse(dep.startsAt) - tour.arriveMinutesBefore * 60_000);
  return (
    <section aria-labelledby="encuentro-salida" className="flex flex-col gap-5">
      <h2 id="encuentro-salida" className="font-display text-head font-bold uppercase">
        Punto de encuentro
      </h2>
      <div className="paper print-corners flex flex-col overflow-hidden">
        <MeetingPointMap point={point} className="h-72 w-full sm:h-80" />
        <div className="flex flex-col gap-5 px-5 py-6 sm:flex-row sm:items-end sm:justify-between sm:px-7">
          <div className="flex min-w-0 flex-col gap-2">
            <p className="text-lead font-semibold leading-tight">{point.name}</p>
            <p className="text-body leading-snug">
              {point.address}, {point.city}
            </p>
            <p className="text-body leading-snug">{point.instructions}</p>
            <p className="text-body leading-snug">
              Llegar a las <span className="tabular font-semibold">{arrival}</span>
            </p>
          </div>
          <a href={point.mapsUrl} target="_blank" rel="noreferrer" className={buttonClass("primary", "md", "shrink-0")}>
            Cómo llegar
          </a>
        </div>
      </div>
    </section>
  );
}

function DetailSkeleton() {
  return (
    <div aria-busy="true" aria-label="Cargando salida" className="mx-auto w-full max-w-[1240px] px-(--gutter) pt-8 lg:pt-12">
      <PaperStyles />
      <div className="bk-skeleton h-10 w-56 rounded-full bg-sand-300" />
      <div className="mt-4 grid gap-10 lg:grid-cols-12 lg:gap-12">
        <div className="flex flex-col gap-6 lg:col-span-7">
          <div className="bk-skeleton h-72 rounded-ticket bg-sand-50" />
          <div className="bk-skeleton h-80 rounded-ticket bg-sand-50" style={{ animationDelay: "160ms" }} />
        </div>
        <div className="bk-skeleton hidden h-[520px] rounded-ticket bg-sand-50 lg:col-span-5 lg:block" style={{ animationDelay: "80ms" }} />
      </div>
    </div>
  );
}

function Missing() {
  return (
    <div className="mx-auto flex w-full max-w-[1240px] flex-col items-start gap-6 px-(--gutter) pt-16">
      <h1 className="font-display text-head font-bold uppercase">Salida no encontrada</h1>
      <p className="text-lead">Esta salida no existe o ya no está publicada.</p>
      <Link href="/aventuras" className={cx(buttonClass("primary", "lg"))}>
        Ver aventuras
      </Link>
    </div>
  );
}

/**
 * The booking panel follows the page while the left column scrolls. When a step
 * is taller than the window it sticks by its bottom edge instead of its top, so
 * the step's action is always reachable and nothing scrolls inside the panel.
 */
function StickyAside({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const place = () => {
      el.style.top = `min(6rem, calc(100dvh - ${el.offsetHeight}px - 1.5rem))`;
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <aside ref={ref} aria-label="Reserva" className="sticky top-24 self-start lg:col-span-5">
      {children}
    </aside>
  );
}
