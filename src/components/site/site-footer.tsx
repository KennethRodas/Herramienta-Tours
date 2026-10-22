import Image from "next/image";
import Link from "next/link";
import { LogoMark } from "@/components/brand/logo";
import { BUSINESS } from "@/content/catalog";
import { PHOTO_CREDITS } from "@/content/photo-credits";
import { waLink } from "@/lib/domain/format";
import { Reveal } from "./reveal";

const PAGES = [
  { href: "/aventuras", label: "Aventuras" },
  { href: "/mapa", label: "Mapa" },
  { href: "/reserva", label: "Mi reserva" },
  { href: "/entrar", label: "Entrar" },
  { href: "/creditos", label: "Créditos" },
];

const linkClass = "site-link pressable inline-block";

// The back of the card: the reverse of the site's stationery, with a scalloped
// top edge. Pages on the left, how to reach Wilber on the right, a stamp, the
// name at full size, the photo credits and the printer's imprint.
export function SiteFooter() {
  const stamp = PHOTO_CREDITS["izalco"];
  const instagram = BUSINESS.instagram.replace(/^@/, "");

  return (
    <Reveal
      as="footer"
      start="top 95%"
      className="field-ink pt-[clamp(64px,9vw,128px)] pb-[calc(env(safe-area-inset-bottom,0px)+160px)] md:pb-10"
    >
      <div className="mx-auto max-w-[1760px] px-[var(--gutter)]">
        <div
          data-reveal="card"
          className="ink-paper edge-scallop-t relative rounded-ticket bg-sand-50 px-6 pt-14 pb-8 text-ink md:px-10 md:pt-16 lg:px-14"
          style={{ ["--r" as string]: "18px" }}
        >
          <div className="grid gap-y-10 lg:grid-cols-12 lg:gap-x-8">
            <nav aria-label="Páginas del sitio" className="lg:col-span-5">
              <ul className="flex flex-col gap-1.5">
                {PAGES.map((p) => (
                  <li key={p.href}>
                    <Link href={p.href} className={`${linkClass} font-display text-lead font-semibold uppercase leading-tight`}>
                      {p.label}
                    </Link>
                  </li>
                ))}
              </ul>
              <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-[17px] font-medium">
                <li>
                  <Link href="/wilber" className={linkClass}>
                    Panel de Wilber
                  </Link>
                </li>
                <li>
                  <Link href="/simulador" className={linkClass}>
                    Simulador
                  </Link>
                </li>
              </ul>
            </nav>

            <div className="flex items-start justify-between gap-8 lg:col-span-6 lg:col-start-7">
              <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-6 gap-y-3">
                <dt className="text-small font-semibold">WhatsApp</dt>
                <dd className="text-body">
                  <a href={waLink(BUSINESS.whatsapp)} className={`${linkClass} tabular`} target="_blank" rel="noopener noreferrer">
                    {BUSINESS.whatsappDisplay}
                  </a>
                </dd>
                <dt className="text-small font-semibold">Correo</dt>
                <dd className="text-body">
                  <a href={`mailto:${BUSINESS.email}`} className={linkClass}>
                    {BUSINESS.email}
                  </a>
                </dd>
                <dt className="text-small font-semibold">Instagram</dt>
                <dd className="text-body">
                  <a href={`https://www.instagram.com/${instagram}/`} className={linkClass} target="_blank" rel="noopener noreferrer">
                    {BUSINESS.instagram}
                  </a>
                </dd>
                <dt className="text-small font-semibold">Atención</dt>
                <dd className="text-body tabular">
                  {BUSINESS.hours.map((h) => (
                    <span key={h.days} className="block">
                      {h.days}, {h.time.toLowerCase() === "en ruta" ? "en ruta" : h.time}
                    </span>
                  ))}
                </dd>
              </dl>

              <figure className="hidden shrink-0 sm:block">
                <div className="edge-scallop-y rounded-stub bg-sand-300 p-1.5" style={{ ["--r" as string]: "3px" }}>
                  <Image
                    src={stamp.srcSmall}
                    alt={stamp.alt}
                    width={88}
                    height={117}
                    sizes="88px"
                    className="h-[117px] w-[88px] rounded-stub object-cover"
                  />
                </div>
              </figure>
            </div>
          </div>

          <p aria-hidden className="mt-14 flex items-center justify-center gap-[0.12em] font-display font-bold uppercase leading-[0.78] tracking-[-0.01em] [font-size:min(26vw,6.25rem)] md:[font-size:min(17vw,26svh,17rem)]">
            <LogoMark paper="var(--cobalt-800)" ink="var(--sand-50)" className="hidden h-[0.74em] w-[0.74em] sm:block" />
            <span>Wilber</span>
          </p>

          {/* CC BY-SA allows attribution through a link to the full credits (licence §3(a)(2)). */}
          <p className="mt-10 max-w-[72ch] text-[16px] leading-relaxed">
            Fotos de Wikimedia Commons con licencia CC BY-SA.{" "}
            <Link href="/creditos" className="pressable inline-block font-semibold underline decoration-2 underline-offset-4">
              Autores y licencias
            </Link>
          </p>
          <p className="mt-6 text-center text-small">© 2026 Tours de Aventura de Wilber · Proyecto académico</p>
        </div>
      </div>
    </Reveal>
  );
}
