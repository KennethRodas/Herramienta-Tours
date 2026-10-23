"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import type { Message } from "@/lib/domain/types";
import { useMessages, useSimState } from "@/lib/sim/hooks";
import { DAY, formatDayShort, formatTime, svStartOfDay } from "@/lib/domain/format";
import { simNow } from "@/lib/sim/state";
import { cn } from "@/lib/utils";

const EMAIL_KINDS = new Set(["confirmacion", "recordatorio_24h", "wilber_resumen", "pago", "cambio_salida", "cancelacion"]);

/** Inbox of the branded emails the simulation sent; each one renders through /api/email/render. */
export function EmailInbox({ className }: { className?: string }) {
  const emails = useMessages((m) => m.channel === "email");
  const state = useSimState();
  const list = useMemo(() => [...(emails ?? [])].reverse().slice(0, 60), [emails]);
  const [openId, setOpenId] = useState<string | null>(null);
  const open = list.find((m) => m.id === openId) ?? list[0];
  const [rendered, setRendered] = useState<{ id: string; html?: string; error?: string } | null>(null);
  const html = rendered && open && rendered.id === open.id ? rendered.html ?? null : null;
  const error = rendered && open && rendered.id === open.id ? rendered.error ?? null : null;

  useEffect(() => {
    if (!open || !state || !EMAIL_KINDS.has(open.kind)) return;
    const id = open.id;
    let alive = true;
    const booking = state.bookings.find((b) => b.id === open.bookingId);
    const departure = state.departures.find((d) => d.id === (open.departureId ?? booking?.departureId));
    let digest: { departure: typeof departure; bookings: typeof state.bookings }[] | undefined;
    if (open.kind === "wilber_resumen") {
      const start = svStartOfDay(simNow(state.clock)) + DAY;
      digest = state.departures
        .filter((d) => Date.parse(d.startsAt) >= start && Date.parse(d.startsAt) < start + DAY && d.status !== "cancelada")
        .map((d) => ({ departure: d, bookings: state.bookings.filter((b) => b.departureId === d.id && b.status !== "cancelada") }));
    }
    fetch("/api/email/render", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: open.kind, data: { booking, departure, digest } }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j: { html: string }) => alive && setRendered({ id, html: j.html }))
      .catch((err: Error) => alive && setRendered({ id, error: err.message }));
    return () => {
      alive = false;
    };
    // Re-render only when another email is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open?.id]);

  return (
    <div className={cn("grid min-h-0 gap-2 font-sans md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]", className)}>
      <ul data-lenis-prevent className="min-h-0 space-y-1 overflow-y-auto rounded-ticket bg-cobalt-900 p-1.5">
        {list.length === 0 && <li className="p-4 text-[15px] text-cobalt-300">Sin correos. Las reservas con correo y los resúmenes de las 6 p. m. llegan aquí.</li>}
        {list.map((m: Message) => (
          <li key={m.id}>
            <button
              type="button"
              onClick={() => setOpenId(m.id)}
              className={cn(
                "pressable block w-full rounded-field px-3.5 py-3 text-left",
                open?.id === m.id ? "bg-cobalt-700" : "hover:bg-cobalt-800",
              )}
            >
              <span className="block truncate text-[14px] font-semibold text-sand-50">{m.body}</span>
              <span className="block truncate text-[12px] text-cobalt-300">
                {m.to} · {formatDayShort(m.createdAt)} {formatTime(m.createdAt)}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <div className="relative min-h-[420px] overflow-hidden rounded-ticket bg-sand-100">
        <AnimatePresence mode="wait">
          {html ? (
            <motion.iframe
              key={open?.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              title="Vista del correo"
              srcDoc={html}
              sandbox=""
              className="absolute inset-0 size-full bg-white"
            />
          ) : (
            <motion.p key="empty" className="p-6 text-[15px] text-cobalt-700">
              {error ? `No se pudo mostrar el correo (${error}).` : open ? "Cargando…" : "Elegí un correo."}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
