"use client";

import Link from "next/link";
import { useRef, useState, type KeyboardEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRightIcon } from "lucide-react";
import { TerrainMap } from "@/components/map";
import { Tooltip } from "@/components/motion/tooltip";
import { formatDuration, formatKm, formatMeters } from "@/lib/domain/format";
import type { Tour } from "@/lib/domain/types";
import { EASE_OUT, SPRING_LAYOUT } from "@/lib/ease";
import { useTours } from "@/lib/sim/hooks";
import { EmptyCatalog } from "../empty-catalog";
import { useReveal } from "../reveal";

// Mapa as a square plate: the terrain map on the left, three featured routes
// as plain tabs on the right, the facts a hiker compares, and two action cells.

const FEATURED = ["t-santa-ana", "t-izalco", "t-siete-cascadas"];

const cell =
  "pressable flex h-[60px] items-center justify-between gap-4 px-5 text-[17px] font-semibold sm:h-[72px] sm:px-6 focus-visible:outline-offset-[-4px]";

export function RoutePlate() {
  const tours = useTours();
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  useReveal(ref);

  const featured = FEATURED.map((id) => tours.find((t) => t.id === id)).filter((t): t is Tour => Boolean(t));
  const [activeId, setActiveId] = useState(FEATURED[0]);
  const active = featured.find((t) => t.id === activeId) ?? featured[0];

  const select = (id: string) => {
    if (FEATURED.includes(id)) setActiveId(id);
  };

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = featured[(i + (e.key === "ArrowRight" ? 1 : -1) + featured.length) % featured.length];
    setActiveId(next.id);
    document.getElementById(`plate-tab-${next.id}`)?.focus();
  };

  return (
    <section id="mapa" ref={ref} aria-labelledby="mapa-titulo" className="ink-paper bg-sand-300 text-ink">
      <h2 id="mapa-titulo" className="sr-only">
        Mapa de rutas
      </h2>
      <div className="mx-auto grid max-w-[1760px] gap-y-10 px-[var(--gutter)] py-[clamp(56px,7vw,112px)] lg:grid-cols-2 lg:gap-x-[clamp(40px,5vw,96px)]">
        <div data-reveal="plate" className="w-full self-start bg-sand-50 p-2.5 sm:p-3">
          {/* The embedded map is an interface fragment with its own label type. */}
          <div data-ui className="relative aspect-square w-full">
            <TerrainMap
              variant="card"
              tours={tours}
              focusTourId={active?.id}
              onSelectTour={select}
              className="absolute inset-0 h-full w-full"
            />
          </div>
        </div>

        {active ? (
          <div className="flex min-w-0 flex-col justify-between gap-10 lg:py-4">
            <div data-reveal role="tablist" aria-label="Rutas destacadas" className="flex flex-wrap gap-x-8 gap-y-2">
              {featured.map((t, i) => {
                const selected = t.id === active.id;
                return (
                  <button
                    key={t.id}
                    id={`plate-tab-${t.id}`}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    aria-controls="plate-panel"
                    tabIndex={selected ? 0 : -1}
                    onClick={() => setActiveId(t.id)}
                    onKeyDown={(e) => onKey(e, i)}
                    className="pressable relative pb-2.5 text-[17px] font-semibold"
                  >
                    {t.shortName}
                    {selected && (
                      <motion.span
                        layoutId="plate-tab-bar"
                        aria-hidden
                        className="absolute inset-x-0 bottom-0 h-1 bg-cobalt-800"
                        transition={reduce ? { duration: 0 } : SPRING_LAYOUT}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            <div data-reveal id="plate-panel" role="tabpanel" aria-labelledby={`plate-tab-${active.id}`}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={active.id}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(10px)" }}
                  animate={{ opacity: 1, transform: "translateY(0px)" }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(-6px)" }}
                  transition={{ duration: 0.2, ease: EASE_OUT }}
                >
                  <h3 className="font-display text-head font-bold uppercase leading-[0.92]">{active.name}</h3>
                  <p className="mt-6 max-w-[40ch] text-body leading-snug">{active.description}</p>
                  <dl className="mt-10 grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">
                    <Fact label="Duración" value={formatDuration(active.durationHours)} />
                    <Fact label="Distancia" value={formatKm(active.distanceKm)} />
                    <Fact label="Desnivel" value={formatMeters(active.elevationGainM)} hint="Metros de subida que se acumulan en todo el recorrido." />
                    <Fact label="Altitud máxima" value={formatMeters(active.maxAltitudeM)} hint="Punto más alto de la ruta, sobre el nivel del mar." />
                  </dl>
                </motion.div>
              </AnimatePresence>
            </div>

            <div data-reveal className="grid grid-cols-1 sm:grid-cols-2">
              <Link href={`/aventuras/${active.slug}`} className={`${cell} bg-cobalt-800 text-sand-50 hover:bg-cobalt-700`}>
                Ver ruta en 3D
                <ArrowRightIcon aria-hidden className="size-5" />
              </Link>
              <Link href="/mapa" className={`${cell} bg-sand-400 text-cobalt-800 hover:bg-sand-200`}>
                Mapa completo
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex flex-col justify-center gap-6">
            <EmptyCatalog align="start" />
            <Link href="/mapa" className={`${cell} max-w-sm bg-sand-400 text-cobalt-800 hover:bg-sand-200`}>
              Mapa completo
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

function Fact({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <dt className="text-small font-semibold">
        {hint ? (
          <Tooltip
            content={hint}
            side="top"
            className="max-w-[26ch] rounded-none border-0 bg-cobalt-900 px-3 py-2 text-[14px] leading-snug text-sand-50 shadow-none"
          >
            <button type="button" className="cursor-help underline decoration-dotted decoration-2 underline-offset-4">
              {label}
            </button>
          </Tooltip>
        ) : (
          label
        )}
      </dt>
      <dd className="font-display text-lead font-bold leading-none tabular">{value}</dd>
    </div>
  );
}
