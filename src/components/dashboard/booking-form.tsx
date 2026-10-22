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
import { Input } from "@/components/motion/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/motion/select";
import { BOOKING_CUTOFF_MS, isBookable, validateBooking, type BookingFieldErrors } from "@/lib/domain/availability";
import type { BookingInput } from "@/lib/domain/types";
import { formatDayShort, formatTime, formatUsd, plural } from "@/lib/domain/format";
import { EASE_OUT } from "@/lib/ease";
import { useDepartures, useNow } from "@/lib/sim/hooks";
import { sim } from "@/lib/sim/store";
import { cn } from "@/lib/utils";
import { useDash } from "./context";
import { useIndex } from "./hooks";
import { SheetHeader } from "./overlay-host";
import { ActionButton, FieldError, FieldLabel, STEPPER_CLASS, SeatMeter, inputClass, useAsyncAction } from "./ui";

const fieldClasses = {
  field: "h-12 rounded-field bg-background",
  label: "px-0 text-[14px] font-semibold text-ink",
  input: "text-[16px]",
  errorMessage: "px-0 text-[13px] font-medium",
};

export function ManualBookingForm({ departureId: initialDeparture }: { departureId?: string }) {
  const idx = useIndex();
  const now = useNow(15_000);
  const deps = useDepartures();
  const { replace } = useDash();
  const [state, run] = useAsyncAction();
  const [departureId, setDepartureId] = useState<string | undefined>(initialDeparture);
  const [tourFilter, setTourFilter] = useState<string | undefined>(undefined);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [party, setParty] = useState(2);
  const [errors, setErrors] = useState<BookingFieldErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [tried, setTried] = useState(false);

  if (!idx || now === null || !deps) {
    return (
      <>
        <SheetHeader title="Reserva manual" />
        <div className="h-40 rounded-ticket bg-ink/5" />
      </>
    );
  }

  const open = deps.filter((d) => isBookable(d.state) && Date.parse(d.startsAt) - BOOKING_CUTOFF_MS > now);
  const chosen = departureId ? deps.find((d) => d.id === departureId) : undefined;
  const tourOfChosen = chosen ? idx.tourById.get(chosen.tourId) : undefined;
  const activeTour = tourFilter ?? chosen?.tourId ?? open[0]?.tourId;
  const choices = open.filter((d) => d.tourId === activeTour).slice(0, 10);
  const maxParty = Math.max(1, Math.min(25, chosen?.left ?? 25));
  const size = Math.min(party, maxParty);

  const input = (): BookingInput => ({
    departureId: chosen?.id ?? "",
    name,
    phone,
    email: email || undefined,
    partySize: size,
    notes: notes || undefined,
    paymentMethod: "en_sitio",
    source: "manual",
  });

  const revalidate = (next: Partial<{ name: string; phone: string; email: string }>) => {
    if (!tried) return;
    const v = validateBooking({ ...input(), ...next, email: (next.email ?? email) || undefined });
    setErrors(v.ok ? {} : v.errors);
  };

  const submit = () =>
    run(async () => {
      setTried(true);
      setFailure(null);
      if (!chosen) {
        setFailure("Elegí la salida.");
        throw new Error("sin salida");
      }
      const v = validateBooking(input());
      if (!v.ok) {
        setErrors(v.errors);
        throw new Error("datos");
      }
      setErrors({});
      const result = await sim.book({ ...v.data, source: "manual" }, "wilber");
      if (!result.ok) {
        setFailure(result.message);
        throw new Error(result.reason);
      }
      toast.success(`${result.booking.code} · ${result.booking.name} × ${result.booking.partySize}`, {
        description: `${tourOfChosen?.shortName ?? ""} ${formatDayShort(chosen.startsAt)} ${formatTime(chosen.startsAt)}`,
      });
      window.setTimeout(() => replace({ kind: "booking", id: result.booking.id }), 450);
    });

  return (
    <form
      className="flex flex-col gap-5"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <SheetHeader title="Reserva manual" />

      <section className="flex flex-col gap-2">
        <FieldLabel>Salida</FieldLabel>
        {chosen ? (
          <div className="flex items-center justify-between gap-3 rounded-field bg-ink/6 px-4 py-3">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="truncate text-[16px] font-semibold text-ink">
                {idx.refs.get(chosen.id)} · {tourOfChosen?.shortName} · {formatDayShort(chosen.startsAt)} {formatTime(chosen.startsAt)}
              </span>
              <span className="text-[13px] text-ink-soft">
                {formatUsd(chosen.priceUsd)} por persona · quedan {chosen.left} de {chosen.capacity}
              </span>
              <SeatMeter taken={chosen.seatsTaken} capacity={chosen.capacity} className="mt-1 max-w-48" />
            </div>
            <button type="button" className="pressable shrink-0 rounded-full px-3 py-2 text-[14px] font-semibold text-ink underline underline-offset-4 hover:bg-ink/8" onClick={() => setDepartureId(undefined)}>
              Cambiar
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Select value={activeTour} onValueChange={setTourFilter}>
              <SelectTrigger className="h-12 rounded-field! text-[16px]">
                <SelectValue placeholder="Tour" />
              </SelectTrigger>
              <SelectContent className="max-h-72 overflow-y-auto rounded-field!">
                {idx.tours
                  .filter((t) => open.some((d) => d.tourId === t.id))
                  .map((t) => (
                    <SelectItem key={t.id} value={t.id} className="rounded-field py-2 text-[15px]">
                      {t.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {choices.length ? (
              <ul className="flex flex-col gap-1">
                {choices.map((d) => (
                  <li key={d.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setDepartureId(d.id);
                        setFailure(null);
                      }}
                      className="pressable flex w-full items-center justify-between gap-3 rounded-field bg-ink/6 px-4 py-3 text-left hover:bg-ink/12"
                    >
                      <span className="flex min-w-0 flex-col">
                        <span className="text-[15px] font-semibold text-ink">
                          {formatDayShort(d.startsAt)} · {formatTime(d.startsAt)}
                        </span>
                        <span className="text-[13px] text-ink-soft">{idx.refs.get(d.id)}</span>
                      </span>
                      <span className="shrink-0 text-[14px] font-semibold tabular text-ink">quedan {d.left}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[14px] text-ink-soft">Ese tour no tiene salidas con cupo. Creá una en Salidas.</p>
            )}
          </div>
        )}
      </section>

      <Input
        label="Nombre y apellido"
        value={name}
        autoComplete="name"
        autoCapitalize="words"
        enterKeyHint="next"
        onChange={(v) => {
          setName(v);
          revalidate({ name: v });
        }}
        error={errors.name}
        classNames={fieldClasses}
      />
      <Input
        label="WhatsApp"
        value={phone}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="7012 3456"
        enterKeyHint="next"
        onChange={(v) => {
          setPhone(v);
          revalidate({ phone: v });
        }}
        error={errors.phone}
        classNames={fieldClasses}
      />
      <Input
        label="Correo (opcional)"
        value={email}
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        enterKeyHint="next"
        onChange={(v) => {
          setEmail(v);
          revalidate({ email: v });
        }}
        error={errors.email}
        classNames={fieldClasses}
      />

      <section className="flex flex-col gap-2">
        <FieldLabel hint={chosen ? `${formatUsd(size * chosen.priceUsd)} el día de la salida` : undefined}>Personas</FieldLabel>
        <AdaptiveStepper className={STEPPER_CLASS} value={size} min={1} max={maxParty} onValueChange={setParty} aria-label="Personas" formatValueText={(v) => plural(v, "persona", "personas")}>
          <AdaptiveStepperDecrement aria-label="Una persona menos" />
          <AdaptiveStepperValue />
          <AdaptiveStepperIncrement aria-label="Una persona más" />
        </AdaptiveStepper>
        <FieldError>{errors.partySize}</FieldError>
      </section>

      <section className="flex flex-col gap-2">
        <FieldLabel htmlFor="nota-reserva" hint={`${notes.length}/280`}>
          Nota (opcional)
        </FieldLabel>
        <textarea
          id="nota-reserva"
          value={notes}
          maxLength={280}
          rows={2}
          onChange={(e) => setNotes(e.target.value)}
          className={cn(inputClass, "h-auto min-h-[72px] resize-y py-3 leading-snug")}
        />
      </section>

      <AnimatePresence initial={false}>
        {failure ? (
          <motion.p
            key={failure}
            role="alert"
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: [6, -4, 2, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE_OUT }}
            className="rounded-field bg-destructive/10 px-4 py-3 text-[15px] font-semibold text-destructive"
          >
            {failure}
          </motion.p>
        ) : null}
      </AnimatePresence>

      <div className="sticky bottom-0 z-10 -mx-4 bg-paper px-4 pt-2 pb-[calc(env(safe-area-inset-bottom,0px)+8px)] lg:-mx-6 lg:px-6">
        <ActionButton type="submit" state={state} size="lg" className="w-full" loadingText="Reservando" successText="Reservado" errorText="Revisá los datos">
          {chosen ? `Reservar ${plural(size, "cupo", "cupos")}` : "Reservar"}
        </ActionButton>
      </div>
    </form>
  );
}
