"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, ExternalLink, Lock, LockOpen, MapPin, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { BoletoStrip } from "@/components/booking/boleto-strip";
import {
  AdaptiveStepper,
  AdaptiveStepperDecrement,
  AdaptiveStepperIncrement,
  AdaptiveStepperValue,
} from "@/components/motion/adaptive-stepper";
import { HoldActionButton } from "@/components/motion/hold-action-button";
import { Switch } from "@/components/motion/switch";
import { GUIDES, VEHICLES, meetingPointById } from "@/content/catalog";
import { CONFLICT_KIND_LABEL } from "@/lib/domain/conflicts";
import { activeHolds } from "@/lib/domain/availability";
import type { Departure } from "@/lib/domain/types";
import { formatDayLong, formatTime, formatUsd, plural } from "@/lib/domain/format";
import { EASE_OUT } from "@/lib/ease";
import { useConflicts, useDeparture, useNow } from "@/lib/sim/hooks";
import { sim } from "@/lib/sim/store";
import { cn } from "@/lib/utils";
import { useDash } from "./context";
import { useIndex } from "./hooks";
import { isLive, vehicleShort } from "./lib";
import { ArrivalMeter, Manifest, useCheckIn } from "./manifest";
import { SheetHeader } from "./overlay-host";
import { ResourcePicker } from "./resource-picker";
import { ActionButton, Btn, DepartureTag, Empty, FieldLabel, Perforation, STEPPER_CLASS, Stamp, btn, inputClass, useAsyncAction } from "./ui";
import { WeatherLine } from "./weather";

type Patch = Partial<Pick<Departure, "capacity" | "priceUsd" | "guideId" | "vehicleId" | "notes" | "prepReady" | "status">>;

/** Local copy of a value that follows the simulation unless the user is mid-change. */
function useSynced<T>(external: T): [T, (v: T) => void] {
  const [local, setLocal] = useState(external);
  const [prev, setPrev] = useState(external);
  if (external !== prev) {
    setPrev(external);
    setLocal(external);
  }
  return [local, setLocal];
}

function SavedFlash({ show }: { show: boolean }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence>
      {show ? (
        <motion.span
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, transition: { duration: 0.2 } }}
          transition={{ duration: 0.18, ease: EASE_OUT }}
          className="inline-flex items-center gap-1 text-[13px] font-semibold text-ink"
        >
          <Check className="size-3.5" strokeWidth={3} /> Guardado
        </motion.span>
      ) : null}
    </AnimatePresence>
  );
}

function useFlash() {
  const [key, setKey] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const flash = (k: string) => {
    window.clearTimeout(timer.current);
    setKey(k);
    timer.current = window.setTimeout(() => setKey(null), 1400);
  };
  return [key, flash] as const;
}

