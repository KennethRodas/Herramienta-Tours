import type { Metadata } from "next";
import Image from "next/image";
import type { ReactNode } from "react";
import { Reveal } from "@/components/site/reveal";
import { PHOTO_CREDITS } from "@/content/photo-credits";

export const metadata: Metadata = {
  title: "Créditos",
  description: "Autores y licencias de las fotos, componentes, tipografía y datos de mapas del sitio.",
};

const external = { target: "_blank", rel: "noopener noreferrer" } as const;
const link = "pressable inline-block font-semibold underline decoration-2 underline-offset-4 hover:decoration-[3px]";

type Credit = { name: string; detail: ReactNode; href: string; hrefLabel: string };

const CODE: Credit[] = [
  {
    name: "beui",
    detail: "Componentes de interfaz y movimiento. © 2026 Saurabh Chauhan, licencia MIT.",
    href: "https://beui.dev",
    hrefLabel: "beui.dev",
  },
  {
    name: "Liquid Glass Navbar | Switcher",
    detail: "Barra de navegación de vidrio líquido, adaptada para la barra del teléfono y el filtro de dificultad. © 2026 Sis, licencia MIT.",
    href: "https://codepen.io/Sis-the-builder/pen/GgjppJe",
    hrefLabel: "CodePen",
  },
];

const TYPE: Credit[] = [
  {
    name: "Barlow y Barlow Condensed",
    detail: "© 2017 The Barlow Project Authors, SIL Open Font License 1.1.",
    href: "https://openfontlicense.org",
    hrefLabel: "Licencia OFL",
  },
];

const MAPS: Credit[] = [
  {
    name: "OpenFreeMap",
    detail: "Teselas vectoriales. © OpenMapTiles, © colaboradores de OpenStreetMap (ODbL).",
    href: "https://www.openstreetmap.org/copyright",
    hrefLabel: "OpenStreetMap",
  },
  {
    name: "Esri World Imagery",
    detail: "Imagen satelital. © Esri y sus proveedores.",
    href: "https://www.esri.com",
    hrefLabel: "esri.com",
  },
  {
    name: "Mapzen Terrain Tiles",
    detail: "Relieve del terreno, publicado en AWS Open Data.",
    href: "https://registry.opendata.aws/terrain-tiles/",
    hrefLabel: "AWS Open Data",
  },
];

function CreditList({ items }: { items: Credit[] }) {
  return (
    <ul className="mt-6 flex flex-col gap-5">
      {items.map((c) => (
        <li key={c.name} data-reveal="row" className="grid gap-x-8 gap-y-1 md:grid-cols-[minmax(0,16rem)_minmax(0,1fr)_auto] md:items-baseline">
          <span className="text-body font-semibold">{c.name}</span>
          <span className="text-[17px] leading-snug">{c.detail}</span>
          <a href={c.href} {...external} className={`${link} text-[17px]`}>
            {c.hrefLabel}
          </a>
        </li>
      ))}
    </ul>
  );
}

export default function CreditosPage() {
  const photos = Object.values(PHOTO_CREDITS);

  return (
    <Reveal as="div" className="text-ink" start="top 90%">
      <section aria-labelledby="creditos-titulo" className="mx-auto max-w-[1760px] px-[var(--gutter)] pt-8 pb-12 md:pt-12 md:pb-16">
        <h1
          id="creditos-titulo"
          className="rise-in font-display font-bold uppercase leading-[0.8] tracking-[-0.01em] [font-size:clamp(4rem,18vw,13rem)]"
        >
          Créditos
        </h1>
      </section>

      <section aria-label="Lista de créditos" className="field-ink py-[clamp(48px,7vw,120px)]">
        <div className="mx-auto max-w-[1760px] px-[var(--gutter)]">
          <div data-reveal="card" className="ink-paper edge-scallop-y mx-auto max-w-[1120px] rounded-ticket bg-sand-50 px-5 pt-12 pb-14 text-ink sm:px-10 md:px-14 md:pt-16">
            <h2 className="font-display text-head font-bold uppercase leading-none">Fotos</h2>
            <p className="mt-3 max-w-[60ch] text-[17px] leading-snug">
              Fotografías de Wikimedia Commons. Muestran los lugares de cada aventura; no son fotos de Wilber ni de sus grupos.
            </p>
            <ul className="mt-8 grid gap-x-10 gap-y-8 md:grid-cols-2">
              {photos.map((p) => (
                <li key={p.slug} data-reveal="row" className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-x-4 lg:grid-cols-[11rem_minmax(0,1fr)] lg:gap-x-5">
                  <Image
                    src={p.srcSmall}
                    alt={p.alt}
                    width={176}
                    height={132}
                    sizes="(min-width: 1024px) 176px, 120px"
                    className="aspect-[4/3] w-full rounded-field object-cover"
                  />
                  <div className="flex flex-col gap-1 text-[17px] leading-snug">
                    <span className="font-semibold">{p.title}</span>
                    <span>
                      {p.author},{" "}
                      <a href={p.licenceUrl} {...external} className={link}>
                        {p.licence}
                      </a>
                    </span>
                    <a href={p.sourceUrl} {...external} className={`${link} self-start`}>
                      Ver en Wikimedia Commons
                    </a>
                  </div>
                </li>
              ))}
            </ul>

            <h2 className="mt-24 font-display text-head font-bold uppercase leading-none">Componentes</h2>
            <CreditList items={CODE} />

            <h2 className="mt-24 font-display text-head font-bold uppercase leading-none">Tipografía</h2>
            <CreditList items={TYPE} />

            <h2 className="mt-24 font-display text-head font-bold uppercase leading-none">Mapas</h2>
            <CreditList items={MAPS} />
          </div>
        </div>
      </section>
    </Reveal>
  );
}
