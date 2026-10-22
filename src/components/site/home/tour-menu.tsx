"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { ButtonLink } from "@/components/ui/button";
import { BUSINESS, DIFFICULTY_LABEL, DIFFICULTY_NOTE, DIFFICULTY_ORDER } from "@/content/catalog";
import { PHOTO_CREDITS } from "@/content/photo-credits";
import { formatDuration, formatKm, formatUsd } from "@/lib/domain/format";
import { useHydrated, useTours } from "@/lib/sim/hooks";
import { EmptyCatalog } from "../empty-catalog";
import { PreviewFrame } from "../preview-frame";
import { useReveal } from "../reveal";

// Aventuras as Wilber's printed menu sheet: one tall sheet of paper with
// scalloped edges, grouped by difficulty, name left and price right.
// Signature move (index with preview): pointing at a row brings its photograph
// up in the fixed frame beside the sheet and dims the other rows. On touch
// screens each row carries its own thumbnail instead.

export function TourMenu() {
  const hydrated = useHydrated();
  const tours = useTours();
  const [activeId, setActiveId] = useState<string | null>(null);
  const ref = useRef<HTMLElement>(null);
  useReveal(ref);

  const empty = hydrated && tours.length === 0;
  const groups = DIFFICULTY_ORDER.map((d) => ({ d, items: tours.filter((t) => t.difficulty === d) })).filter((g) => g.items.length > 0);
  const ordered = groups.flatMap((g) => g.items);

  return (
    <section id="aventuras" ref={ref} aria-labelledby="aventuras-titulo" className="ink-night bg-cobalt-950 text-ink">
      <style>{MENU_CSS}</style>
      <div className="menu-wrap mx-auto max-w-[1760px] px-[var(--gutter)] py-[var(--section-gap)]">
        {!empty && (
          <div className="menu-frame-col">
            <div className="sticky top-[8svh]">
              <div data-reveal="plate">
                <PreviewFrame tours={ordered} activeId={activeId} boxClassName="h-[min(80svh,880px)]" />
              </div>
            </div>
          </div>
        )}

        <div
          data-reveal="card"
          className="menu-sheet ink-paper edge-scallop-y w-full max-w-[640px] rounded-ticket bg-sand-50 px-5 pt-12 pb-14 text-ink sm:px-10 md:px-16 md:pt-16 md:pb-16"
        >
          <h2 id="aventuras-titulo" className="text-center font-display text-head font-bold uppercase leading-none">
            Aventuras
          </h2>
          <p className="mt-3 text-center text-small">Precio por persona, en dólares.</p>

          {empty ? (
            <EmptyCatalog />
          ) : (
            <div className="menu-list">
              {groups.map(({ d, items }) => (
                <div key={d} className="mt-12 first:mt-10 md:mt-14">
                  <h3 className="text-center font-display text-lead font-bold uppercase leading-none">{DIFFICULTY_LABEL[d]}</h3>
                  <p className="mt-1.5 text-center text-small">{DIFFICULTY_NOTE[d]}</p>
                  <ul className="mt-5 flex flex-col gap-1">
                    {items.map((t) => {
                      const photo = PHOTO_CREDITS[t.photo];
                      return (
                        <li key={t.id} data-reveal="row">
                          <Link
                            href={`/aventuras/${t.slug}`}
                            className="menu-row"
                            onPointerEnter={() => setActiveId(t.id)}
                            onFocus={() => setActiveId(t.id)}
                          >
                            {photo && (
                              <Image src={photo.srcSmall} alt="" width={64} height={64} sizes="64px" className="menu-thumb size-16 rounded-field object-cover" />
                            )}
                            <span className="text-body font-semibold leading-tight">{t.name}</span>
                            <span className="text-body font-semibold leading-tight tabular">{formatUsd(t.priceUsd)}</span>
                            <span className="menu-meta text-[17px] leading-snug">
                              {t.summary} {formatDuration(t.durationHours)}, {formatKm(t.distanceKm)}.
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}

          <div className="mt-14 flex flex-col items-center gap-6 text-center">
            <p className="text-small leading-relaxed">
              <span className="block font-semibold">Horario de atención</span>
              {BUSINESS.hours.map((h) => (
                <span key={h.days} className="block">
                  {h.days}, {h.time.toLowerCase() === "en ruta" ? "en ruta" : h.time}
                </span>
              ))}
            </p>
            {!empty && <ButtonLink href="/aventuras">Ver fechas y cupos</ButtonLink>}
          </div>
        </div>
      </div>
    </section>
  );
}

const MENU_CSS = `
.menu-wrap { display: grid; justify-items: center; }
.menu-frame-col { display: none; }
.menu-row {
  display: grid; grid-template-columns: 4rem minmax(0, 1fr) auto; column-gap: 14px; row-gap: 4px; align-items: baseline;
  padding: 10px 10px; margin: 0 -10px; border-radius: var(--radius-field);
  transition: opacity var(--dur-fast) ease, background-color var(--dur-fast) ease, transform var(--dur-press) var(--ease-out);
}
.menu-row:active { transform: scale(0.985); }
.menu-thumb { grid-row: span 2; align-self: start; }
.menu-meta { grid-column: 2 / -1; }
@media (hover: hover) and (pointer: fine) {
  .menu-row:hover { background-color: var(--sand-100); }
  .menu-list:hover .menu-row:not(:hover) { opacity: 0.38; }
}
@media (min-width: 1024px) and (hover: hover) and (pointer: fine) {
  .menu-wrap { grid-template-columns: minmax(0, 1fr) minmax(0, 640px); column-gap: clamp(40px, 6vw, 128px); align-items: start; justify-items: stretch; }
  .menu-frame-col { display: block; align-self: stretch; }
  .menu-sheet:only-child { grid-column: 1 / -1; justify-self: center; }
  .menu-thumb { display: none; }
  .menu-row { grid-template-columns: minmax(0, 1fr) auto; }
  .menu-meta { grid-column: 1 / -1; }
}
`;
