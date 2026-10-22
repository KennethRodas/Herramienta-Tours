"use client";

import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/motion/collapsible";
import { ButtonLink } from "@/components/ui/button";
import { BUSINESS } from "@/content/catalog";
import { formatUsd, waLink } from "@/lib/domain/format";
import type { Tour } from "@/lib/domain/types";
import { useTours } from "@/lib/sim/hooks";
import { FolderTab } from "../folder-tab";
import { useReveal } from "../reveal";

// Preguntas as index cards filed in a drawer: each card has a manila tab that
// steps right, each card lies over the one behind it (its rounded corners show
// that card), one card is open at a time.

const LIST = new Intl.ListFormat("es", { style: "long", type: "conjunction" });

const TONES = [
  { c: "var(--sand-50)", t: "var(--cobalt-800)", button: "primary" as const },
  { c: "var(--sand-400)", t: "var(--cobalt-800)", button: "primary" as const },
  { c: "var(--cobalt-800)", t: "var(--sand-50)", button: "inverse" as const },
];

type Item = { id: string; tab: string; q: string; a: (button: "primary" | "inverse") => ReactNode };

function buildItems(tours: Tour[]): Item[] {
  const deposits = tours.map((t) => t.depositUsd);
  const minDeposit = deposits.length ? Math.min(...deposits) : 0;
  const maxDeposit = deposits.length ? Math.max(...deposits) : 0;
  const ages = Array.from(new Set(tours.map((t) => t.minAge))).sort((a, b) => a - b);
  const fromTown = tours.filter((t) => t.meetingPointId !== "masferrer").map((t) => t.shortName);

  return [
    {
      id: "pago",
      tab: "Pago",
      q: "¿Cómo se paga?",
      a: () => (
        <p>
          En efectivo el día de la salida, o con un anticipo en línea al reservar
          {deposits.length ? `: de ${formatUsd(minDeposit)} a ${formatUsd(maxDeposit)} por persona según la aventura` : ""}. El resto se
          paga el día de la salida.
        </p>
      ),
    },
    {
      id: "cancelacion",
      tab: "Cancelación",
      q: "¿Puedo cancelar?",
      a: (button) => (
        <>
          <p>Escribile a Wilber por WhatsApp con tu código de reserva. No hay cancelación en línea.</p>
          <ButtonLink
            href={waLink(BUSINESS.whatsapp, "Hola Wilber, quiero cancelar mi reserva ")}
            variant={button}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5"
          >
            Escribir a Wilber
          </ButtonLink>
        </>
      ),
    },
    {
      id: "clima",
      tab: "Clima",
      q: "¿Y si llueve?",
      a: () => <p>Si hay alerta, Wilber avisa por WhatsApp la víspera antes de las 6 p. m. y la salida se cambia de fecha sin costo.</p>,
    },
    {
      id: "edad",
      tab: "Edad mínima",
      q: "¿Desde qué edad?",
      a: () =>
        ages.length ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
            {ages.map((age) => (
              <div key={age} className="contents">
                <dt className="font-semibold tabular">{age} años</dt>
                <dd>{LIST.format(tours.filter((t) => t.minAge === age).map((t) => t.shortName))}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p>Cada aventura tiene su edad mínima. Ahora no hay aventuras disponibles.</p>
        ),
    },
    {
      id: "incluye",
      tab: "Qué incluye",
      q: "¿Qué incluye el precio?",
      a: () => (
        <p>
          Transporte desde San Salvador, guía y entradas.
          {fromTown.length
            ? ` ${LIST.format(fromTown)} empiezan en el pueblo: el viaje hasta el punto de encuentro va por tu cuenta.`
            : ""}{" "}
          Cada aventura detalla lo que incluye.
        </p>
      ),
    },
    {
      id: "grupos",
      tab: "Grupos grandes",
      q: "¿Son más de 14?",
      a: (button) => (
        <>
          <p>Escribile a Wilber por WhatsApp con la fecha y el número de personas.</p>
          <ButtonLink
            href={waLink(BUSINESS.whatsapp, "Hola Wilber, somos un grupo de más de 14 personas. Fecha: ")}
            variant={button}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5"
          >
            Escribir a Wilber
          </ButtonLink>
        </>
      ),
    },
  ];
}

export function Faq() {
  const tours = useTours();
  const items = buildItems(tours);
  const [openId, setOpenId] = useState<string | null>(items[0].id);
  const ref = useRef<HTMLElement>(null);
  useReveal(ref);

  return (
    <section id="preguntas" ref={ref} aria-labelledby="preguntas-titulo" className="text-ink">
      <style>{FAQ_CSS}</style>
      <div className="mx-auto max-w-[1760px] px-[var(--gutter)] py-[var(--section-gap)]">
        <div className="mx-auto max-w-[1040px]">
          <h2 id="preguntas-titulo" data-reveal className="font-display text-head font-bold uppercase leading-[0.92]">
            Preguntas
          </h2>
          <div className="faq-stack" style={{ ["--n" as string]: items.length } as CSSProperties}>
            {items.map((item, i) => {
              const tone = TONES[i % TONES.length];
              const open = openId === item.id;
              return (
                <div key={item.id} data-reveal="card" className="faq-item relative" style={{ zIndex: i + 1 }}>
                  <Collapsible
                    open={open}
                    onOpenChange={(next) => setOpenId(next ? item.id : null)}
                    className="faq-card"
                    data-pos={i % 3}
                    style={{ ["--i" as string]: i, ["--c" as string]: tone.c, ["--t" as string]: tone.t } as CSSProperties}
                  >
                    <CollapsibleTrigger render={<button type="button" className="faq-trigger" />}>
                      <FolderTab>{item.tab}</FolderTab>
                      <span className="faq-q">{item.q}</span>
                      <span aria-hidden className="faq-sign" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="data-[state=closed]:invisible" contentClassName="faq-answer">
                      {item.a(tone.button)}
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

const FAQ_CSS = `
.faq-stack { --cr: var(--radius-ticket); margin-top: 72px; }
@media (min-width: 768px) { .faq-stack { margin-top: 88px; } }
.faq-card { background: var(--c); color: var(--t); border-radius: var(--cr); padding-bottom: calc(40px + var(--cr)); }
.faq-item + .faq-item { margin-top: calc(-1 * var(--cr)); }
.faq-trigger {
  position: relative; display: flex; width: 100%; min-height: 60px; align-items: center; gap: 16px;
  padding: 12px 20px; text-align: left; cursor: pointer; color: inherit; border-radius: var(--cr) var(--cr) 0 0;
  transition: transform var(--dur-press) var(--ease-out);
}
@media (min-width: 768px) { .faq-trigger { min-height: 64px; padding: 12px 28px; } }
.faq-item:first-child .faq-trigger { padding-top: 16px; }
.faq-trigger:active { transform: scale(0.992); }
.faq-trigger:focus-visible { outline: 2px solid currentColor; outline-offset: -6px; }
/* Tabs: left, centre, right on a phone; stepping right on wider screens. */
.faq-trigger > .ft { left: 20px; }
.faq-card[data-pos="1"] .faq-trigger > .ft { left: 50%; transform: translateX(-50%); }
.faq-card[data-pos="2"] .faq-trigger > .ft { left: auto; right: 20px; }
@media (min-width: 768px) {
  .faq-card[data-pos] .faq-trigger > .ft { left: calc(20px + var(--i) * min(150px, (100% - 240px) / (var(--n) - 1))); right: auto; transform: none; }
}
.faq-q { flex: 1; font-size: var(--step-lead); font-weight: 600; line-height: 1.15; text-decoration-line: underline; text-decoration-thickness: 2px; text-underline-offset: 0.2em; text-decoration-color: transparent; transition: text-decoration-color var(--dur-fast) ease; }
@media (hover: hover) and (pointer: fine) { .faq-trigger:hover .faq-q { text-decoration-color: currentColor; } }
.faq-sign { position: relative; width: 18px; height: 18px; flex: none; }
.faq-sign::before, .faq-sign::after { content: ""; position: absolute; left: 0; top: 7.75px; width: 18px; height: 2.5px; border-radius: 2px; background: currentColor; transition: transform var(--dur-base) var(--ease-out); }
.faq-sign::after { transform: rotate(90deg); }
.faq-trigger[data-state="open"] .faq-sign::after { transform: rotate(0deg); }
.faq-answer { padding: 4px 20px 16px; max-width: 62ch; font-size: var(--step-body); line-height: 1.45; }
@media (min-width: 768px) { .faq-answer { padding: 4px 28px 20px; } }
`;
