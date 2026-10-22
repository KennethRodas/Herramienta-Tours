import type { CSSProperties } from "react";
import { BUSINESS, GUIDES, TOURS, VEHICLES } from "@/content/catalog";
import { Reveal } from "../reveal";

// Equipo: the roster card Wilber would pin in the microbus. Who guides, which
// vehicles go out and how many people fit, then a tear-off strip with the
// address. Facts only, from the catalog.

const LIST = new Intl.ListFormat("es", { style: "long", type: "conjunction" });

export function Crew() {
  const max = Math.max(...TOURS.map((t) => t.capacity));
  const smaller = Array.from(new Set(TOURS.map((t) => t.capacity)))
    .filter((c) => c < max)
    .sort((a, b) => b - a)
    .map((c) => `${c} en ${LIST.format(TOURS.filter((t) => t.capacity === c).map((t) => t.shortName))}`);
  const instagram = BUSINESS.instagram.replace(/^@/, "");

  return (
    <Reveal id="equipo" aria-labelledby="equipo-titulo" className="text-ink">
      <div className="mx-auto max-w-[1760px] px-[var(--gutter)] pb-[var(--section-gap)]">
        <div data-reveal="card" className="mx-auto w-full max-w-[680px]">
          <div className="ink-night bg-cobalt-800 px-6 pt-12 pb-10 text-ink sm:px-12 sm:pt-14 sm:pb-12">
            <h2 id="equipo-titulo" className="font-display text-head font-bold uppercase leading-[0.92]">
              Guías y microbuses
            </h2>

            <h3 className="mt-10 font-display text-lead font-bold uppercase leading-none">Guías</h3>
            <ul className="mt-4 flex flex-col gap-2.5">
              {GUIDES.map((g) => (
                <li key={g.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-6">
                  <span className="text-body font-semibold">{g.name}</span>
                  <span className="text-right text-[17px]">{g.senior ? "Todas las aventuras" : "Suaves y moderadas"}</span>
                </li>
              ))}
            </ul>

            <h3 className="mt-10 font-display text-lead font-bold uppercase leading-none">Vehículos</h3>
            <ul className="mt-4 flex flex-col gap-2.5">
              {VEHICLES.map((v) => (
                <li key={v.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-6 sm:grid-cols-[minmax(0,1fr)_7.5rem_11rem]">
                  <span className="text-body font-semibold">{v.name}</span>
                  <span className="text-right text-[17px] tabular sm:text-left">{v.seats} asientos</span>
                  <span className="col-span-2 text-[17px] text-ink-soft sm:col-span-1">{v.driver}</span>
                </li>
              ))}
            </ul>

            <h3 className="mt-10 font-display text-lead font-bold uppercase leading-none">Grupo máximo</h3>
            <p className="mt-4 max-w-[46ch] text-body leading-snug">
              {max} personas por salida{smaller.length ? `; ${smaller.join("; ")}` : ""}.
            </p>
          </div>

          <div aria-hidden className="perforation-x bg-cobalt-800" style={{ ["--perf" as string]: "var(--sand-200)" } as CSSProperties} />

          <div className="ink-night edge-scallop-b flex flex-col gap-2 bg-cobalt-800 px-6 pt-5 pb-10 text-ink sm:flex-row sm:items-baseline sm:justify-between sm:px-12">
            <a href={`mailto:${BUSINESS.email}`} className="site-link pressable inline-block text-body font-semibold">
              {BUSINESS.email}
            </a>
            <a
              href={`https://www.instagram.com/${instagram}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="site-link pressable inline-block text-[17px]"
            >
              Instagram {BUSINESS.instagram}
            </a>
          </div>
        </div>
      </div>
    </Reveal>
  );
}
