import Image from "next/image";
import type { MeetingPoint, Tour } from "@/lib/domain/types";
import { DIFFICULTY_LABEL, DIFFICULTY_NOTE, DIFFICULTY_ORDER } from "@/content/catalog";
import type { PhotoCredit } from "@/content/photo-credits";
import { formatDuration, formatKm, formatMeters, formatTime, formatUsd, svISO } from "@/lib/domain/format";
import { MeetingPointMap, RouteMap } from "@/components/map";
import { buttonClass } from "@/components/ui/button";
import { cx as cn } from "./cx";
import { Field, PaperStyles, SplitTicket } from "./paper";
import { Reveal } from "./reveal";

// Server-rendered parts of /aventuras/[slug]: everything here comes from the
// catalog, so the page is complete for search engines before any live data.

/** "4:45 a. m." for a tour that leaves at 05:00 and asks for 15 minutes. */
export function arrivalFor(tour: Pick<Tour, "departureTime" | "arriveMinutesBefore">) {
  const start = Date.parse(svISO("2026-01-01", tour.departureTime));
  return formatTime(start - tour.arriveMinutesBefore * 60_000);
}

export function PhotoCreditLine({ photo, className }: { photo: PhotoCredit; className?: string }) {
  return (
    <p className={cn("text-small leading-snug", className)}>
      Foto:{" "}
      <a href={photo.sourceUrl} className="underline decoration-1 underline-offset-2 hover:decoration-2" target="_blank" rel="noreferrer">
        {photo.author}
      </a>
      {" · "}
      <a href={photo.licenceUrl} className="underline decoration-1 underline-offset-2 hover:decoration-2" target="_blank" rel="noreferrer">
        {photo.licence}
      </a>
      {" · Wikimedia Commons"}
    </p>
  );
}

function DifficultyMeter({ level }: { level: Tour["difficulty"] }) {
  const at = DIFFICULTY_ORDER.indexOf(level);
  return (
    <span aria-hidden className="inline-flex gap-1 align-middle">
      {DIFFICULTY_ORDER.map((d, i) => (
        <span key={d} className={cn("inline-block h-3.5 w-2.5", i <= at ? "bg-cobalt-800" : "bg-sand-300")} />
      ))}
    </span>
  );
}

export function TourHeader({ tour, photo }: { tour: Tour; photo: PhotoCredit }) {
  return (
    <header className="relative">
      <PaperStyles />
      <div className="relative h-[42svh] min-h-64 w-full overflow-hidden bg-sand-300 lg:h-[64svh] lg:max-h-[720px]">
        <Image
          src={photo.src}
          alt={photo.alt}
          fill
          priority
          sizes="100vw"
          className="bk-photo object-cover"
          style={{ objectPosition: photo.height > photo.width ? "50% 62%" : "50% 50%" }}
        />
        <div className="absolute right-(--gutter) top-3 bg-sand-50 px-2.5 py-1 text-cobalt-800">
          <PhotoCreditLine photo={photo} />
        </div>
      </div>

      <div className="relative mx-auto -mt-16 max-w-[1240px] px-(--gutter) lg:-mt-36">
        <SplitTicket
          as="article"
          className="bk-rise"
          stubWidth="20rem"
          bodyClassName="px-5 pb-8 pt-7 sm:px-8 lg:px-12 lg:pb-12 lg:pt-11"
          stubClassName="px-5 pb-6 pt-7 sm:px-8 lg:flex lg:flex-col lg:justify-between lg:px-9 lg:py-11"
          body={
            <>
              <h1 className="font-display text-[min(var(--step-head),8.2vw)] font-bold uppercase leading-[0.9] tracking-[-0.015em] sm:text-head">
                {tour.name}
              </h1>
              <dl className="mt-7 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:mt-10 lg:gap-x-10">
                <Field label="Dificultad" className="col-span-2 sm:col-span-3">
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <DifficultyMeter level={tour.difficulty} />
                    <span>{DIFFICULTY_LABEL[tour.difficulty]}</span>
                    <span className="font-normal">{DIFFICULTY_NOTE[tour.difficulty]}</span>
                  </span>
                </Field>
                <Field label="Duración">
                  <span className="tabular">{formatDuration(tour.durationHours)}</span>
                </Field>
                <Field label="Distancia">
                  <span className="tabular">{formatKm(tour.distanceKm)}</span>
                </Field>
                <Field label="Desnivel">
                  <span className="tabular">{formatMeters(tour.elevationGainM)}</span>
                </Field>
                <Field label="Altitud máxima">
                  <span className="tabular">{formatMeters(tour.maxAltitudeM)}</span>
                </Field>
                <Field label="Edad mínima">
                  <span className="tabular">{tour.minAge} años</span>
                </Field>
                <Field label="Departamento">{tour.region}</Field>
              </dl>
            </>
          }
          stub={
            <div className="flex items-end justify-between gap-4 lg:h-full lg:flex-col lg:items-start">
              <p className="flex flex-col">
                <span className="tabular font-display text-[min(var(--step-display),8.5rem)] font-bold leading-[0.8] tracking-[-0.02em]">
                  {formatUsd(tour.priceUsd)}
                </span>
                <span className="mt-2 text-body">por persona</span>
              </p>
              <a href="#salidas" className={buttonClass("primary", "md", "w-auto lg:w-full")}>
                Ver fechas
              </a>
            </div>
          }
        />
      </div>
    </header>
  );
}

