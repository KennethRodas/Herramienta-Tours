"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import {
  AdaptiveStepper,
  AdaptiveStepperDecrement,
  AdaptiveStepperIncrement,
  AdaptiveStepperValue,
} from "@/components/motion/adaptive-stepper";
import {
  DateRangePicker,
  DateRangePickerCalendar,
  DateRangePickerGrid,
  DateRangePickerHeader,
} from "@/components/motion/date-range-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/motion/select";
import { WheelPicker } from "@/components/motion/wheel-picker";
import { GUIDES, VEHICLES } from "@/content/catalog";
import { CONFLICT_KIND_LABEL, detectConflicts } from "@/lib/domain/conflicts";
import type { Departure } from "@/lib/domain/types";
import { HOUR, addDays, formatDayLong, formatTime, formatUsd, svDateKey, svISO } from "@/lib/domain/format";
import { EASE_OUT } from "@/lib/ease";
import { useNow } from "@/lib/sim/hooks";
import { sim } from "@/lib/sim/store";
import { useDash } from "./context";
import { useIndex } from "./hooks";
import { SheetHeader } from "./overlay-host";
import { ResourcePicker } from "./resource-picker";
import { ActionButton, Btn, FieldLabel, STEPPER_CLASS, Stamp, useAsyncAction } from "./ui";

const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0")); // taste-skill-ignore: clock hours
const MINUTES = ["00", "15", "30", "45"];
const NEW_ID = "nueva";

