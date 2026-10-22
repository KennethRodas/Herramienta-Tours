import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/brand/logo";
import { NotFoundTickets } from "@/components/site/not-found-tickets";
import { SiteStyles } from "@/components/site/site-styles";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Página no encontrada",
};

export default function NotFound() {
  return (
    <div className="field-ink flex min-h-dvh flex-col">
      <SiteStyles />
      <header className="mx-auto flex w-full max-w-[1760px] justify-center px-[var(--gutter)] pt-5 md:pt-6">
        <Link href="/" aria-label="Wilber, tours de aventura: inicio" className="pressable">
          <Wordmark />
        </Link>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center gap-10 px-[var(--gutter)] pt-10 pb-24 text-center">
        <NotFoundTickets />
        <div className="flex flex-col items-center gap-3">
          <h1 className="font-display text-head font-bold uppercase leading-[0.92]">Página no encontrada</h1>
          <p className="max-w-[36ch] text-body leading-snug">La dirección no existe o cambió.</p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-4">
          <ButtonLink href="/" variant="inverse">
            Ir al inicio
          </ButtonLink>
          <Link href="/aventuras" className="pressable text-[17px] font-semibold underline decoration-2 underline-offset-4 hover:decoration-[3px]">
            Ver aventuras
          </Link>
        </div>
      </main>
    </div>
  );
}