export function DepartureView({ id }: { id: string }) {
  const idx = useIndex();
  const dep = useDeparture(id);
  const now = useNow(5000);
  const conflicts = useConflicts();
  const { push } = useDash();
  const checkIn = useCheckIn();
  const [flashKey, flash] = useFlash();
  const [cap, setCap] = useSynced(dep?.capacity ?? 0);
  const [price, setPrice] = useSynced(dep?.priceUsd ?? 0);
  const [notes, setNotes] = useSynced(dep?.notes ?? "");
  const [noteState, runNote] = useAsyncAction();
  const [fillState, runFill] = useAsyncAction();
  const [reason, setReason] = useState("");
  const [fixing, setFixing] = useState<string | null>(null);

  if (dep === undefined || !idx || now === null) {
    return (
      <>
        <SheetHeader title="Salida" />
        <div className="h-40 animate-pulse bg-ink/5" />
      </>
    );
  }
  if (dep === null) {
    return (
      <>
        <SheetHeader title="Salida" />
        <Empty>Esa salida ya no existe.</Empty>
      </>
    );
  }

  const tour = idx.tourById.get(dep.tourId);
  const ref = idx.refs.get(dep.id) ?? "";
  const mp = meetingPointById(dep.meetingPointId);
  const bookings = idx.byDeparture.get(dep.id) ?? [];
  const live = bookings.filter(isLive);
  const groups = live.length;
  const held = activeHolds(idx.s.holds, dep.id, now).reduce((n, h) => n + h.partySize, 0);
  const mine = (conflicts ?? []).filter((c) => c.departureIds.includes(dep.id));
  const past = Date.parse(dep.endsAt) <= now;
  const editable = dep.status !== "cancelada" && dep.status !== "realizada" && !past;
  const vehicle = VEHICLES.find((v) => v.id === dep.vehicleId);

  const commit = async (patch: Patch, key: string) => {
    try {
      await sim.updateDeparture(dep.id, patch);
      flash(key);
    } catch {
      toast.error("No se guardó el cambio. Probá de nuevo.");
    }
  };

  const assign = async (kind: "guideId" | "vehicleId", value: string | null) => {
    const before = dep[kind];
    await sim.assign(dep.id, { [kind]: value });
    const name =
      kind === "guideId"
        ? (GUIDES.find((g) => g.id === value)?.name ?? "sin guía")
        : value
          ? vehicleShort(VEHICLES.find((v) => v.id === value)?.name ?? "")
          : "sin vehículo";
    toast(`${ref}: ${kind === "guideId" ? "guía" : "vehículo"} ${name}`, {
      action: { label: "Deshacer", onClick: () => void sim.assign(dep.id, { [kind]: before }) },
    });
  };

  const toggleSale = async () => {
    const next = dep.status === "abierta" ? "cerrada" : "abierta";
    await sim.updateDeparture(dep.id, { status: next });
    toast(next === "cerrada" ? `${ref} cerrada: no recibe reservas en línea` : `${ref} abierta a reservas en línea`, {
      action: { label: "Deshacer", onClick: () => void sim.updateDeparture(dep.id, { status: dep.status }) },
    });
  };

  const fix = async (conflictId: string, cost: number, label: string) => {
    setFixing(conflictId);
    try {
      const ok = await sim.applyFix(conflictId);
      if (ok) toast.success(`${label} · ${formatUsd(cost)} protegidos`);
      else toast.error("Ese cruce cambió mientras lo mirabas. Revisalo de nuevo.");
    } finally {
      setFixing(null);
    }
  };

  const cancel = async () => {
    const text = reason.trim();
    await sim.cancelDeparture(dep.id, text);
    toast.success(`${ref} cancelada · ${plural(groups, "grupo avisado", "grupos avisados")} por WhatsApp`);
    setReason("");
  };

  return (
    <div className="flex flex-col gap-6">
      <SheetHeader title={`Salida ${ref}`} />

      {/* Hero: the ticket header */}
      <header className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <p className="font-display text-[64px] font-bold uppercase leading-[0.82] tracking-[-0.02em] text-ink">{ref}</p>
          <DepartureTag state={dep.state} className="mt-1" />
        </div>
        <h3 className="font-display text-[26px] font-semibold uppercase leading-none text-ink">{tour?.name ?? "Tour"}</h3>
        <p className="text-[16px] text-ink">
          <span className="font-semibold">{formatDayLong(dep.startsAt)}</span> · {formatTime(dep.startsAt)} a {formatTime(dep.endsAt)}
        </p>
        {mp ? (
          <a
            href={mp.mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="pressable inline-flex w-fit items-center gap-1.5 text-[15px] font-medium text-ink underline decoration-ink/30 underline-offset-4 hover:decoration-ink"
          >
            <MapPin className="size-4" aria-hidden />
            {mp.name}
            <ExternalLink className="size-3.5 text-ink-soft" aria-hidden />
          </a>
        ) : null}
        {!past && dep.status !== "cancelada" ? <WeatherLine tour={tour} startsAt={dep.startsAt} /> : null}
      </header>

      {/* Crosses on this departure */}
      <AnimatePresence initial={false}>
        {mine.map((c) => (
          <motion.div
            key={c.id}
            layout
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.16 } }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
            className="flex flex-col gap-2 bg-destructive/10 px-4 py-3"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-[15px] font-semibold leading-snug text-destructive">{c.title}</p>
              <Stamp tilt={false} className="shrink-0 text-[13px]">
                {CONFLICT_KIND_LABEL[c.kind]}
              </Stamp>
            </div>
            <p className="text-[14px] leading-snug text-ink">{c.detail}</p>
            {c.fix ? (
              <Btn variant="stamp" size="sm" className="w-fit" disabled={fixing === c.id} onClick={() => void fix(c.id, c.costRiskUsd, c.fix!.label)}>
                {fixing === c.id ? "Arreglando" : c.fix.label}
              </Btn>
            ) : null}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Seats */}
      <section className="flex flex-col gap-3">
        <BoletoStrip capacity={dep.capacity} taken={dep.seatsTaken} held={held} />
        <p className="text-[15px] text-ink">
          <span className="font-semibold tabular">
            {dep.seatsTaken} de {dep.capacity}
          </span>{" "}
          vendidos · {dep.left === 0 ? <span className="font-semibold text-destructive">sin cupos</span> : `quedan ${dep.left}`}
          {held ? ` · ${held} apartados` : ""} · {plural(groups, "grupo", "grupos")}
        </p>
      </section>

      {editable ? (
        <section className="grid gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <FieldLabel hint={<SavedFlash show={flashKey === "cap"} />}>Cupos</FieldLabel>
            <AdaptiveStepper
              className={STEPPER_CLASS}
              value={cap}
              min={Math.max(1, dep.seatsTaken)}
              max={25}
              onValueChange={(v) => {
                setCap(v);
                void commit({ capacity: v }, "cap");
              }}
              aria-label="Cupos"
              formatValueText={(v) => `${v} cupos`}
            >
              <AdaptiveStepperDecrement aria-label="Quitar un cupo" />
              <AdaptiveStepperValue />
              <AdaptiveStepperIncrement aria-label="Agregar un cupo" />
            </AdaptiveStepper>
            <p className="text-[13px] text-ink-soft">
              Mínimo {Math.max(1, dep.seatsTaken)}: ya hay {plural(dep.seatsTaken, "vendido", "vendidos")}.
              {vehicle && cap > vehicle.seats ? <span className="text-destructive"> {vehicleShort(vehicle.name)} tiene {vehicle.seats} asientos.</span> : null}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <FieldLabel hint={<SavedFlash show={flashKey === "price"} />}>Precio por persona</FieldLabel>
            <AdaptiveStepper
              className={STEPPER_CLASS}
              value={price}
              min={1}
              max={500}
              onValueChange={(v) => {
                setPrice(v);
                void commit({ priceUsd: v }, "price");
              }}
              aria-label="Precio por persona"
              formatValueText={(v) => formatUsd(v)}
            >
              <AdaptiveStepperDecrement aria-label="Bajar un dólar" />
              <AdaptiveStepperValue>{(v: number) => formatUsd(v)}</AdaptiveStepperValue>
              <AdaptiveStepperIncrement aria-label="Subir un dólar" />
            </AdaptiveStepper>
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-2">
        <FieldLabel>Guía</FieldLabel>
        <ResourcePicker
          kind="guide"
          departure={dep}
          departures={idx.s.departures}
          tour={tour}
          value={dep.guideId}
          onChange={(v) => void assign("guideId", v)}
          now={now}
          refs={idx.refs}
          disabled={!editable}
        />
      </section>
      <section className="flex flex-col gap-2">
        <FieldLabel>Vehículo</FieldLabel>
        <ResourcePicker
          kind="vehicle"
          departure={dep}
          departures={idx.s.departures}
          tour={tour}
          value={dep.vehicleId}
          onChange={(v) => void assign("vehicleId", v)}
          now={now}
          refs={idx.refs}
          disabled={!editable}
        />
      </section>

      {editable ? (
        <>
          <section className="flex items-center justify-between gap-3 bg-ink/5 px-4 py-3">
            <div className="flex flex-col">
              <span className="text-[15px] font-semibold text-ink">Indicaciones listas</span>
              <span className="text-[13px] text-ink-soft">{dep.prepReady ? "Publicadas" : "Sin publicar"}</span>
            </div>
            <Switch
              checked={dep.prepReady}
              ariaLabel="Indicaciones listas"
              onCheckedChange={(v) => {
                void commit({ prepReady: v }, "prep");
                toast(v ? `${ref}: indicaciones publicadas` : `${ref}: indicaciones en borrador`);
              }}
            />
          </section>

          <section className="flex flex-col gap-2">
            <FieldLabel htmlFor={`nota-${dep.id}`} hint={`${notes.length}/280`}>
              Nota para el grupo
            </FieldLabel>
            <textarea
              id={`nota-${dep.id}`}
              value={notes}
              maxLength={280}
              rows={3}
              onChange={(e) => setNotes(e.target.value)}
              className={cn(inputClass, "h-auto min-h-[96px] resize-y py-3 leading-snug")}
            />
            <ActionButton
              state={noteState}
              disabled={notes === (dep.notes ?? "")}
              onClick={() => void runNote(() => sim.updateDeparture(dep.id, { notes: notes.trim() || undefined }))}
              variant="quiet"
              size="sm"
              className="w-fit"
              successText="Nota guardada"
            >
              Guardar nota
            </ActionButton>
          </section>

          <section className="flex flex-wrap items-center gap-2">
            <Btn variant={dep.status === "abierta" ? "quiet" : "primary"} onClick={() => void toggleSale()}>
              {dep.status === "abierta" ? <Lock className="size-4" /> : <LockOpen className="size-4" />}
              {dep.status === "abierta" ? "Cerrar venta en línea" : "Abrir venta en línea"}
            </Btn>
          </section>
        </>
      ) : null}

      <Perforation className="[--perf:var(--ground)]" />

      <section className="flex flex-col gap-3">
        <div className="flex items-end justify-between gap-3">
          <h3 className="font-display text-[22px] font-bold uppercase leading-none text-ink">Manifiesto</h3>
          {editable && dep.left > 0 ? (
            <button type="button" className={btn("quiet", "sm")} onClick={() => push({ kind: "new-booking", departureId: dep.id })}>
              <Plus className="size-4" /> Reserva manual
            </button>
          ) : null}
        </div>
        {live.length ? <ArrivalMeter bookings={bookings} pending={checkIn.pending} /> : null}
        {bookings.length ? (
          <Manifest
            departure={dep}
            bookings={bookings}
            checkIn={checkIn}
            readOnly={dep.status === "cancelada"}
            onOpen={(bid) => push({ kind: "booking", id: bid })}
          />
        ) : (
          <Empty>Nadie reservó todavía.</Empty>
        )}
      </section>

      {editable ? (
        <>
          <section className="flex flex-wrap items-center justify-between gap-3 bg-ink/5 px-4 py-3">
            <div className="flex flex-col">
              <span className="text-[15px] font-semibold text-ink">Llenar salida</span>
              <span className="text-[13px] text-ink-soft">Simulación: reservas de prueba hasta el último cupo.</span>
            </div>
            <ActionButton
              state={fillState}
              disabled={dep.left === 0}
              variant="quiet"
              size="sm"
              loadingText="Llenando"
              successText="Llena"
              onClick={() =>
                void runFill(async () => {
                  await sim.fillDeparture(dep.id, 0);
                  toast(`${ref} llena: ${dep.capacity} de ${dep.capacity}`);
                })
              }
            >
              Llenar
            </ActionButton>
          </section>

          <section className="flex flex-col gap-2">
            <FieldLabel htmlFor={`motivo-${dep.id}`} hint={groups ? `Avisa a ${plural(groups, "grupo", "grupos")} por WhatsApp` : undefined}>
              Cancelar salida
            </FieldLabel>
            <textarea
              id={`motivo-${dep.id}`}
              value={reason}
              maxLength={200}
              rows={2}
              placeholder="Motivo (lo recibe cada grupo)"
              onChange={(e) => setReason(e.target.value)}
              className={cn(inputClass, "h-auto min-h-[72px] resize-y py-3 leading-snug")}
            />
            <HoldActionButton
              type="horizontal"
              holdDuration={1300}
              disabled={reason.trim().length < 4}
              onHoldComplete={() => void cancel()}
              holdingLabel="Seguí presionando"
              completeLabel="Cancelada"
              className="h-14 w-full min-w-0 rounded-none bg-destructive text-paper [--hold-radius:0px] [&_svg]:text-cobalt-950/30!"
              fillClassName="bg-cobalt-950/30"
              labelClassName="text-[16px] font-semibold"
            >
              {reason.trim().length < 4 ? "Escribí el motivo para cancelar" : `Mantené presionado para cancelar ${ref}`}
            </HoldActionButton>
          </section>
        </>
      ) : dep.status === "cancelada" ? (
        <Empty>Salida cancelada. Los grupos recibieron el aviso por WhatsApp.</Empty>
      ) : null}
    </div>
  );
}