export function RouteSection({ tour }: { tour: Tour }) {
  return (
    <Reveal as="section" aria-labelledby="ruta" className="mx-auto grid w-full max-w-[1240px] grid-cols-[minmax(0,1fr)] gap-8 px-(--gutter) lg:grid-cols-12 lg:gap-10">
      <div className="lg:col-span-5 lg:pt-2">
        <h2 id="ruta" className="font-display text-head font-bold uppercase">
          Ruta
        </h2>
        <p className="mt-5 max-w-[46ch] text-lead leading-snug">{tour.description}</p>
        <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-4">
          <Field label="Inicio">{tour.route.waypoints[0]?.name}</Field>
          {tour.route.waypoints.length > 1 ? <Field label="Punto más alto">{highest(tour)}</Field> : null}
        </dl>
      </div>
      <div className="lg:col-span-7">
        <RouteMap tour={tour} flyover className="h-[62svh] w-full lg:aspect-[7/5] lg:h-auto" />
      </div>
    </Reveal>
  );
}

function highest(tour: Tour) {
  const top = [...tour.route.waypoints].filter((w) => w.altitude !== undefined).sort((a, b) => (b.altitude ?? 0) - (a.altitude ?? 0))[0];
  return top ? `${top.name}, ${formatMeters(top.altitude ?? 0)}` : formatMeters(tour.maxAltitudeM);
}

export function ItinerarySection({ tour }: { tour: Tour }) {
  return (
    <section aria-labelledby="itinerario" className="mx-auto grid w-full max-w-[1240px] grid-cols-[minmax(0,1fr)] items-start gap-10 px-(--gutter) lg:grid-cols-12">
      <Reveal className="lg:col-span-6 xl:col-span-5">
        <h2 id="itinerario" className="font-display text-head font-bold uppercase">
          Itinerario
        </h2>
        <div className="paper edge-zigzag-b mt-6 px-6 pb-12 pt-7 sm:px-9">
          <ol className="flex flex-col gap-3.5">
            {tour.itinerary.map((step) => (
              <li key={`${step.time}-${step.label}`} className="flex items-baseline text-body">
                <span className="min-w-0">{step.label}</span>
                <span aria-hidden className="dot-leader" />
                <span className="tabular shrink-0 font-semibold">{step.time}</span>
              </li>
            ))}
          </ol>
          <p className="field-ink -mx-6 mt-7 flex h-11 items-center justify-between px-6 text-body font-semibold sm:-mx-9 sm:px-9">
            <span>Duración total</span>
            <span className="tabular">{formatDuration(tour.durationHours)}</span>
          </p>
        </div>
      </Reveal>

      <div className="grid gap-10 sm:grid-cols-2 lg:col-span-6 lg:col-start-7 lg:grid-cols-1 xl:col-span-6 xl:col-start-7 xl:grid-cols-2 xl:gap-6">
        <Reveal>
          <h2 id="que-llevar" className="font-display text-head font-bold uppercase">
            Qué llevar
          </h2>
          <div className="bk-tag paper mt-6 px-6 pb-7 pt-14 sm:px-8">
            <ul className="flex flex-col gap-3">
              {tour.bring.map((item) => (
                <li key={item} className="flex gap-3 text-body leading-snug">
                  <span aria-hidden className="mt-[0.45em] inline-block size-2.5 shrink-0 bg-cobalt-800" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
        <Reveal>
          <h2 id="incluye" className="font-display text-head font-bold uppercase">
            Incluye
          </h2>
          <div className="field-ink mt-6 px-6 py-7 sm:px-8">
            <ul className="flex flex-col gap-3">
              {tour.includes.map((item) => (
                <li key={item} className="flex gap-3 text-body leading-snug">
                  <svg aria-hidden viewBox="0 0 24 24" className="mt-[0.2em] size-[1.05em] shrink-0" fill="none">
                    <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function MeetingSection({ tour, point }: { tour: Tour; point: MeetingPoint }) {
  return (
    <Reveal as="section" aria-labelledby="encuentro" className="mx-auto w-full max-w-[1240px] px-(--gutter)">
      <h2 id="encuentro" className="font-display text-head font-bold uppercase">
        Punto de encuentro
      </h2>
      <div className="relative mt-6">
        <MeetingPointMap point={point} className="h-[48svh] min-h-72 w-full lg:h-[560px]" />
        <div className="paper relative z-10 mx-3 -mt-12 px-6 py-7 sm:mx-6 sm:px-8 lg:absolute lg:right-8 lg:top-8 lg:m-0 lg:w-[380px]">
          <p className="text-lead font-semibold leading-tight">{point.name}</p>
          <p className="mt-2 text-body leading-snug">
            {point.address}
            <br />
            {point.city}
          </p>
          <p className="mt-4 text-body leading-snug">{point.instructions}</p>
          <dl className="mt-6 flex gap-10">
            <Field label="Salida">
              <span className="tabular">{formatTime(Date.parse(svISO("2026-01-01", tour.departureTime)))}</span>
            </Field>
            <Field label="Llegar a las">
              <span className="tabular">{arrivalFor(tour)}</span>
            </Field>
          </dl>
          <a href={point.mapsUrl} target="_blank" rel="noreferrer" className={buttonClass("primary", "md", "mt-7 w-full")}>
            Cómo llegar
          </a>
        </div>
      </div>
    </Reveal>
  );
}