export function NewDepartureForm({ tourId: initialTour, dateKey: initialDate }: { tourId?: string; dateKey?: string }) {
  const idx = useIndex();
  const now = useNow(30_000);
  const { replace } = useDash();
  const [state, run] = useAsyncAction();
  const today = now !== null ? svDateKey(now) : undefined;

  const [tourId, setTourId] = useState(initialTour ?? "t-santa-ana");
  const tour = idx?.tourById.get(tourId);
  const [dateKey, setDateKey] = useState<string | undefined>(initialDate);
  const [time, setTime] = useState<string | null>(null);
  const [capacity, setCapacity] = useState<number | null>(null);
  const [price, setPrice] = useState<number | null>(null);
  const [guideId, setGuideId] = useState<string | null>(null);
  const [vehicleId, setVehicleId] = useState<string | null>(null);

  if (!idx || now === null || !tour || !today) {
    return (
      <>
        <SheetHeader title="Nueva salida" />
        <div className="h-40 rounded-ticket bg-ink/5" />
      </>
    );
  }

  const hhmm = time ?? tour.departureTime;
  // Default to tomorrow once today's departure time has gone by.
  const fallbackDay = Date.parse(svISO(today, hhmm)) <= now ? addDays(today, 1) : today;
  const day = dateKey && dateKey >= today ? dateKey : fallbackDay;
  const cap = capacity ?? tour.capacity;
  const usd = price ?? tour.priceUsd;
  const startsAt = svISO(day, hhmm);
  const endsAt = new Date(Date.parse(startsAt) + tour.durationHours * HOUR).toISOString();
  const inPast = Date.parse(startsAt) <= now;

  const hypo: Departure = {
    id: NEW_ID,
    tourId,
    startsAt,
    endsAt,
    capacity: cap,
    seatsTaken: 0,
    priceUsd: usd,
    status: "abierta",
    guideId,
    vehicleId,
    meetingPointId: tour.meetingPointId,
    prepReady: true,
    createdAt: startsAt,
  };
  const preview = detectConflicts({
    departures: [...idx.s.departures, hypo],
    tours: idx.tours,
    guides: GUIDES,
    vehicles: VEHICLES,
    now,
  }).filter((c) => c.departureIds.includes(NEW_ID));
  const sameDay = idx.s.departures.filter((d) => d.tourId === tourId && d.status !== "cancelada" && svDateKey(d.startsAt) === day);
  const refs = new Map(idx.refs);
  refs.set(NEW_ID, "esta salida");

  const save = () =>
    run(async () => {
      const dep = await sim.createDeparture({ tourId, dateKey: day, time: hhmm, capacity: cap, priceUsd: usd, guideId, vehicleId });
      toast.success(`Salida creada: ${tour.shortName} ${formatDayLong(dep.startsAt)}, ${formatTime(dep.startsAt)}`);
      window.setTimeout(() => replace({ kind: "departure", id: dep.id }), 450);
    });

  const [hh, mm] = hhmm.split(":");

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (!inPast) void save();
      }}
    >
      <SheetHeader title="Nueva salida" />

      <section className="flex flex-col gap-2">
        <FieldLabel>Tour</FieldLabel>
        <Select
          value={tourId}
          onValueChange={(v) => {
            setTourId(v);
            setTime(null);
            setCapacity(null);
            setPrice(null);
          }}
        >
          <SelectTrigger className="h-12 rounded-field! text-[16px]">
            <SelectValue placeholder="Elegí un tour" />
          </SelectTrigger>
          <SelectContent className="max-h-72 overflow-y-auto rounded-field!">
            {idx.tours.map((t) => (
              <SelectItem key={t.id} value={t.id} className="rounded-field py-2 text-[15px]">
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[13px] text-ink-soft">
          {tour.durationHours} h · {formatUsd(tour.priceUsd)} · cupo {tour.capacity} · sale {tour.departureTime}
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <FieldLabel hint={formatDayLong(startsAt)}>Fecha</FieldLabel>
        <DateRangePicker
          value={{ from: day, to: day }}
          onValueChange={(r) => {
            if (!r) return;
            setDateKey(r.to && r.to !== day ? r.to : r.from);
          }}
          min={today}
          locale="es-SV"
          label="Fecha de la salida"
          showSummary={false}
        >
          <DateRangePickerCalendar showSummary={false} className="w-full max-w-[22rem] rounded-field border-0 bg-ink/5 p-3">
            <DateRangePickerHeader />
            <DateRangePickerGrid />
          </DateRangePickerCalendar>
        </DateRangePicker>
      </section>

      <section className="grid gap-5 sm:grid-cols-[auto_minmax(0,1fr)]">
        <div className="flex flex-col gap-2">
          <FieldLabel hint={formatTime(startsAt)}>Hora</FieldLabel>
          <div className="flex items-center gap-1">
            <WheelPicker
              aria-label="Hora"
              options={HOURS}
              value={hh}
              onValueChange={(h) => setTime(`${h}:${mm}`)}
              visibleCount={5}
              itemHeight={34}
              className="w-[72px] rounded-field border-0 bg-ink/5 text-[18px] tabular"
            />
            <span className="font-display text-[24px] font-bold text-ink">:</span>
            <WheelPicker
              aria-label="Minutos"
              options={MINUTES}
              value={MINUTES.includes(mm) ? mm : "00"}
              onValueChange={(m) => setTime(`${hh}:${m}`)}
              visibleCount={5}
              itemHeight={34}
              className="w-[72px] rounded-field border-0 bg-ink/5 text-[18px] tabular"
            />
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <FieldLabel>Cupos</FieldLabel>
            <AdaptiveStepper className={STEPPER_CLASS} value={cap} min={1} max={25} onValueChange={setCapacity} aria-label="Cupos" formatValueText={(v) => `${v} cupos`}>
              <AdaptiveStepperDecrement aria-label="Quitar un cupo" />
              <AdaptiveStepperValue />
              <AdaptiveStepperIncrement aria-label="Agregar un cupo" />
            </AdaptiveStepper>
          </div>
          <div className="flex flex-col gap-2">
            <FieldLabel>Precio por persona</FieldLabel>
            <AdaptiveStepper className={STEPPER_CLASS} value={usd} min={1} max={500} onValueChange={setPrice} aria-label="Precio por persona" formatValueText={(v) => formatUsd(v)}>
              <AdaptiveStepperDecrement aria-label="Bajar un dólar" />
              <AdaptiveStepperValue>{(v: number) => formatUsd(v)}</AdaptiveStepperValue>
              <AdaptiveStepperIncrement aria-label="Subir un dólar" />
            </AdaptiveStepper>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <FieldLabel>Guía</FieldLabel>
        <ResourcePicker kind="guide" departure={hypo} departures={idx.s.departures} tour={tour} value={guideId} onChange={setGuideId} now={now} refs={refs} />
      </section>
      <section className="flex flex-col gap-2">
        <FieldLabel>Vehículo</FieldLabel>
        <ResourcePicker kind="vehicle" departure={hypo} departures={idx.s.departures} tour={tour} value={vehicleId} onChange={setVehicleId} now={now} refs={refs} />
      </section>

      {sameDay.length ? (
        <p className="rounded-field bg-ink/5 px-4 py-3 text-[14px] text-ink">
          Ese día ya sale {tour.shortName} a las {sameDay.map((d) => formatTime(d.startsAt)).join(" y ")} ({sameDay.map((d) => idx.refs.get(d.id)).join(", ")}).
        </p>
      ) : null}

      <AnimatePresence initial={false}>
        {preview.length ? (
          <motion.section
            key="cruces"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
            className="flex flex-col gap-2 rounded-field bg-destructive/10 px-4 py-3"
            aria-live="polite"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[15px] font-bold text-destructive">
                {preview.length === 1 ? "Esta salida provoca un cruce" : `Esta salida provoca ${preview.length} cruces`}
              </span>
              <Stamp className="text-[13px]">Cruce</Stamp>
            </div>
            <ul className="flex flex-col gap-2">
              {preview.map((c) => (
                <li key={c.id} className="flex flex-col gap-1">
                  <span className="text-[14px] font-semibold text-ink">
                    {CONFLICT_KIND_LABEL[c.kind]}: {c.title}
                  </span>
                  <span className="text-[13px] leading-snug text-ink-soft">{c.detail}</span>
                  {c.fix && c.fix.departureId === NEW_ID ? (
                    <Btn
                      variant="stamp"
                      size="sm"
                      className="w-fit"
                      onClick={() => {
                        if (c.fix?.guideId) setGuideId(c.fix.guideId);
                        if (c.fix?.vehicleId) setVehicleId(c.fix.vehicleId);
                      }}
                    >
                      {c.fix.label.replace(/^(Pasar|Mandar) .+? (a|en) /, "Usar ")}
                    </Btn>
                  ) : null}
                </li>
              ))}
            </ul>
          </motion.section>
        ) : null}
      </AnimatePresence>

      <div className="sticky bottom-0 z-10 -mx-4 bg-paper px-4 pt-2 pb-[calc(env(safe-area-inset-bottom,0px)+8px)] lg:-mx-6 lg:px-6">
        <ActionButton
          type="submit"
          state={state}
          disabled={inPast}
          variant={preview.length ? "stamp" : "primary"}
          size="lg"
          className="w-full"
          loadingText="Creando"
          successText="Creada"
        >
          {inPast ? "Esa hora ya pasó" : preview.length ? `Crear con ${preview.length === 1 ? "1 cruce" : `${preview.length} cruces`}` : "Crear salida"}
        </ActionButton>
      </div>
    </form>
  );
}
