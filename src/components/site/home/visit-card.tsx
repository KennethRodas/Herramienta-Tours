"use client";

import Image from "next/image";
import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { ButtonLink } from "@/components/ui/button";
import { BUSINESS, MEETING_POINTS } from "@/content/catalog";
import { PHOTO_CREDITS } from "@/content/photo-credits";
import { waLink } from "@/lib/domain/format";
import { useReveal } from "../reveal";

gsap.registerPlugin(ScrollTrigger, useGSAP);

// Contacto: a visit card laid on a full-bleed photograph of Lago de Coatepeque.
// The photograph is the page's one slow moving picture: it settles from a
// slight scale while the section crosses the screen.

export function VisitCard() {
  const ref = useRef<HTMLElement>(null);
  const photoRef = useRef<HTMLDivElement>(null);
  useReveal(ref, "top 70%");

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          photoRef.current,
          { scale: 1.14 },
          { scale: 1, ease: "none", scrollTrigger: { trigger: ref.current, start: "top bottom", end: "bottom top", scrub: 0.6 } },
        );
      });
      return () => mm.revert();
    },
    { scope: ref },
  );

  const photo = PHOTO_CREDITS["coatepeque"];
  const [main, ...others] = MEETING_POINTS;

  return (
    <section id="contacto" ref={ref} aria-labelledby="contacto-titulo" className="relative isolate overflow-x-clip bg-cobalt-800 pt-[var(--gutter)]">
      <div className="relative isolate mx-[var(--gutter)] h-[72svh] overflow-hidden rounded-ticket md:h-[calc(100svh-2*var(--gutter))] md:min-h-[720px]">
        <div ref={photoRef} className="absolute inset-0">
          <Image src={photo.src} alt={photo.alt} fill sizes="100vw" quality={75} className="object-cover object-[30%_60%]" />
        </div>
        <p className="absolute top-3 left-3 z-10 rounded-full bg-sand-50 px-3.5 py-1.5 text-small text-cobalt-800 md:top-auto md:bottom-5 md:left-5">
          Lago de Coatepeque. Foto: {photo.author}, {photo.licence}
        </p>
      </div>

      <div
        data-reveal="card"
        className="ink-paper relative z-20 mx-[calc(var(--gutter)+12px)] -mt-20 rounded-ticket bg-sand-50 text-ink md:absolute md:top-[calc(var(--gutter)+48px)] md:right-[calc(var(--gutter)+48px)] md:mx-0 md:mt-0 md:w-[400px]"
      >
        <div className="px-6 pt-7 pb-6 sm:px-8 sm:pt-8">
          <h2 id="contacto-titulo" className="font-display text-lead font-bold uppercase leading-none">
            Punto de encuentro
          </h2>
          <p className="mt-4 text-body leading-snug">
            <span className="block font-semibold">{main.name}</span>
            {main.address}, {main.city}
          </p>
          <p className="mt-2 text-[17px] leading-snug">{main.instructions}</p>
          <a href={main.mapsUrl} target="_blank" rel="noopener noreferrer" className="pressable mt-2 inline-block text-[17px] font-semibold underline decoration-2 underline-offset-4 hover:decoration-[3px]">
            Abrir en el mapa
          </a>

          <h3 className="mt-6 text-[17px] font-bold">Otros puntos de encuentro</h3>
          <ul className="mt-1.5 flex flex-col gap-1 text-[17px] leading-snug">
            {others.map((m) => (
              <li key={m.id}>
                {m.name}, {m.city.split(",")[0]}
              </li>
            ))}
          </ul>

          <h3 className="mt-6 text-[17px] font-bold">Horario de atención</h3>
          <dl className="mt-1.5 flex flex-col gap-1 text-[17px]">
            {BUSINESS.hours.map((h) => (
              <div key={h.days} className="flex items-baseline justify-between gap-6">
                <dt>{h.days}</dt>
                <dd className="tabular">{h.time}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-[17px]">
            WhatsApp <span className="font-semibold tabular">{BUSINESS.whatsappDisplay}</span>
          </p>
        </div>
        <div className="px-4 pb-4 sm:px-6 sm:pb-6">
          <ButtonLink
            href={waLink(BUSINESS.whatsapp, "Hola Wilber, quiero información sobre una salida.")}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-14 w-full"
          >
            Escribir por WhatsApp
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
