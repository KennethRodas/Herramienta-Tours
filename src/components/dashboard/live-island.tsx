"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DynamicIsland, DynamicIslandView } from "@/components/motion/dynamic-island";
import type { SimEvent, SimEventType } from "@/lib/domain/types";
import { formatDayShort } from "@/lib/domain/format";
import { useEvents } from "@/lib/sim/hooks";
import { EASE_OUT } from "@/lib/ease";
import { cn } from "@/lib/utils";
import { useDash } from "./context";
import { useIndex, type DashIndex } from "./hooks";

// Live events from the simulation (visitors booking, payments, crosses) rise
// out of a Dynamic Island pill while Wilber works. His own taps are excluded:
// those already answer with a toast.

const WATCH: Partial<Record<SimEventType, string>> = {
  "reserva.creada": "Nueva reserva",
  "reserva.rechazada": "Reserva rechazada",
  "reserva.cancelada": "Reserva cancelada",
  "pago.aprobado": "Anticipo pagado",
  "cruce.detectado": "Cruce detectado",
  "salida.llena": "Salida llena",
};

interface Notice {
  id: string;
  title: string;
  line1: string;
  line2?: string;
  bookingId?: string;
  departureId?: string;
  cross?: boolean;
  stamp?: boolean;
}

function toNotice(e: SimEvent, idx: DashIndex | null): Notice {
  const title = WATCH[e.type] ?? "Aviso";
  const bookingId = typeof e.data?.bookingId === "string" ? e.data.bookingId : undefined;
  const departureId = typeof e.data?.departureId === "string" ? e.data.departureId : undefined;
  if (e.type === "reserva.creada" && idx && bookingId) {
    const b = idx.bookingById.get(bookingId);
    const d = b ? idx.departureById.get(b.departureId) : undefined;
    const tour = b ? idx.tourById.get(b.tourId) : undefined;
    if (b && d) {
      const left = Math.max(0, d.capacity - d.seatsTaken);
      return {
        id: e.id,
        title,
        line1: `${b.code} · ${b.name} × ${b.partySize}`,
        line2: `${idx.refs.get(d.id) ?? ""} ${tour?.shortName ?? ""} ${formatDayShort(d.startsAt)} · ${left === 0 ? "llena" : `quedan ${left}`}`,
        bookingId,
        departureId: d.id,
      };
    }
  }
  return {
    id: e.id,
    title,
    line1: e.summary,
    bookingId,
    departureId,
    cross: e.type === "cruce.detectado",
    stamp: e.type === "cruce.detectado" || e.type === "reserva.rechazada",
  };
}

export function LiveIsland({ className }: { className?: string }) {
  const events = useEvents(20);
  const idx = useIndex();
  const reduce = useReducedMotion();
  const router = useRouter();
  const { open } = useDash();
  const [queue, setQueue] = useState<Notice[]>([]);
  const [lastHead, setLastHead] = useState<string | null | undefined>(undefined);
  const [expanded, setExpanded] = useState(false);

  // New events since the last render, newest first in the store.
  const head = events ? (events[0]?.id ?? null) : undefined;
  if (events && head !== lastHead) {
    setLastHead(head);
    if (lastHead !== undefined) {
      const cut = lastHead === null ? -1 : events.findIndex((e) => e.id === lastHead);
      const fresh = (cut === -1 ? events : events.slice(0, cut)).filter((e) => WATCH[e.type] && e.actor !== "wilber").reverse();
      if (fresh.length > 2) {
        const booked = fresh.filter((e) => e.type === "reserva.creada").length;
        const rejected = fresh.filter((e) => e.type === "reserva.rechazada").length;
        setQueue((q) => [
          ...q,
          {
            id: `lote-${head}`,
            title: `${fresh.length} avisos`,
            line1: [booked ? `${booked} reservas nuevas` : "", rejected ? `${rejected} rechazadas por falta de cupo` : ""].filter(Boolean).join(" · ") || fresh[fresh.length - 1].summary,
            stamp: rejected > 0,
          },
        ]);
      } else if (fresh.length) {
        setQueue((q) => [...q, ...fresh.map((e) => toNotice(e, idx))].slice(-4));
      }
    }
  }

  const current = queue[0] ?? null;
  const currentId = current?.id;

  useEffect(() => {
    if (!currentId) return;
    const t1 = window.setTimeout(() => setExpanded(true), 80);
    const t2 = window.setTimeout(() => setExpanded(false), 4200);
    const t3 = window.setTimeout(() => setQueue((q) => q.slice(1)), 4900);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [currentId]);

  const activate = () => {
    if (!current) return;
    if (current.cross) router.push("/wilber/cruces");
    else if (current.bookingId) open({ kind: "booking", id: current.bookingId });
    else if (current.departureId) open({ kind: "departure", id: current.departureId });
    setQueue((q) => q.slice(1));
    setExpanded(false);
  };

  return (
    <AnimatePresence>
      {current ? (
        <motion.div
          key="isla"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: -12, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.92, transition: { duration: 0.2, ease: EASE_OUT } }}
          transition={{ type: "spring", duration: 0.5, bounce: 0.2 }}
          className={cn("pointer-events-auto", className)}
        >
          <button type="button" onClick={activate} className="block text-left" aria-label={`${current.title}: ${current.line1}`}>
            <DynamicIsland
              view={expanded ? "aviso" : null}
              compact={
                <span className="flex items-center gap-2">
                  <span className={cn("size-2 rounded-full", current.stamp ? "bg-destructive" : "bg-background")} />
                  <span className="font-semibold">{current.title}</span>
                </span>
              }
            >
              <DynamicIslandView id="aviso" className="px-5 py-3.5">
                <span className="flex w-[min(78vw,340px)] flex-col gap-1">
                  <span className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.04em] opacity-75">
                    <span className={cn("size-2 rounded-full", current.stamp ? "bg-destructive" : "bg-background")} />
                    {current.title}
                  </span>
                  <span className="text-[16px] font-semibold leading-snug">{current.line1}</span>
                  {current.line2 ? <span className="text-[14px] leading-snug opacity-80">{current.line2}</span> : null}
                </span>
              </DynamicIslandView>
            </DynamicIsland>
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
