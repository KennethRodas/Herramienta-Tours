"use client";

import { ChevronRight, ExternalLink, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  AdaptiveStepper,
  AdaptiveStepperDecrement,
  AdaptiveStepperIncrement,
  AdaptiveStepperValue,
} from "@/components/motion/adaptive-stepper";
import { HoldActionButton } from "@/components/motion/hold-action-button";
import { meetingPointById } from "@/content/catalog";
import { normalizeCode } from "@/lib/domain/availability";
import { formatCountdown, formatDayShort, formatPhone, formatTime, formatUsd, plural, waLink } from "@/lib/domain/format";
import { useNow } from "@/lib/sim/hooks";
import { sim } from "@/lib/sim/store";
import { cn } from "@/lib/utils";
import { useDash } from "./context";
import { useIndex } from "./hooks";
import { SOURCE_LABEL, bookingTotal, paymentLine } from "./lib";
import { useCheckIn } from "./manifest";
import { SheetHeader } from "./overlay-host";
import { ActionButton, Btn, CopyButton, Empty, Perforation, STEPPER_CLASS, StatusTag, btn, useAsyncAction } from "./ui";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[112px_minmax(0,1fr)] items-baseline gap-3 py-2.5">
      <dt className="text-[14px] font-medium text-ink-soft">{label}</dt>
      <dd className="min-w-0 text-[16px] text-ink">{children}</dd>
    </div>
  );
}

