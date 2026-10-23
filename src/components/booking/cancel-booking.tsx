"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CalendarX } from "lucide-react";
import { toast } from "sonner";
import { BUSINESS } from "@/content/catalog";
import { CANCEL_CUTOFF_HOURS, canCancelOnline } from "@/lib/domain/cancel";
import { formatDayShort, formatTime, waLink } from "@/lib/domain/format";
import type { Booking, Departure } from "@/lib/domain/types";
import { sim } from "@/lib/sim/store";
import { contactWilberText } from "@/lib/whatsapp/templates";
import { buttonClass } from "@/components/ui/button";

// The visitor's own cancel, beside the ticket's other actions. Two steps: the
// button opens a confirmation that says what happens; inside the last
// CANCEL_CUTOFF_HOURS it says Wilber cancels it by WhatsApp instead.

const EASE = [0.23, 1, 0.32, 1] as const;

export function CancelBooking({ booking, departure, now, openAtStart = false }: { booking: Booking; departure: Departure; now: number; openAtStart?: boolean }) {
  const [open, setOpen] = useState(openAtStart);
  const [busy, setBusy] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Arriving from "Cancelar" in Mi cuenta: the confirmation is open; bring it into view.
    if (openAtStart) trigger.current?.scrollIntoView({ block: "center" });
  }, [openAtStart]);

  const check = canCancelOnline(booking, departure, now);
  if (!check.ok && check.reason !== "tarde") return null;

  const one = booking.partySize === 1;
  const seats = one ? "tu cupo" : `tus ${booking.partySize} cupos`;
  const confirm = async () => {
    setBusy(true);
    const res = await sim.cancelByVisitor(booking.id);
    setBusy(false);
    if (!res.ok) {
      toast(res.message);
      return;
    }
    setOpen(false);
    toast(`Reserva ${booking.code} cancelada`, {
      description: `${one ? "Se liberó" : "Se liberaron"} ${seats}. La confirmación va por WhatsApp${booking.email ? " y correo" : ""}.`,
    });
  };

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-controls="cancelar-panel"
        onClick={() => setOpen((v) => !v)}
        className={buttonClass("quiet", "md", "justify-start sm:justify-center")}
      >
        <CalendarX aria-hidden className="size-5 shrink-0" strokeWidth={2.25} />
        Cancelar reserva
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            id="cancelar-panel"
            key="panel"
            role="region"
            aria-label="Cancelar reserva"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.2, ease: EASE } }}
            exit={{ opacity: 0, y: -4, transition: { duration: 0.12, ease: EASE } }}
            className="flex basis-full flex-col gap-4 rounded-ticket bg-sand-300 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7"
          >
            {check.ok ? (
              <>
                <p className="max-w-[60ch] text-body leading-snug">
                  <span className="block font-semibold">¿Cancelar {booking.code}?</span>
                  {one ? "Se libera" : "Se liberan"} {seats} del {formatDayShort(departure.startsAt)}. Hasta el {formatDayShort(check.until)},{" "}
                  {formatTime(check.until)} podés cancelar en línea.
                  {booking.payment.status === "aprobado" ? " La devolución del anticipo se coordina con Wilber por WhatsApp." : ""}
                </p>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button type="button" disabled={busy} onClick={() => void confirm()} className={buttonClass("stamp", "md")}>
                    {busy ? "Cancelando…" : "Sí, cancelar"}
                  </button>
                  <button type="button" onClick={() => setOpen(false)} className={buttonClass("quiet", "md")}>
                    Volver
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="max-w-[60ch] text-body leading-snug">
                  <span className="block font-semibold">Faltan menos de {CANCEL_CUTOFF_HOURS} horas para la salida.</span>
                  Para cancelar, escribile a Wilber con el código {booking.code}.
                </p>
                <a
                  href={waLink(BUSINESS.whatsapp, contactWilberText(booking.code))}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonClass("primary", "md", "shrink-0")}
                >
                  Escribir a Wilber
                </a>
              </>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
