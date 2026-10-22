"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { BoletoStrip } from "@/components/booking/boleto-strip";
import { NumberTicker } from "@/components/motion/number-ticker";
import { LiquidTabBar } from "@/components/nav/liquid-tabbar";
import { Button } from "@/components/ui/button";
import { DIFFICULTY_LABEL, DIFFICULTY_NOTE, DIFFICULTY_ORDER } from "@/content/catalog";
import { PHOTO_CREDITS } from "@/content/photo-credits";
import { formatDayShort, formatDuration, formatKm, formatTime, formatUsd, plural } from "@/lib/domain/format";
import type { Difficulty, Tour } from "@/lib/domain/types";
import { EASE_OUT } from "@/lib/ease";
import { useHydrated, useNextDepartures, useTours, type DepartureView } from "@/lib/sim/hooks";
import { EmptyCatalog } from "./empty-catalog";
import { PreviewFrame } from "./preview-frame";
import { useReveal } from "./reveal";

// /aventuras: the full menu sheet. Every active tour with what the PRD asks
// for (name, duration, difficulty, price, a short description) plus its usual
// days and the next departure with seats, read live from the simulation.
// The difficulty filter is the liquid-glass segmented control, synced to
// ?dificultad= so a filtered list can be shared.

export type CatalogFilter = "todas" | Difficulty;

const FILTER_TABS = [
  { id: "todas", label: "Todas" },
  ...DIFFICULTY_ORDER.map((d) => ({ id: d, label: DIFFICULTY_LABEL[d] })),
];

const DAY_SHORT = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0];
const LIST = new Intl.ListFormat("es", { style: "long", type: "conjunction" });

function schedule(t: Tour) {
  const days = LIST.format(MONDAY_FIRST.filter((d) => t.weekdays.includes(d)).map((d) => DAY_SHORT[d]));
  const [h, m] = t.departureTime.split(":").map(Number);
  const time = `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h < 12 ? "a. m." : "p. m."}`; // taste-skill-ignore: clock minutes
  return `${days.charAt(0).toUpperCase()}${days.slice(1)}, ${time}`;
}