export function BookingView({ id }: { id: string }) {
  const idx = useIndex();
  const now = useNow(10_000);
  const { push } = useDash();
  const checkIn = useCheckIn();
  const [count, setCount] = useState<number | null>(null);
  const [saveState, runSave] = useAsyncAction();
  const [payState, runPay] = useAsyncAction();

  if (!idx || now === null) {
    return (
      <>
        <SheetHeader title="Reserva" />
        <div className="h-40 animate-pulse bg-ink/5" />
      </>
    );
  }
  const b = idx.bookingById.get(id) ?? idx.s.bookings.find((x) => x.code === normalizeCode(id));
  if (!b) {
    return (
      <>
        <SheetHeader title="Reserva" />
        <Empty>Esa reserva no existe. Buscala por código en Reservas.</Empty>
      </>
    );
  }
  const dep = idx.departureById.get(b.departureId);
  const tour = idx.tourById.get(b.tourId);
  const ref = dep ? idx.refs.get(dep.id) : undefined;
  const mp = dep ? meetingPointById(dep.meetingPointId) : undefined;
  const status = checkIn.pending[b.id] ?? b.status;
  const price = dep?.priceUsd ?? tour?.priceUsd ?? 0;
  const start = dep ? Date.parse(dep.startsAt) : 0;
  const canCheckIn = Boolean(dep) && b.status !== "cancelada" && dep?.status !== "cancelada" && start - now < 36 * 3_600_000;
  const arrivedCount = count ?? (b.status === "check_in" ? b.checkedIn : b.partySize);
  const waText = dep && tour ? `Reserva ${b.code} · ${tour.shortName} ${formatDayShort(dep.startsAt)} ${formatTime(dep.startsAt)}` : `Reserva ${b.code}`;

  const cancel = async () => {
    await sim.cancelBooking(b.id);
    toast.success(`${b.code} cancelada · ${plural(b.partySize, "cupo liberado", "cupos liberados")}`);
  };

  return (
    <div className="flex flex-col gap-5">
      <SheetHeader title={`Reserva ${b.code}`} />

      <header className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <p className="select-all font-display text-[44px] font-bold uppercase leading-[0.85] tracking-[-0.01em] text-ink">{b.code}</p>
          <StatusTag status={status} className="mt-1" />
        </div>
        <h3 className="text-[22px] font-semibold leading-tight text-ink">{b.name}</h3>
        <div className="flex flex-wrap gap-2">
          <CopyButton value={b.code} label="Copiar código" />
          <Link href={`/reserva/${b.code}`} target="_blank" className={btn("quiet", "sm")}>
            Ver boleto <ExternalLink className="size-3.5" />
          </Link>
          <a href={waLink(b.phone, waText)} target="_blank" rel="noreferrer" className={btn("primary", "sm")}>
            <MessageCircle className="size-4" /> WhatsApp
          </a>
        </div>
      </header>

      <Perforation />

      <dl className="flex flex-col">
        <Row label="Salida">
          {dep ? (
            <button
              type="button"
              onClick={() => push({ kind: "departure", id: dep.id })}
              className="pressable -mx-2 inline-flex max-w-full items-center gap-1 px-2 py-1 text-left font-semibold hover:bg-ink/8"
            >
              <span className="truncate">
                {ref} · {tour?.shortName} · {formatDayShort(dep.startsAt)} {formatTime(dep.startsAt)}
              </span>
              <ChevronRight className="size-4 shrink-0 text-ink-soft" />
            </button>
          ) : (
            "Salida eliminada"
          )}
        </Row>
        {dep && start > now ? <Row label="Sale">{formatCountdown(dep.startsAt, now)}</Row> : null}
        {mp ? <Row label="Encuentro">{mp.name}</Row> : null}
        <Row label="Personas">
          <span className="tabular">{b.partySize}</span> · total {formatUsd(bookingTotal(b, price))}
        </Row>
        <Row label="Pago">
          {paymentLine(b, price)}
          {b.payment.reference ? <span className="block text-[13px] text-ink-soft">Ref. {b.payment.reference}</span> : null}
        </Row>
        <Row label="WhatsApp">
          <a href={waLink(b.phone)} target="_blank" rel="noreferrer" className="tabular underline decoration-ink/30 underline-offset-4 hover:decoration-ink">
            {formatPhone(b.phone)}
          </a>
        </Row>
        {b.email ? (
          <Row label="Correo">
            <a href={`mailto:${b.email}`} className="break-all underline decoration-ink/30 underline-offset-4 hover:decoration-ink">
              {b.email}
            </a>
          </Row>
        ) : null}
        <Row label="Canal">
          {SOURCE_LABEL[b.source]} · {formatDayShort(b.createdAt)} {formatTime(b.createdAt)}
        </Row>
        <Row label="Confirmación">
          <span className={cn(b.confirmation === "fallida" && "font-semibold text-destructive")}>
            {b.confirmation === "enviada" ? "Enviada" : b.confirmation === "fallida" ? "No salió: escribile vos" : "Pendiente"}
          </span>
        </Row>
        {b.notes ? <Row label="Nota">{b.notes}</Row> : null}
      </dl>

      {canCheckIn ? (
        <section className="flex flex-col gap-3 bg-ink/5 px-4 py-4">
          <h4 className="font-display text-[20px] font-bold uppercase leading-none text-ink">Llegada</h4>
          <div className="flex flex-wrap gap-2">
            <Btn
              variant={status === "check_in" ? "quiet" : "primary"}
              onClick={() => {
                setCount(null);
                void checkIn.act(b, status === "check_in" ? "deshacer" : "llego");
              }}
            >
              {status === "check_in" ? "Quitar llegada" : b.partySize > 1 ? `Llegaron los ${b.partySize}` : "Llegó"}
            </Btn>
            <Btn
              variant="quiet"
              className={cn(status === "no_show" ? "" : "hover:bg-destructive/15 hover:text-destructive")}
              onClick={() => void checkIn.act(b, status === "no_show" ? "deshacer" : "novino")}
            >
              {status === "no_show" ? "Quitar «no vino»" : "No vino"}
            </Btn>
          </div>
          {b.partySize > 1 ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[14px] font-medium text-ink-soft">Llegaron</span>
              <AdaptiveStepper value={arrivedCount} min={0} max={b.partySize} onValueChange={setCount} aria-label="Personas que llegaron" className={STEPPER_CLASS}>
                <AdaptiveStepperDecrement aria-label="Una menos" />
                <AdaptiveStepperValue />
                <AdaptiveStepperIncrement aria-label="Una más" />
              </AdaptiveStepper>
              <ActionButton
                state={saveState}
                size="sm"
                variant="quiet"
                disabled={count === null}
                onClick={() =>
                  void runSave(async () => {
                    await sim.checkIn(b.id, arrivedCount);
                    toast(`${b.name}: llegaron ${arrivedCount} de ${b.partySize}`);
                    setCount(null);
                  })
                }
              >
                Guardar
              </ActionButton>
            </div>
          ) : null}
        </section>
      ) : null}

      {b.payment.method === "wompi" && b.payment.status === "pendiente" ? (
        <section className="flex flex-col gap-2 bg-ink/5 px-4 py-4">
          <h4 className="font-display text-[20px] font-bold uppercase leading-none text-ink">Anticipo en línea</h4>
          <p className="text-[14px] text-ink-soft">Simulación de Wompi: {formatUsd(b.payment.amountUsd)} pendiente.</p>
          <div className="flex flex-wrap gap-2">
            <ActionButton
              state={payState}
              size="sm"
              loadingText="Aprobando"
              successText="Aprobado"
              onClick={() => void runPay(() => sim.settlePayment(b.id, "aprobar"))}
            >
              Aprobar pago
            </ActionButton>
            <Btn variant="quiet" size="sm" onClick={() => void sim.settlePayment(b.id, "rechazar").then(() => toast(`${b.code}: pago rechazado, queda con pago el día`))}>
              Rechazar
            </Btn>
          </div>
        </section>
      ) : null}

      {b.status !== "cancelada" ? (
        <HoldActionButton
          type="horizontal"
          holdDuration={1100}
          onHoldComplete={() => void cancel()}
          holdingLabel="Seguí presionando"
          completeLabel="Cancelada"
          className="h-14 w-full min-w-0 rounded-none bg-destructive/12 text-destructive [--hold-radius:0px] [&_svg]:text-destructive/25!"
          fillClassName="bg-destructive/25"
          labelClassName="text-[16px] font-semibold"
        >
          Mantené presionado para cancelar la reserva
        </HoldActionButton>
      ) : (
        <Empty>Reserva cancelada: sus cupos volvieron a la venta.</Empty>
      )}
    </div>
  );
}
