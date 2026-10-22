import type { CSSProperties, ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button";
import { BUSINESS } from "@/content/catalog";
import { CatalogSummary } from "./catalog-summary";
import { HeroDepartures } from "./hero-departures";

// Hero: Wilber's file folders. A stack of five folders, one per section, each
// with its own tab; the four at the back are links to their sections, the
// front one is open on the next departures. Each folder lends its colour to
// the section it opens.

type Folder = { href: string; label: string; note: ReactNode; c: string; t: string; x: string; xmd: string };

const FOLDERS: Folder[] = [
  { href: "#contacto", label: "Contacto", note: `WhatsApp ${BUSINESS.whatsappDisplay}`, c: "var(--sand-400)", t: "var(--cobalt-800)", x: "52%", xmd: "71%" },
  { href: "#preparacion", label: "Preparación", note: "Horario, qué incluye y qué llevar", c: "var(--cobalt-600)", t: "var(--sand-50)", x: "25%", xmd: "51%" },
  { href: "#mapa", label: "Mapa", note: "Rutas, distancia y desnivel", c: "var(--sand-300)", t: "var(--cobalt-800)", x: "0%", xmd: "31%" },
  { href: "#aventuras", label: "Aventuras", note: <CatalogSummary />, c: "var(--cobalt-950)", t: "var(--sand-100)", x: "50%", xmd: "11%" },
];

const NAME = "WILBER";

type Vars = CSSProperties & Record<`--${string}`, string | number>;

export function Hero() {
  return (
    <section aria-labelledby="hero-name" className="field-ink relative overflow-x-clip">
      <style>{HERO_CSS}</style>
      <div className="mx-auto max-w-[1760px] px-[var(--gutter)]">
        <h1 id="hero-name" aria-label="Wilber" className="hero-name flex justify-center pt-2 font-display font-bold uppercase md:pt-1">
          {NAME.split("").map((letter, i) => (
            <span key={i} aria-hidden className="hero-mask">
              <span className="hero-letter" style={{ "--i": i } as Vars}>
                {letter}
              </span>
            </span>
          ))}
        </h1>
        <p className="hero-line mx-auto mt-4 max-w-[34ch] text-center text-body leading-snug text-ink md:mt-5 md:max-w-[60ch]">
          Tours de aventura en El Salvador. <br className="hidden md:block" />
          Salidas desde San Salvador, Juayúa, Suchitoto y El&nbsp;Tunco.
        </p>
      </div>

      <div className="folders mx-auto mt-[clamp(64px,8svh,88px)] w-full md:w-[86%] md:max-w-[1520px]">
        <nav aria-label="Secciones de esta página">
          {FOLDERS.map((f, i) => (
            <a
              key={f.href}
              href={f.href}
              className="folder folder-link hero-folder"
              style={{ "--c": f.c, "--t": f.t, "--x": f.x, "--x-md": f.xmd, "--f": i } as Vars}
            >
              <span className="folder-tab">{f.label}</span>
              <span className="folder-note">{f.note}</span>
            </a>
          ))}
        </nav>

        <section
          id="salidas"
          aria-labelledby="salidas-titulo"
          className="folder folder-front hero-folder ink-paper"
          style={{ "--c": "var(--sand-50)", "--t": "var(--cobalt-800)", "--x": "0%", "--x-md": "0%", "--f": FOLDERS.length } as Vars}
        >
          <h2 id="salidas-titulo" className="folder-tab">
            Próximas salidas
          </h2>
          <div className="px-4 pt-5 pb-10 sm:px-6 md:px-8 md:pt-7 md:pb-12 xl:grid xl:grid-cols-12 xl:gap-x-8">
            <div className="flex flex-col items-stretch gap-3 sm:items-start xl:col-span-3">
              <ButtonLink href="/aventuras">Ver todas las salidas</ButtonLink>
              <p className="max-w-[30ch] text-small leading-snug text-ink-soft">Precio por persona. Cada boleto es un asiento del microbús.</p>
            </div>
            <div className="mt-5 xl:col-span-9 xl:mt-0">
              <HeroDepartures />
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}

const HERO_CSS = `
.hero-name { font-size: min(26vw, 6.25rem); line-height: 0.8; letter-spacing: -0.01em; }
@media (min-width: 768px) { .hero-name { font-size: min(17vw, 26svh, 17rem); } }
.hero-mask { display: inline-block; overflow: clip; padding: 0.1em 0.004em 0.02em; margin: -0.1em 0 -0.02em; }
.hero-letter { display: inline-block; }

.folders { --strip: 44px; --tab-h: 34px; }
@media (min-width: 768px) { .folders { --strip: 48px; --tab-h: 40px; } }
.folder { position: relative; display: block; height: var(--strip); background: var(--c); color: var(--t); }
.folder-tab {
  position: absolute; bottom: calc(100% - 1px); left: var(--x); height: calc(var(--tab-h) + 1px);
  display: flex; align-items: center; padding: 0 22px; white-space: nowrap;
  background: var(--c); color: var(--t);
  font-family: var(--font-sans); font-size: 17px; font-weight: 600; line-height: 1;
  clip-path: polygon(12px 0, calc(100% - 12px) 0, 100% 100%, 0 100%);
}
@media (min-width: 768px) { .folder-tab { left: var(--x-md); padding: 0 28px; clip-path: polygon(14px 0, calc(100% - 14px) 0, 100% 100%, 0 100%); } }
.folder-note { display: none; }
@media (min-width: 1024px) {
  .folder-note { display: flex; position: absolute; inset: 0 24px 0 auto; align-items: center; font-size: var(--step-small); font-weight: 500; }
}
.folder-front { height: auto; }
.folder-link { transition: transform var(--dur-base) var(--ease-out); outline-offset: -4px; }
.folder-link:active { transform: translateY(-2px); }
@media (hover: hover) and (pointer: fine) { .folder-link:hover { transform: translateY(-7px); } }

@media (prefers-reduced-motion: no-preference) {
  .hero-letter { animation: hero-rise 1s var(--ease-out) backwards; animation-delay: calc(var(--i) * 55ms + 80ms); }
  .hero-line { animation: hero-fade 0.9s var(--ease-out) backwards; animation-delay: 460ms; }
  .hero-folder { animation: hero-folder 0.95s var(--ease-drawer) backwards; animation-delay: calc(var(--f) * 75ms + 540ms); }
}
@keyframes hero-rise { from { transform: translateY(108%); } }
@keyframes hero-fade { from { opacity: 0; transform: translateY(16px); } }
@keyframes hero-folder { from { opacity: 0; transform: translateY(56px); } }
`;