export function Catalog({ initialFilter }: { initialFilter: CatalogFilter }) {
  const hydrated = useHydrated();
  const tours = useTours();
  const next = useNextDepartures();
  const reduce = useReducedMotion();
  const [filter, setFilter] = useState<CatalogFilter>(initialFilter);
  const [activeId, setActiveId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useReveal(ref);

  const choose = (id: string) => {
    const value = id as CatalogFilter;
    setFilter(value);
    const url = new URL(window.location.href);
    if (value === "todas") url.searchParams.delete("dificultad");
    else url.searchParams.set("dificultad", value);
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  };

  // Rows come and go with the filter: let scroll-linked pieces measure again.
  useEffect(() => {
    const frame = requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => cancelAnimationFrame(frame);
  }, [filter, tours.length]);

  const empty = hydrated && tours.length === 0;
  const visible = filter === "todas" ? tours : tours.filter((t) => t.difficulty === filter);
  const groups = DIFFICULTY_ORDER.map((d) => ({ d, items: visible.filter((t) => t.difficulty === d) })).filter((g) => g.items.length > 0);
  const ordered = groups.flatMap((g) => g.items);

  const hours = tours.map((t) => t.durationHours);
  const prices = tours.map((t) => t.priceUsd);

  return (
    <div ref={ref}>
      <style>{CATALOG_CSS}</style>
      <section aria-labelledby="catalogo-titulo" className="mx-auto max-w-[1760px] px-[var(--gutter)] pt-8 pb-12 md:pt-12 md:pb-16">
        <h1
          id="catalogo-titulo"
          data-reveal
          className="font-display font-bold uppercase leading-[0.8] tracking-[-0.01em] [font-size:clamp(4rem,18vw,13rem)]"
        >
          Aventuras
        </h1>
        <div className="mt-8 flex flex-col gap-6 lg:mt-10 lg:flex-row lg:items-center lg:justify-between">
          <p data-reveal className="max-w-[44ch] text-body leading-snug">
            {tours.length
              ? `${plural(tours.length, "aventura", "aventuras")} de ${Math.min(...hours)} a ${Math.max(...hours)} horas. Precio por persona de ${formatUsd(Math.min(...prices))} a ${formatUsd(Math.max(...prices))}.`
              : "Sin aventuras activas por ahora."}
          </p>
          {!empty && (
            <div data-reveal className="catalog-filter -mx-2 w-auto sm:mx-0 sm:w-[560px] sm:max-w-full">
              <LiquidTabBar
                variant="segmented"
                tabs={FILTER_TABS}
                activeId={filter}
                onSelect={choose}
                ariaLabel="Filtrar por dificultad"
              />
            </div>
          )}
        </div>
      </section>

      <section aria-label="Lista de aventuras" className="ink-night bg-cobalt-950 text-ink">
        <div className="cat-wrap mx-auto max-w-[1760px] px-[var(--gutter)] py-[clamp(56px,7vw,120px)]">
          {!empty && ordered.length > 0 && (
            <div className="cat-frame-col">
              <div className="sticky top-[8svh] -ml-[var(--gutter)]">
                <div data-reveal="plate">
                  <PreviewFrame tours={ordered} activeId={activeId} boxClassName="h-[min(80svh,880px)]" captionClassName="pl-[var(--gutter)]" />
                </div>
              </div>
            </div>
          )}

          <div
            data-reveal="card"
            className="cat-sheet ink-paper edge-scallop-y w-full max-w-[760px] bg-sand-50 px-5 pt-12 pb-14 text-ink sm:px-10 md:px-14 md:pt-14"
          >
            <p className="text-center text-small">Precio por persona, en dólares. Tocá una aventura para ver sus fechas.</p>

            {empty ? (
              <EmptyCatalog />
            ) : ordered.length === 0 ? (
              <div role="status" className="flex flex-col items-center gap-5 py-12 text-center">
                <p className="text-body font-semibold">
                  No hay aventuras de dificultad {filter === "todas" ? "" : DIFFICULTY_LABEL[filter].toLowerCase()} por ahora.
                </p>
                <Button onClick={() => choose("todas")}>Ver todas las aventuras</Button>
              </div>
            ) : (
              <div className="cat-list">
                {groups.map(({ d, items }) => (
                  <div key={d} className="mt-12 first:mt-8">
                    <h2 className="text-center font-display text-lead font-bold uppercase leading-none">{DIFFICULTY_LABEL[d]}</h2>
                    <p className="mt-1.5 text-center text-small">{DIFFICULTY_NOTE[d]}</p>
                    <ul className="mt-5 flex flex-col">
                      <AnimatePresence initial={false} mode="popLayout">
                        {items.map((t) => (
                          <motion.li
                            key={t.id}
                            layout={reduce ? false : "position"}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.22, ease: EASE_OUT }}
                          >
                            <CatalogRow tour={t} next={next?.[t.id]} live={hydrated && next !== null} onActive={setActiveId} />
                          </motion.li>
                        ))}
                      </AnimatePresence>
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function CatalogRow({
  tour: t,
  next,
  live,
  onActive,
}: {
  tour: Tour;
  next: DepartureView | undefined;
  live: boolean;
  onActive: (id: string) => void;
}) {
  const photo = PHOTO_CREDITS[t.photo];
  const held = next ? Math.max(0, next.capacity - next.seatsTaken - next.left) : 0;
  return (
    <Link href={`/aventuras/${t.slug}`} className="cat-row" onPointerEnter={() => onActive(t.id)} onFocus={() => onActive(t.id)}>
      {photo && <Image src={photo.srcSmall} alt="" width={64} height={64} sizes="64px" className="cat-thumb size-16 object-cover" />}
      <span className="text-body font-semibold leading-tight">{t.name}</span>
      <span className="text-body font-semibold leading-tight tabular">{formatUsd(t.priceUsd)}</span>
      <span className="cat-span text-[17px] leading-snug">{t.summary}</span>
      <span className="cat-span flex flex-wrap gap-x-5 gap-y-1 text-small font-medium">
        <span>{DIFFICULTY_LABEL[t.difficulty]}</span>
        <span className="tabular">{formatDuration(t.durationHours)}</span>
        <span className="tabular">{formatKm(t.distanceKm)}</span>
        <span>{schedule(t)}</span>
      </span>
      <span className="cat-span mt-1 flex min-h-[26px] flex-wrap items-center gap-x-3 gap-y-1.5 text-small">
        {!live ? (
          <span aria-hidden className="h-3.5 w-48 bg-sand-200" />
        ) : next ? (
          <>
            <span className="font-semibold">
              Próxima salida {formatDayShort(next.startsAt)}, {formatTime(next.startsAt)}
            </span>
            <BoletoStrip size="sm" capacity={next.capacity} taken={next.seatsTaken} held={held} className="[&>div]:flex-nowrap [&>div]:pt-0" />
            <span className={next.left <= 3 ? "font-bold" : undefined}>
              <NumberTicker value={next.left} /> de {next.capacity} libres
            </span>
          </>
        ) : (
          <span className="font-semibold">Sin salidas con cupos por ahora.</span>
        )}
      </span>
    </Link>
  );
}

const CATALOG_CSS = `
/* In the page the segmented control lies flat on the ground, so it drops the floating
   depth and the blur; its inset highlights and the liquid lens on press stay. */
.catalog-filter .lg-inner {
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.7), inset 0 0 0 1px rgb(6 43 138 / 0.08); /* taste-skill-ignore: inset only, removes the resting drop */
  -webkit-backdrop-filter: none; backdrop-filter: none; /* taste-skill-ignore: removes the blur */
}
.catalog-filter .lg-segmented .lg-item { padding: 0 6px; }
@media (max-width: 479px) { .catalog-filter .lg-segmented .lg-item { font-size: 14px; padding: 0 2px; } }
.cat-wrap { display: grid; justify-items: center; }
.cat-frame-col { display: none; }
.cat-row {
  display: grid; grid-template-columns: 4rem minmax(0, 1fr) auto; column-gap: 14px; row-gap: 4px; align-items: baseline;
  padding: 14px 8px; margin: 0 -8px;
  transition: opacity var(--dur-fast) ease, background-color var(--dur-fast) ease, transform var(--dur-press) var(--ease-out);
}
.cat-row:active { transform: scale(0.985); }
.cat-thumb { grid-row: span 4; align-self: start; }
.cat-span { grid-column: 2 / -1; }
@media (hover: hover) and (pointer: fine) {
  .cat-row:hover { background-color: var(--sand-100); }
  .cat-list:hover .cat-row:not(:hover) { opacity: 0.38; }
}
@media (min-width: 1024px) and (hover: hover) and (pointer: fine) {
  .cat-wrap { grid-template-columns: minmax(0, 1fr) minmax(0, 760px); column-gap: clamp(40px, 5vw, 112px); align-items: start; justify-items: stretch; }
  .cat-frame-col { display: block; align-self: stretch; }
  .cat-sheet:only-child { grid-column: 1 / -1; justify-self: center; }
  .cat-thumb { display: none; }
  .cat-row { grid-template-columns: minmax(0, 1fr) auto; }
  .cat-span { grid-column: 1 / -1; }
}
`;
