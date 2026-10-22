"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, List, X } from "lucide-react";
import { BottomSheet } from "@/components/motion/bottom-sheet";
import { LiquidTabBar } from "@/components/nav/liquid-tabbar";
import { ButtonLink } from "@/components/ui/button";
import { BUSINESS, DIFFICULTY_LABEL, DIFFICULTY_ORDER } from "@/content/catalog";
import { PHOTO_CREDITS } from "@/content/photo-credits";
import { formatDayShort, formatDuration, formatKm, formatMeters, formatTime, formatUsd, plural, waLink } from "@/lib/domain/format";
import type { Difficulty, Tour } from "@/lib/domain/types";
import { EASE_OUT } from "@/lib/ease";
import { useNextDepartures, useTours, type DepartureView } from "@/lib/sim/hooks";
import { cn } from "@/lib/utils";
import { TerrainMap } from "./index";

// /mapa: every route on the relief. Desktop: list beside the map. Phone: the
// map fills the screen, the chosen tour rides at the bottom and the list opens
// in a bottom sheet.

type Filter = "todas" | Difficulty;

const FILTERS = [{ id: "todas", label: "Todas" }, ...DIFFICULTY_ORDER.map((d) => ({ id: d, label: DIFFICULTY_LABEL[d] }))];

type NextMap = Record<string, DepartureView | undefined> | null;

/** The chosen tour's card rises 4px into place where its row was (@starting-style). */
const APPEAR = "transition-[opacity,translate] duration-200 ease-out-strong starting:translate-y-1 starting:opacity-0";

function NextLine({ dep, loading }: { dep: DepartureView | undefined; loading: boolean }) {
  if (loading) return <span className="inline-block h-[1em] w-40 rounded-full bg-sand-300 align-middle" aria-hidden />;
  if (!dep) return <>Sin salidas con cupos</>;
  return (
    <>
      Próxima: {formatDayShort(dep.startsAt)} · {formatTime(dep.startsAt)} · {plural(dep.left, "cupo", "cupos")}
    </>
  );
}

function TourRow({
  tour,
  next,
  hovered,
  onSelect,
  onHover,
}: {
  tour: Tour;
  next: NextMap;
  hovered: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}) {
  const photo = PHOTO_CREDITS[tour.photo];
  return (
    <button
      type="button"
      onClick={() => onSelect(tour.id)}
      onPointerEnter={(e) => e.pointerType !== "touch" && onHover(tour.id)}
      onPointerLeave={() => onHover(null)}
      data-hover={hovered ? "true" : undefined}
      className="pressable grid w-full grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-3 rounded-field p-2 pr-3 text-left hover:bg-cobalt-800/[0.06] data-[hover=true]:bg-cobalt-800/[0.06] focus-visible:outline-2 focus-visible:-outline-offset-2"
    >
      {photo ? (
        <Image src={photo.srcSmall} alt="" width={56} height={56} sizes="56px" className="size-14 rounded-field object-cover" />
      ) : (
        <span className="size-14 rounded-field bg-sand-300" />
      )}
      <span className="min-w-0">
        <span className="block truncate text-[17px] font-semibold leading-tight">{tour.name}</span>
        <span className="block text-small text-ink-soft tabular">
          {DIFFICULTY_LABEL[tour.difficulty]} · {formatDuration(tour.durationHours)} · {formatKm(tour.distanceKm)}
        </span>
        <span className="block truncate text-small tabular">
          <NextLine dep={next?.[tour.id]} loading={next === null} />
        </span>
      </span>
      <span className="font-display text-lead font-semibold tabular">{formatUsd(tour.priceUsd)}</span>
    </button>
  );
}

