"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, type ReactNode } from "react";
import { ArrowRight, Check } from "lucide-react";
import { BUSINESS, meetingPointById } from "@/content/catalog";
import { formatDayLong, formatPhone, formatTime, formatUsd, plural, waLink } from "@/lib/domain/format";
import { contactWilberText } from "@/lib/whatsapp/templates";
import { AdaptiveStepper, AdaptiveStepperDecrement, AdaptiveStepperIncrement, AdaptiveStepperValue } from "@/components/motion/adaptive-stepper";
import { HoldActionButton } from "@/components/motion/hold-action-button";
import { SlideActionButton } from "@/components/motion/slide-action-button";
import { StatefulButton } from "@/components/motion/button";
import { WheelPicker } from "@/components/motion/wheel-picker";
import { buttonClass } from "@/components/ui/button";
import { useTouchCapable } from "@/lib/hooks/use-touch-capable";
import { BoletoStrip, StripKey } from "./boleto-strip";
import { fieldId, seatsLeftText, type BookingFlow, type Closed, type FieldKey, type Step } from "./booking-flow";
import { cx } from "./cx";
import { NotesField, Note, PayChoice, PhoneField, Shake, TextField } from "./fields";
import { HoldBand } from "./hold-band";
import { Stamp } from "./paper";

// The booking panel: three folder tabs over one paper slip whose content
// morphs between steps. Rendered inline on desktop and inside a bottom sheet
// on phones; the state lives in useBookingFlow so both share one booking.

const STEPS: { id: Step; label: string }[] = [
  { id: "grupo", label: "Grupo" },
  { id: "datos", label: "Datos" },
  { id: "resumen", label: "Resumen" },
];

const EASE = [0.23, 1, 0.32, 1] as const;

export function BookingPanel({ flow, variant }: { flow: BookingFlow; variant: "inline" | "sheet" }) {
  const reduce = useReducedMotion();
  const view = flow.failure ? "falla" : flow.closed && !(flow.closed === "llena" && flow.holdLive) ? `cerrada-${flow.closed}` : flow.step;

  const inline = variant === "inline";
  const morph = inline && !reduce;
  const scroller = useRef<HTMLDivElement>(null);

  // A new step starts at its top, not where the previous one was scrolled to.
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [view]);

  return (
    // Inline, the panel never grows past the viewport: the step scrolls inside
    // and its action strip stays pinned to the bottom of the slip.
    <div className={cx("flex flex-col", inline ? "max-h-[calc(100dvh-12.5rem)] min-h-[26rem]" : "min-h-full")}>
      {flow.closed && view.startsWith("cerrada") ? null : <StepTabs flow={flow} />}
      <motion.div
        layout={morph}
        transition={{ type: "spring", stiffness: 380, damping: 36, mass: 0.6 }}
        className={cx("paper print-corners relative flex min-h-0 flex-col overflow-hidden", !inline && "flex-1")}
      >
        <HoldBand flow={flow} />
        <motion.div
          ref={scroller}
          layout={morph ? "position" : false}
          layoutScroll={inline}
          className={cx(
            "flex min-h-0 flex-1 flex-col px-4 pt-6 sm:px-7",
            inline && "overflow-y-auto overscroll-contain [scrollbar-color:var(--cobalt-300)_transparent] [scrollbar-width:thin]",
          )}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={view}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.24, ease: EASE } }}
              exit={reduce ? { opacity: 0, transition: { duration: 0.12 } } : { opacity: 0, y: -8, filter: "blur(4px)", transition: { duration: 0.16, ease: EASE } }}
              className="flex min-h-full flex-1 flex-col"
            >
              {view === "falla" ? (
                <FailureView flow={flow} />
              ) : view.startsWith("cerrada") ? (
                <ClosedView closed={flow.closed as Closed} flow={flow} />
              ) : flow.step === "grupo" ? (
                <GroupView flow={flow} />
              ) : flow.step === "datos" ? (
                <DatosView flow={flow} />
              ) : (
                <ResumenView flow={flow} />
              )}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </div>
  );
}

