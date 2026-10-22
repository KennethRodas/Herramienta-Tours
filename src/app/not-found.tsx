import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Wordmark } from "@/components/brand/logo";
import { NotFoundTickets } from "@/components/site/not-found-tickets";
import { SiteStyles } from "@/components/site/site-styles";
import { ButtonLink } from "@/components/ui/button";
import { tourById } from "@/content/catalog";
import { PHOTO_CREDITS } from "@/content/photo-credits";
import { formatUsd } from "@/lib/domain/format";

export const metadata: Metadata = {
  title: "Página no encontrada",
};

// The way back from a dead end: four aventuras, each with its photo and price.
const PICKS = ["t-santa-ana", "t-izalco", "t-siete-cascadas", "t-coatepeque"];
const LIST = new Intl.ListFormat("es", { style: "long", type: "conjunction" });

const at = (i: number) => ({ ["--i" as string]: i }) as CSSProperties;

export default function NotFound() {
  const picks = PICKS.map((id) => tourById(id)).filter((t) => t !== undefined);
  const authors = Array.from(new Set(picks.map((t) => PHOTO_CREDITS[t.photo]?.author).filter(Boolean)));

  return (
    <div className="field-ink flex min-h-dvh flex-col">
      <SiteStyles />
      <header className="mx-auto flex w-full max-w-[1760px] justify-center px-[var(--gutter)] pt-5 md:pt-6">
        <Link href="/" aria-label="Wilber, tours de aventura: inicio" className="pressable">
          <Wordmark />
        </Link>
      </header>
      <main className="flex flex-1 flex-col items-center gap-10 px-[var(--gutter)] pt-12 pb-20 text-center md:pt-16">
        <div className="rise-in" style={at(0)}>
          <NotFoundTickets />
        </div>
        <div className="flex flex-col items-center gap-3">
          <h1 className="rise-in font-display text-head font-bold uppercase leading-[0.92]" style={at(1)}>
            Página no encontrada
          </h1>
          <p className="rise-in max-w-[36ch] text-body leading-snug" style={at(2)}>
            La dirección no existe o cambió.
          </p>
        </div>
        <div className="rise-in flex flex-wrap items-center justify-center gap-x-6 gap-y-4" style={at(3)}>
          <ButtonLink href="/" variant="inverse">
            Ir al inicio
          </ButtonLink>
          <Link href="/aventuras" className="pressable text-[17px] font-semibold underline decoration-2 underline-offset-4 hover:decoration-[3px]">
            Ver aventuras
          </Link>
        </div>

        <section aria-labelledby="nf-aventuras" className="mt-8 w-full max-w-[1120px] text-left">
          <h2 id="nf-aventuras" className="rise-in font-display text-lead font-bold uppercase leading-none" style={at(4)}>
            Aventuras
          </h2>
          <ul className="mt-5 grid grid-cols-2 gap-x-4 gap-y-7 lg:grid-cols-4 lg:gap-x-6">
            {picks.map((t, i) => {
              const photo = PHOTO_CREDITS[t.photo];
              return (
                <li key={t.id} className="rise-in" style={at(5 + i)}>
                  <Link href={`/aventuras/${t.slug}`} className="nf-pick pressable block">
                    {photo && (
                      <Image
                        src={photo.src}
                        alt={photo.alt}
                        width={520}
                        height={390}
                        sizes="(min-width: 1024px) 260px, 45vw"
                        className="aspect-[4/3] w-full rounded-ticket object-cover"
                      />
                    )}
                    <span className="mt-3 flex items-baseline justify-between gap-3 text-[17px] font-semibold leading-tight">
                      <span className="nf-name">{t.name}</span>
                      <span className="tabular">{formatUsd(t.priceUsd)}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <p className="rise-in mt-6 max-w-[60ch] text-[17px] leading-snug" style={at(9)}>
            Fotos de Wikimedia Commons (CC BY-SA): {LIST.format(authors as string[])}.{" "}
            <Link href="/creditos" className="pressable inline-block font-semibold underline decoration-2 underline-offset-4">
              Créditos
            </Link>
          </p>
        </section>
      </main>
      <style>{`
        .nf-name { text-decoration-line: underline; text-decoration-thickness: 2px; text-underline-offset: 0.25em; text-decoration-color: transparent; transition: text-decoration-color var(--dur-fast) ease; }
        @media (hover: hover) and (pointer: fine) { .nf-pick:hover .nf-name { text-decoration-color: currentColor; } }
      `}</style>
    </div>
  );
}