function TourCard({ tour, next, onClose, compact }: { tour: Tour; next: NextMap; onClose: () => void; compact?: boolean }) {
  const photo = PHOTO_CREDITS[tour.photo];
  const dep = next?.[tour.id];
  return (
    <article data-tour-card={tour.id} className={cn("paper relative overflow-hidden", !compact && APPEAR)} aria-label={tour.name}>
      {!compact && photo ? (
        <figure>
          <div className="relative aspect-[16/9] w-full bg-sand-300">
            <Image src={photo.src} alt={photo.alt} fill sizes="400px" className="object-cover" />
          </div>
          <figcaption className="px-4 pt-1.5 text-[13px] text-ink-soft">
            Foto: {photo.author} · {photo.licence}
          </figcaption>
        </figure>
      ) : null}
      <div className={cn("grid gap-3 p-4", compact && "gap-2 p-3")}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className={cn("font-display font-semibold uppercase leading-[0.95]", compact ? "text-[22px]" : "text-[28px]")}>{tour.name}</h2>
            <p className="text-small text-ink-soft">
              {tour.region} · {DIFFICULTY_LABEL[tour.difficulty]}
            </p>
          </div>
          <div className="flex items-start gap-1">
            <p className="font-display text-lead font-semibold tabular">{formatUsd(tour.priceUsd)}</p>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar ficha"
              className="pressable -mr-1 -mt-1 grid size-9 place-items-center rounded-full text-cobalt-800 hover:bg-sand-100"
            >
              <X size={18} strokeWidth={2.25} aria-hidden />
            </button>
          </div>
        </div>
        {!compact ? (
          <dl className="grid grid-cols-3 gap-2 text-small">
            <div>
              <dt className="text-ink-soft">Duración</dt>
              <dd className="font-semibold tabular">{formatDuration(tour.durationHours)}</dd>
            </div>
            <div>
              <dt className="text-ink-soft">Distancia</dt>
              <dd className="font-semibold tabular">{formatKm(tour.distanceKm)}</dd>
            </div>
            <div>
              <dt className="text-ink-soft">Desnivel</dt>
              <dd className="font-semibold tabular">+{formatMeters(tour.elevationGainM)}</dd>
            </div>
          </dl>
        ) : null}
        <div className="perforation-x [--perf:var(--sand-200)]" aria-hidden />
        <p className="text-small tabular">
          {compact ? (
            <>
              {formatDuration(tour.durationHours)} · <NextLine dep={dep} loading={next === null} />
            </>
          ) : (
            <NextLine dep={dep} loading={next === null} />
          )}
        </p>
        <ButtonLink href={`/aventuras/${tour.slug}`} className={cn("w-full justify-between", compact && "h-11 text-[16px]")}>
          Ver aventura
          <ArrowRight size={18} strokeWidth={2.25} aria-hidden />
        </ButtonLink>
      </div>
    </article>
  );
}

function Empty() {
  return (
    <p className="px-2 text-body">
      No hay aventuras publicadas ahora.{" "}
      <a className="font-semibold underline underline-offset-4" href={waLink(BUSINESS.whatsapp, "Hola Wilber, ¿qué aventuras tenés?")}>
        Escribile a Wilber por WhatsApp
      </a>
      .
    </p>
  );
}