function StepTabs({ flow }: { flow: BookingFlow }) {
  const at = STEPS.findIndex((s) => s.id === flow.step);
  return (
    <nav aria-label="Pasos de la reserva" className="flex items-end gap-0.5 pl-2 sm:gap-1 sm:pl-3">
      {STEPS.map((s, i) => {
        const current = s.id === flow.step;
        const enabled = flow.canEnter(s.id);
        const done = i < at || (s.id === "grupo" && flow.hold !== null && !current);
        return (
          <button
            key={s.id}
            type="button"
            aria-current={current ? "step" : undefined}
            disabled={!enabled}
            onClick={() => flow.go(s.id)}
            className={cx(
              "relative -mb-px inline-flex h-11 items-center gap-1 px-3.5 text-small font-semibold transition-[background-color,color,transform] duration-200 [clip-path:polygon(8px_0,calc(100%-8px)_0,100%_100%,0_100%)] sm:gap-1.5 sm:px-5",
              current ? "h-12 bg-sand-50 text-ink" : "bg-sand-300 text-ink hover:bg-sand-100 active:scale-[0.97]",
              !enabled && "cursor-not-allowed text-ink-soft hover:bg-sand-300 active:scale-100",
            )}
          >
            {done && !current ? <Check aria-hidden className="size-3.5" strokeWidth={3} /> : null}
            {s.label}
          </button>
        );
      })}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Grupo

function GroupView({ flow }: { flow: BookingFlow }) {
  const touch = useTouchCapable();
  const { dep, size, maxParty, available, othersHeld } = flow;
  const free = Math.max(0, available - size);
  const atMax = size >= maxParty;
  const options = Array.from({ length: Math.max(1, maxParty) }, (_, i) => String(i + 1));

  return (
    <div className="flex flex-1 flex-col gap-6">
      <h3 className="sr-only">Grupo</h3>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="flex flex-col gap-2">
          <span id="bk-personas-label" className="text-small font-semibold">
            Personas
          </span>
          {touch ? (
            <WheelPicker
              aria-label="Personas"
              options={options}
              value={String(size)}
              onValueChange={(v) => flow.pick(Number(v))}
              visibleCount={3}
              itemHeight={44}
              className="w-28 rounded-none border-0 bg-sand-100 font-display text-(length:--step-lead) font-bold"
            />
          ) : (
            <div id={fieldId("partySize")} tabIndex={-1} className="field-ink w-max outline-none" style={{ backgroundColor: "transparent" }}>
              <AdaptiveStepper
                aria-label="Personas"
                value={size}
                min={1}
                max={Math.max(1, maxParty)}
                onValueChange={flow.pick}
                formatValueText={(v) => plural(v, "persona", "personas")}
                className="font-display"
              >
                <AdaptiveStepperDecrement aria-label="Una persona menos" />
                <AdaptiveStepperValue className="text-(length:--step-lead) font-bold" />
                <AdaptiveStepperIncrement aria-label="Una persona más" />
              </AdaptiveStepper>
            </div>
          )}
        </div>
        <p className="flex flex-col items-end text-right">
          <span className="tabular font-display text-head font-bold leading-none">{formatUsd(flow.total)}</span>
          <span className="tabular mt-1 text-small text-ink-soft">
            {size} × {formatUsd(dep.priceUsd)}
          </span>
        </p>
      </div>

      <div>
        <BoletoStrip capacity={dep.capacity} taken={dep.seatsTaken} held={othersHeld} selected={size} onPick={flow.pick} maxPick={maxParty} size="md" />
        <StripKey taken={dep.seatsTaken} held={othersHeld} selected={size} free={free} className="mt-3" />
      </div>

      <div className="min-h-5">
        <Note tone={flow.holdError || flow.trimmed ? "stamp" : "ink"}>
          {flow.holdError ?? (flow.trimmed ? `${seatsLeftText(maxParty, false)}: ajustamos tu grupo.` : atMax ? `${seatsLeftText(maxParty)}.` : null)}
        </Note>
      </div>

      <ActionStrip>
        <StatefulButton
          pressScale={0.98}
          state={flow.busy === "hold" ? "loading" : "idle"}
          loadingText="Apartando"
          onClick={() => void flow.apartar()}
          disabled={maxParty < 1}
          className="h-14 w-full rounded-none bg-cobalt-800 text-(length:--step-body) font-semibold text-sand-50 hover:bg-cobalt-700"
          icon={<ArrowRight className="size-5" strokeWidth={2.5} />}
        >
          {flow.holdLive && flow.hold?.partySize === size ? "Seguir" : `Apartar ${plural(size, "cupo", "cupos")}`}
        </StatefulButton>
        <p className="text-small text-ink-soft">Quedan apartados 10 minutos.</p>
      </ActionStrip>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Datos

function useTakeFocus(flow: BookingFlow) {
  useEffect(() => {
    const key = flow.takeFocus();
    if (key) window.setTimeout(() => document.getElementById(fieldId(key))?.focus({ preventScroll: false }), 60);
    // Runs once per mounted view: "Editar" sets the target, the view takes it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

function DatosView({ flow }: { flow: BookingFlow }) {
  useTakeFocus(flow);
  const { form } = flow;
  const ok = (key: FieldKey, value: string) => value.trim().length > 0 && !flow.errors[key];

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        flow.toResumen();
      }}
      className="flex flex-1 flex-col gap-5"
    >
      <h3 className="sr-only">Datos</h3>
      {flow.fromAccount ? (
        <p className="-mb-1 flex flex-wrap items-baseline gap-x-2 text-small">
          <span className="font-semibold">Datos de tu cuenta</span>
          <button
            type="button"
            onClick={flow.clearAccount}
            className="pressable -my-1 px-1 py-1 font-semibold underline decoration-2 underline-offset-4 hover:bg-sand-300"
          >
            Cambiar
          </button>
        </p>
      ) : null}
      <TextField
        id={fieldId("name")}
        label="Nombre y apellido"
        value={form.name}
        onChange={(v) => flow.setField("name", v)}
        onBlur={() => flow.touch("name")}
        error={flow.errorFor("name")}
        success={ok("name", form.name)}
        autoComplete="name"
        maxLength={80}
      />
      <PhoneField
        id={fieldId("phone")}
        label="WhatsApp"
        value={form.phone}
        onChange={(v) => flow.setField("phone", v)}
        onBlur={() => flow.touch("phone")}
        error={flow.errorFor("phone")}
        success={ok("phone", form.phone)}
        placeholder="7012 3456"
      />
      <TextField
        id={fieldId("email")}
        label="Correo (opcional)"
        type="email"
        inputMode="email"
        autoComplete="email"
        value={form.email}
        onChange={(v) => flow.setField("email", v)}
        onBlur={() => flow.touch("email")}
        error={flow.errorFor("email")}
        success={ok("email", form.email)}
        maxLength={120}
      />
      <NotesField id={fieldId("notes")} label="Notas para Wilber (opcional)" value={form.notes} onChange={(v) => flow.setField("notes", v)} />
      {flow.online ? (
        <PayChoice value={form.pay} onChange={(v) => flow.setField("pay", v)} total={flow.total} deposit={flow.deposit} error={flow.errorFor("paymentMethod")} />
      ) : null}

      <ActionStrip>
        <button type="submit" className={buttonClass("primary", "lg", "h-14 w-full justify-between")}>
          Revisar
          <ArrowRight aria-hidden className="size-5" strokeWidth={2.5} />
        </button>
        {flow.submitted && flow.missing.length ? (
          <Note tone="stamp">{flow.missing.length === 1 ? "Falta un dato." : `Faltan ${flow.missing.length} datos.`}</Note>
        ) : null}
      </ActionStrip>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Resumen

function SummaryRow({
  label,
  children,
  missing,
  error,
  onEdit,
  marked,
}: {
  label: string;
  children?: ReactNode;
  missing?: boolean;
  error?: string;
  onEdit?: () => void;
  marked?: boolean;
}) {
  const flag = marked && (missing || error);
  return (
    // Phones: the label sits above the value so long names and emails get the
    // whole width; from `sm` the three columns run side by side.
    <div
      className={cx(
        "relative grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 py-2.5 pl-3 transition-colors duration-200 sm:grid-cols-[6.5rem_minmax(0,1fr)_auto]",
        flag && "bg-stamp/8",
      )}
    >
      {flag ? <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-stamp" /> : null}
      <dt className="col-span-2 text-small text-ink-soft sm:col-span-1">{label}</dt>
      <dd className="min-w-0 text-body font-semibold leading-snug [overflow-wrap:anywhere]">
        {missing ? <span className={cx(marked ? "text-stamp" : "text-ink-soft")}>Falta</span> : children}
        {error && !missing && marked ? <span className="mt-0.5 block text-small font-semibold text-stamp">{error}</span> : null}
      </dd>
      {onEdit ? (
        <button
          type="button"
          onClick={onEdit}
          className="pressable -my-1 px-2 py-1 text-small font-semibold underline decoration-2 underline-offset-4 hover:bg-sand-300"
          aria-label={`Editar ${label.toLowerCase()}`}
        >
          Editar
        </button>
      ) : (
        <span />
      )}
    </div>
  );
}

function ResumenView({ flow }: { flow: BookingFlow }) {
  const touch = useTouchCapable();
  const { dep, tour, form, errors } = flow;
  const point = meetingPointById(dep.meetingPointId);
  const arrival = formatTime(Date.parse(dep.startsAt) - tour.arriveMinutesBefore * 60_000);
  const marked = flow.attempts > 0 || flow.submitted;
  const phoneDigits = form.phone.replace(/\D/g, "");
  const fecha = formatDayLong(dep.startsAt);
  const blocked = flow.missing.length > 0;
  const busy = flow.busy === "book" || flow.booked;

  return (
    <div className="flex flex-1 flex-col gap-5">
      <h3 className="sr-only">Resumen</h3>
      <Shake signal={blocked ? flow.attempts : 0}>
        <dl className="-mx-3 flex flex-col">
          <SummaryRow label="Tour">{tour.name}</SummaryRow>
          <SummaryRow label="Fecha">{fecha.charAt(0).toUpperCase() + fecha.slice(1)}</SummaryRow>
          <SummaryRow label="Salida">
            {formatTime(dep.startsAt)} · llegar a las {arrival}
          </SummaryRow>
          {point ? <SummaryRow label="Encuentro">{point.name}</SummaryRow> : null}
          <SummaryRow label="Personas" onEdit={() => flow.edit("partySize")}>
            <span className="tabular">{flow.size}</span>
          </SummaryRow>
          <SummaryRow label="Nombre" missing={!form.name.trim()} error={errors.name} marked={marked} onEdit={() => flow.edit("name")}>
            {form.name.trim()}
          </SummaryRow>
          <SummaryRow label="WhatsApp" missing={!phoneDigits} error={errors.phone} marked={marked} onEdit={() => flow.edit("phone")}>
            <span className="tabular">{phoneDigits.length === 8 ? formatPhone(phoneDigits) : `+503 ${form.phone}`}</span>
          </SummaryRow>
          {form.email.trim() || errors.email ? (
            <SummaryRow label="Correo" error={errors.email} marked={marked} onEdit={() => flow.edit("email")}>
              {form.email.trim()}
            </SummaryRow>
          ) : null}
          {form.notes.trim() ? (
            <SummaryRow label="Notas" onEdit={() => flow.edit("notes")}>
              <span className="font-normal">{form.notes.trim()}</span>
            </SummaryRow>
          ) : null}
          <SummaryRow label="Pago" onEdit={flow.online ? () => flow.edit("paymentMethod") : undefined}>
            {flow.payment === "wompi" ? `Anticipo en línea: ${formatUsd(flow.deposit)}` : "El día de la salida"}
          </SummaryRow>
        </dl>
      </Shake>

      <div className="flex items-end justify-between gap-4 bg-sand-100 px-4 py-3.5">
        <span className="text-body font-semibold">Total</span>
        <span className="flex flex-col items-end">
          <span className="tabular font-display text-head font-bold leading-none">{formatUsd(flow.total)}</span>
          {flow.payment === "wompi" ? (
            <span className="tabular mt-1 text-small text-ink-soft">
              {formatUsd(flow.deposit)} ahora · {formatUsd(flow.total - flow.deposit)} el día de la salida
            </span>
          ) : null}
        </span>
      </div>

      <ActionStrip>
        <div className={cx(busy && "pointer-events-none")}>
          {touch ? (
            <SlideActionButton
              onComplete={() => void flow.confirm()}
              completeLabel={blocked ? "Revisá los datos" : "Reservando"}
              resetDelay={blocked ? 900 : 60_000}
              className="h-16 w-full rounded-none bg-sand-300 ring-0"
              thumbClassName="rounded-none bg-cobalt-800 text-sand-50 size-14"
              fillClassName="bg-cobalt-800"
            >
              Deslizá para confirmar
            </SlideActionButton>
          ) : (
            <HoldActionButton
              type="horizontal"
              holdDuration={1100}
              onHoldComplete={() => void flow.confirm()}
              holdingLabel="Seguí presionando"
              completeLabel={blocked ? "Revisá los datos" : "Reservando"}
              disabled={busy}
              className="h-16 w-full min-w-0 bg-cobalt-800 text-sand-50 [--hold-radius:0px] hover:bg-cobalt-700"
              // Clipping the fill drops beui's liquid edge, which peeks in at rest
              // on a horizontal fill; what is left is a straight ink bar filling up.
              fillClassName="overflow-hidden bg-cobalt-950"
              labelClassName="text-(length:--step-body) font-semibold"
            >
              Mantené para confirmar
            </HoldActionButton>
          )}
        </div>
        <Note tone="stamp">{blocked && flow.attempts > 0 ? "Completá los datos marcados. No se envió la reserva." : null}</Note>
      </ActionStrip>
    </div>
  );
}

// ---------------------------------------------------------------------------
// After a failed booking and when the departure stops taking bookings

function FailureView({ flow }: { flow: BookingFlow }) {
  const f = flow.failure!;
  const dates = `/aventuras/${flow.tour.slug}#salidas`;
  const canReduce = f.reason === "sin_cupos" && f.seatsLeft > 0;
  return (
    <div className="flex flex-1 flex-col gap-5" role="alert">
      <Stamp className="self-start">Sin enviar</Stamp>
      {canReduce ? (
        <>
          <p className="text-lead font-semibold leading-snug">{seatsLeftText(f.seatsLeft)}.</p>
          <p className="text-body">
            No {f.seatsLeft === 1 ? "alcanza" : "alcanzan"} para {plural(flow.size, "persona", "personas")}.
          </p>
        </>
      ) : (
        <p className="text-lead font-semibold leading-snug">{f.message}</p>
      )}
      <ActionStrip>
        {canReduce ? (
          <StatefulButton
            pressScale={0.98}
            state={flow.busy === "hold" ? "loading" : "idle"}
            loadingText="Apartando"
            onClick={() => void flow.reduceTo(f.seatsLeft)}
            className="h-14 w-full rounded-none bg-cobalt-800 text-(length:--step-body) font-semibold text-sand-50 hover:bg-cobalt-700"
          >
            {`Reservar para ${plural(f.seatsLeft, "persona", "personas")}`}
          </StatefulButton>
        ) : f.reason === "datos_invalidos" ? (
          <button type="button" onClick={() => flow.go("datos")} className={buttonClass("primary", "lg", "w-full")}>
            Corregir datos
          </button>
        ) : null}
        <Link href={dates} className={buttonClass(canReduce ? "quiet" : "primary", "lg", "w-full")}>
          Ver otras fechas
        </Link>
      </ActionStrip>
    </div>
  );
}

const CLOSED_TEXT: Record<Closed, string> = {
  llena: "Esta salida se llenó.",
  cerrada: "Wilber cerró esta salida.",
  cancelada: "Wilber canceló esta salida.",
  pasada: "Esta salida ya salió.",
  tarde: "Esta salida ya no recibe reservas en línea.",
};

const CLOSED_STAMP: Record<Closed, string> = {
  llena: "Llena",
  cerrada: "Cerrada",
  cancelada: "Cancelada",
  pasada: "Ya salió",
  tarde: "Cerrada",
};

function ClosedView({ closed, flow }: { closed: Closed; flow: BookingFlow }) {
  return (
    <div className="flex flex-1 flex-col gap-5" role="status">
      <Stamp className="self-start">{CLOSED_STAMP[closed]}</Stamp>
      <p className="text-lead font-semibold leading-snug">{CLOSED_TEXT[closed]}</p>
      <ActionStrip>
        <Link href={`/aventuras/${flow.tour.slug}#salidas`} className={buttonClass("primary", "lg", "w-full")}>
          Ver otras fechas
        </Link>
        {closed === "tarde" ? (
          <a href={waLink(BUSINESS.whatsapp, contactWilberText())} target="_blank" rel="noreferrer" className={buttonClass("quiet", "lg", "w-full")}>
            Escribir a Wilber
          </a>
        ) : null}
      </ActionStrip>
    </div>
  );
}

/** The step's action, pinned to the bottom of the slip under a tear line. */
function ActionStrip({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 mt-auto bg-sand-50 px-4 pb-6 pt-5 sm:-mx-7 sm:px-7 sm:pb-7">
      <span aria-hidden className="perforation-x absolute inset-x-0 top-0 -translate-y-1/2" />
      <div className="flex flex-col gap-2.5">{children}</div>
    </div>
  );
}
