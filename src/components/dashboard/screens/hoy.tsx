"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, Banknote, ChevronDown, ExternalLink, MapPin, Shuffle, UserX } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { GUIDES, VEHICLES, meetingPointById } from "@/content/catalog";
import { needsTransport } from "@/lib/domain/conflicts";
import { formatCountdown, formatDayLong, formatTime, formatUsd, plural, svDateKey, addDays } from "@/lib/domain/format";
import { useConflicts, useDepartures, useNow, type DepartureView } from "@/lib/sim/hooks";
import { sim } from "@/lib/sim/store";
import { EASE_OUT } from "@/lib/ease";
import { cn } from "@/lib/utils";
import { useDash } from "../context";
import { DepartureRow } from "../departure-row";
import { useIndex, type DashIndex } from "../hooks";
import { capitalize, currentDeparture, guideShort, isInProgress, isLive, unassignedSoon, vehicleShort } from "../lib";
import { ArrivalMeter, Manifest, useCheckIn } from "../manifest";
import { QuickActions } from "../quick-actions";
import { ResourcePicker } from "../resource-picker";
import { Btn, DepartureTag, Empty, Paper, Perforation, SectionTitle } from "../ui";
import { WeatherLine } from "../weather";

export function HoyScreen() {
  const idx = useIndex();
  const now = useNow(5000);
  const deps = useDepartures();
  const conflicts = useConflicts();
  const { open } = useDash();
  const checkIn = useCheckIn();
  const reduce = useReducedMotion();
  const [editing, setEditing] = useState<"guide" | "vehicle" | null>(null);

  if (!idx || now === null || !deps) return <HoySkeleton />;

  const next = currentDeparture(deps, now);
  const today = svDateKey(now);
  const tomorrow = addDays(today, 1);
  const crossedIds = new Set((conflicts ?? []).flatMap((c) => c.departureIds));
  const restToday = deps.filter((d) => d.id !== next?.id && svDateKey(d.startsAt) === today && Date.parse(d.endsAt) > now);
  const tomorrowDeps = deps.filter((d) => d.id !== next?.id && svDateKey(d.startsAt) === tomorrow);
  const pendingDeposits = idx.s.bookings.filter((b) => b.payment.method === "wompi" && b.payment.status === "pendiente" && b.status !== "cancelada");
  const unassigned = unassignedSoon(deps, now, idx.tourById);
  const riskUsd = (conflicts ?? []).reduce((n, c) => n + c.costRiskUsd, 0);

  const tour = next ? idx.tourById.get(next.tourId) : undefined;
  const ref = next ? (idx.refs.get(next.id) ?? "") : "";
  const mp = next ? meetingPointById(next.meetingPointId) : undefined;
  const bookings = next ? (idx.byDeparture.get(next.id) ?? []) : [];
  const running = next ? isInProgress(next, now) : false;
  const guide = next ? GUIDES.find((g) => g.id === next.guideId) : undefined;
  const vehicle = next ? VEHICLES.find((v) => v.id === next.vehicleId) : undefined;
  const arriveAt = next && tour ? Date.parse(next.startsAt) - tour.arriveMinutesBefore * 60_000 : 0;

  const assign = async (kind: "guideId" | "vehicleId", value: string | null) => {
    if (!next) return;
    const before = next[kind];
    await sim.assign(next.id, { [kind]: value });
    setEditing(null);
    const name =
      kind === "guideId"
        ? (GUIDES.find((g) => g.id === value)?.name ?? "sin guía")
        : value
          ? vehicleShort(VEHICLES.find((v) => v.id === value)?.name ?? "")
          : "sin vehículo";
    toast(`${ref}: ${kind === "guideId" ? "guía" : "vehículo"} ${name}`, {
      action: { label: "Deshacer", onClick: () => void sim.assign(next.id, { [kind]: before }) },
    });
  };

  return (
    <div className="flex flex-col gap-8 pb-16 lg:grid lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-start lg:gap-10 lg:pb-20">
      <p className="-mb-4 text-[16px] font-medium text-ink-soft lg:col-span-2 lg:-mb-6">{capitalize(formatDayLong(now))}</p>

      {/* Next departure: the itinerary slip Wilber works from */}
      <section aria-labelledby="proxima" className="flex flex-col">
        <SectionTitle id="proxima" aside={next ? (running ? `En ruta hasta ${formatTime(next.endsAt)}` : `Sale ${formatCountdown(next.startsAt, now)}`) : undefined}>
          {running ? "En ruta" : "Próxima salida"}
        </SectionTitle>
        {next && tour ? (
          <Paper className="edge-zigzag-b flex flex-col pb-6 [--z:16px]">
            <div className="flex flex-col gap-3 px-5 pt-5 pb-4">
              <div className="flex items-start justify-between gap-3">
                <button type="button" onClick={() => open({ kind: "departure", id: next.id })} className="pressable -m-1 flex flex-col items-start p-1 text-left">
                  <span className="font-display text-[clamp(64px,18vw,96px)] font-bold uppercase leading-[0.8] tracking-[-0.03em]">{ref}</span>
                  <span className="mt-2 font-display text-[26px] font-semibold uppercase leading-none">{tour.name}</span>
                </button>
                <DepartureTag state={next.state} className="mt-1 shrink-0" />
              </div>
              <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
                <div className="flex flex-col gap-1">
                  <span className="text-[13px] font-medium text-ink-soft">Sale</span>
                  <span className="font-display text-[30px] font-bold leading-none">{formatTime(next.startsAt)}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[13px] font-medium text-ink-soft">Llegar</span>
                  <span className="font-display text-[30px] font-bold leading-none">{formatTime(arriveAt)}</span>
                </div>
                <p className="text-[14px] text-ink-soft">
                  Vuelve {formatTime(next.endsAt)} · {tour.durationHours} h
                </p>
              </div>
              {mp ? (
                <a
                  href={mp.mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="pressable inline-flex w-fit items-start gap-1.5 text-[15px] font-medium underline decoration-ink/30 underline-offset-4 hover:decoration-ink"
                >
                  <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>
                    {mp.name} · {mp.address}
                  </span>
                  <ExternalLink className="mt-1 size-3.5 shrink-0 text-ink-soft" aria-hidden />
                </a>
              ) : null}
              <WeatherLine tour={tour} startsAt={next.startsAt} />
            </div>

            <Perforation />

            {/* Guide and vehicle, editable in place */}
            <div className="grid grid-cols-2 gap-1.5 px-3 pt-3">
              {(["guide", "vehicle"] as const).map((k) => {
                const isGuide = k === "guide";
                const onSite = !isGuide && !vehicle && !needsTransport(tour);
                const value = isGuide ? (guide ? guideShort(guide.name) : "Sin guía") : vehicle ? vehicleShort(vehicle.name) : onSite ? "En el lugar" : "Sin vehículo";
                const missing = isGuide ? !guide : !vehicle && !onSite;
                const on = editing === k;
                return (
                  <button
                    key={k}
                    type="button"
                    aria-expanded={on}
                    onClick={() => setEditing(on ? null : k)}
                    className={cn("pressable flex items-center justify-between gap-2 rounded-field bg-ink/5 px-4 py-3 text-left hover:bg-ink/10", on && "bg-ink/10")}
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="text-[13px] font-medium text-ink-soft">{isGuide ? "Guía" : "Vehículo"}</span>
                      <span className={cn("truncate text-[18px] font-semibold", missing && "text-destructive")}>{value}</span>
                    </span>
                    <ChevronDown className={cn("size-5 shrink-0 text-ink-soft transition-transform duration-200", on && "rotate-180")} aria-hidden />
                  </button>
                );
              })}
            </div>
            <AnimatePresence initial={false}>
              {editing ? (
                <motion.div
                  key={editing}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                  animate={reduce ? { opacity: 1 } : { opacity: 1, height: "auto" }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                  transition={{ duration: 0.24, ease: EASE_OUT }}
                  className="overflow-hidden"
                >
                  <div className="px-5 pt-3 pb-1">
                    <ResourcePicker
                      kind={editing}
                      departure={next}
                      departures={idx.s.departures}
                      tour={tour}
                      value={editing === "guide" ? next.guideId : next.vehicleId}
                      onChange={(v) => void assign(editing === "guide" ? "guideId" : "vehicleId", v)}
                      now={now}
                      refs={idx.refs}
                    />
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>

            <Perforation className="mt-4" />

            {/* Check-in */}
            <div className="flex flex-col gap-4 px-5 pt-4">
              {bookings.filter(isLive).length ? (
                <>
                  <ArrivalMeter bookings={bookings} pending={checkIn.pending} />
                  <Manifest departure={next} bookings={bookings} checkIn={checkIn} onOpen={(id) => open({ kind: "booking", id })} className="-mx-2" />
                </>
              ) : (
                <Empty>Nadie reservó esta salida todavía.</Empty>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                <Btn variant="quiet" onClick={() => open({ kind: "departure", id: next.id })}>
                  Ver salida completa <ArrowRight className="size-4" />
                </Btn>
              </div>
            </div>
          </Paper>
        ) : (
          <Empty action={<Btn onClick={() => open({ kind: "new-departure" })}>Nueva salida</Btn>}>No hay salidas próximas.</Empty>
        )}
      </section>

      <div className="flex flex-col gap-8">
        {/* Alerts */}
        <section aria-labelledby="alertas">
          <SectionTitle id="alertas">Alertas</SectionTitle>
          <ul className="flex flex-col gap-1.5">
            {conflicts && conflicts.length ? (
              <li>
                <Link href="/wilber/cruces" className="pressable flex items-center gap-3 rounded-field bg-destructive px-4 py-3.5 text-paper hover:brightness-110">
                  <Shuffle className="size-5 shrink-0" aria-hidden />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-[17px] font-bold leading-tight">{plural(conflicts.length, "cruce", "cruces")}</span>
                    <span className="text-[14px] leading-tight opacity-90">{formatUsd(riskUsd)} en riesgo · {conflicts[0].title}</span>
                  </span>
                  <ArrowRight className="size-5 shrink-0" aria-hidden />
                </Link>
              </li>
            ) : null}
            {pendingDeposits.length ? (
              <li>
                <Link href="/wilber/reservas?estado=pendiente_pago" className="pressable flex items-center gap-3 rounded-field bg-paper px-4 py-3.5 text-paper-ink hover:bg-surface-2">
                  <Banknote className="size-5 shrink-0" aria-hidden />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-[17px] font-bold leading-tight">{plural(pendingDeposits.length, "anticipo pendiente", "anticipos pendientes")}</span>
                    <span className="text-[14px] leading-tight text-ink-soft">
                      {formatUsd(pendingDeposits.reduce((n, b) => n + b.payment.amountUsd, 0))} en línea sin confirmar
                    </span>
                  </span>
                  <ArrowRight className="size-5 shrink-0 text-ink-soft" aria-hidden />
                </Link>
              </li>
            ) : null}
            {unassigned.slice(0, 3).map((d) => {
              const t = idx.tourById.get(d.tourId);
              const missing = [!d.guideId ? "guía" : null, !d.vehicleId && t && needsTransport(t) ? "vehículo" : null].filter(Boolean).join(" ni ");
              return (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => open({ kind: "departure", id: d.id })}
                    className="pressable flex w-full items-center gap-3 rounded-field bg-paper px-4 py-3.5 text-left text-paper-ink hover:bg-surface-2"
                  >
                    <UserX className="size-5 shrink-0 text-destructive" aria-hidden />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-[17px] font-bold leading-tight">
                        {idx.refs.get(d.id)} sin {missing}
                      </span>
                      <span className="text-[14px] leading-tight text-ink-soft">
                        {t?.shortName} · sale {formatCountdown(d.startsAt, now)} · {plural(d.seatsTaken, "persona", "personas")}
                      </span>
                    </span>
                    <ArrowRight className="size-5 shrink-0 text-ink-soft" aria-hidden />
                  </button>
                </li>
              );
            })}
            {unassigned.length > 3 ? (
              <li>
                <Link href="/wilber/cruces" className="pressable flex items-center justify-between gap-3 rounded-field bg-paper px-4 py-3 text-[15px] font-semibold text-paper-ink hover:bg-surface-2">
                  {plural(unassigned.length - 3, "salida más", "salidas más")} sin guía o vehículo
                  <ArrowRight className="size-5 shrink-0 text-ink-soft" aria-hidden />
                </Link>
              </li>
            ) : null}
            {!conflicts?.length && !pendingDeposits.length && !unassigned.length ? (
              <li>
                <Empty>Sin alertas.</Empty>
              </li>
            ) : null}
          </ul>
        </section>

        <DayList title="Resto de hoy" deps={restToday} idx={idx} crossed={crossedIds} onOpen={(id) => open({ kind: "departure", id })} empty="No hay más salidas hoy." />
        <DayList title="Mañana" deps={tomorrowDeps} idx={idx} crossed={crossedIds} onOpen={(id) => open({ kind: "departure", id })} empty="No hay salidas mañana." />
      </div>

      <QuickActions next={next} nextRef={ref || undefined} />
    </div>
  );
}

function DayList({
  title,
  deps,
  idx,
  crossed,
  onOpen,
  empty,
}: {
  title: string;
  deps: DepartureView[];
  idx: DashIndex;
  crossed: Set<string>;
  onOpen: (id: string) => void;
  empty: string;
}) {
  const people = deps.filter((d) => d.status !== "cancelada").reduce((n, d) => n + d.seatsTaken, 0);
  return (
    <section>
      <SectionTitle aside={deps.length ? `${plural(deps.length, "salida", "salidas")} · ${plural(people, "persona", "personas")}` : undefined}>{title}</SectionTitle>
      {deps.length ? (
        <ul className="flex flex-col gap-1.5">
          {deps.map((d) => (
            <li key={d.id}>
              <DepartureRow dep={d} tour={idx.tourById.get(d.tourId)} refCode={idx.refs.get(d.id) ?? ""} crossed={crossed.has(d.id)} onOpen={() => onOpen(d.id)} />
            </li>
          ))}
        </ul>
      ) : (
        <Empty>{empty}</Empty>
      )}
    </section>
  );
}

function HoySkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <div className="h-5 w-48 rounded-full bg-ink/10" />
      <div className="h-[420px] rounded-ticket bg-paper" />
      <div className="h-24 rounded-ticket bg-paper" />
    </div>
  );
}