export function MapExplorer({ initialSlug }: { initialSlug?: string }) {
  const tours = useTours();
  const next = useNextDepartures();
  const rootRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<Filter>("todas");
  const [selectedId, setSelectedId] = useState<string | undefined>(() => tours.find((t) => t.slug === initialSlug)?.id);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const [stripH, setStripH] = useState(0);

  const reduce = useReducedMotion() ?? false;
  const visible = filter === "todas" ? tours : tours.filter((t) => t.difficulty === filter);
  const selected = visible.find((t) => t.id === selectedId);
  const selectedKey = selected?.id;

  // Chosen on the map: bring its card into the list's view (spatial link between the two).
  useEffect(() => {
    if (!selectedKey) return;
    const card = rootRef.current?.querySelector<HTMLElement>(`aside [data-tour-card="${selectedKey}"]`);
    card?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, [selectedKey, reduce]);

  // Full viewport minus whatever the site header takes above us.
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const fit = () => {
      const top = el.getBoundingClientRect().top + window.scrollY;
      el.style.setProperty("--wm-top", `${Math.max(0, Math.round(top))}px`);
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setStripH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const select = (id: string) => {
    setSelectedId(id);
    setSheet(false);
    const t = tours.find((x) => x.id === id);
    if (t) window.history.replaceState(window.history.state, "", `?tour=${t.slug}`);
  };
  const clear = () => {
    setSelectedId(undefined);
    window.history.replaceState(window.history.state, "", window.location.pathname);
  };
  const changeFilter = (f: Filter) => {
    setFilter(f);
    const current = tours.find((t) => t.id === selectedId);
    if (current && f !== "todas" && current.difficulty !== f) clear();
  };

  const list = (
    <ul className="flex flex-col gap-1">
      {visible.map((t) => (
        <li key={t.id}>
          {t.id === selected?.id ? (
            <TourCard tour={t} next={next} onClose={clear} />
          ) : (
            <TourRow tour={t} next={next} hovered={hoverId === t.id} onSelect={select} onHover={setHoverId} />
          )}
        </li>
      ))}
    </ul>
  );

  const filterBar = (
    <LiquidTabBar
      variant="segmented"
      tabs={FILTERS}
      activeId={filter}
      onSelect={(id) => changeFilter(id as Filter)}
      ariaLabel="Dificultad"
      className="w-full [&_.lg-inner]:grid-cols-[repeat(5,auto)]! [&_.lg-inner]:justify-between! [&_.lg-item]:px-1! [&_.lg-item]:text-[14px]!"
    />
  );

  return (
    <div
      ref={rootRef}
      data-lenis-prevent=""
      className="wm-explorer relative grid h-[calc(100dvh-var(--wm-top,0px))] min-h-[520px] gap-4 p-2 pt-0 lg:grid-cols-[400px_minmax(0,1fr)] lg:p-4 lg:pt-1"
      style={{ "--wm-credits-bottom": `${stripH}px` } as CSSProperties}
    >
      <aside className="paper hidden min-h-0 flex-col overflow-hidden lg:flex">
        <header className="flex flex-col gap-4 px-5 pb-4 pt-6">
          <div className="flex items-end justify-between gap-3">
            <h1 className="font-display text-head font-semibold uppercase leading-[0.9]">Mapa</h1>
            <p className="pb-1 text-small text-ink-soft tabular">{plural(visible.length, "aventura", "aventuras")}</p>
          </div>
          {filterBar}
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-6">{tours.length ? list : <Empty />}</div>
      </aside>

      <div className="relative min-h-0">
        <h1 className="sr-only lg:hidden">Mapa</h1>
        <TerrainMap
          tours={visible}
          focusTourId={selected?.id}
          onSelectTour={select}
          onClearFocus={clear}
          highlightTourId={hoverId}
          onHoverTour={setHoverId}
          padding={{ top: 64, right: 72, bottom: stripH + 24, left: 24 }}
          className="absolute inset-0"
        />

        <div
          ref={stripRef}
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col gap-2 px-3 pb-[calc(env(safe-area-inset-bottom)+88px)] lg:hidden"
        >
          <AnimatePresence initial={false}>
            {selected ? (
              <motion.div
                key={selected.id}
                className="pointer-events-auto w-full max-w-md self-center"
                initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(16px)" }}
                animate={reduce ? { opacity: 1 } : { opacity: 1, transform: "translateY(0px)" }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(12px)" }}
                transition={{ duration: reduce ? 0.12 : 0.24, ease: EASE_OUT }}
              >
                <TourCard tour={selected} next={next} onClose={clear} compact />
              </motion.div>
            ) : null}
          </AnimatePresence>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setSheet(true)}
              aria-label={`Lista de aventuras: ${visible.length}`}
              className="pressable pointer-events-auto inline-flex h-11 items-center gap-2 rounded-full bg-cobalt-800 pl-4 pr-5 text-[16px] font-semibold text-sand-50 hover:bg-cobalt-700"
            >
              <List size={18} strokeWidth={2.25} aria-hidden />
              Aventuras · <span className="tabular">{visible.length}</span>
            </button>
          </div>
        </div>
      </div>

      <BottomSheet open={sheet} onOpenChange={setSheet} snapPoints={[0.64, 0.92]} title="Aventuras" className="rounded-t-ticket">
        <div className="flex flex-col gap-3 pt-1">
          {filterBar}
          {tours.length ? list : <Empty />}
        </div>
      </BottomSheet>
    </div>
  );
}
