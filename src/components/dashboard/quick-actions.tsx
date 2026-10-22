"use client";

// Floating action for "Hoy", adapted from beui's bloom menu (MIT): the button
// morphs into the panel it opens, anchored to its corner, and folds back into it.

import { CalendarPlus, CloudRain, Lock, LockOpen, Plus, TicketPlus, X, type LucideIcon } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import type { Departure } from "@/lib/domain/types";
import { EASE_OUT } from "@/lib/ease";
import { sim } from "@/lib/sim/store";
import { cn } from "@/lib/utils";
import { useDash } from "./context";

const SPRING_FOLDER = { type: "spring", stiffness: 420, damping: 36, mass: 0.8 } as const;

interface Item {
  id: string;
  label: string;
  detail?: string;
  icon: LucideIcon;
  disabled?: boolean;
  run: () => void;
}

export function QuickActions({ next, nextRef }: { next?: Departure; nextRef?: string }) {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  const layoutId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { open: openOverlay } = useDash();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        window.setTimeout(() => triggerRef.current?.focus(), 0);
      }
    };
    const onPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    const frame = requestAnimationFrame(() => ref.current?.querySelector<HTMLButtonElement>("[role=menuitem]:not(:disabled)")?.focus({ preventScroll: true }));
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const closed = next?.status === "cerrada";
  const items: Item[] = [
    { id: "salida", label: "Nueva salida", icon: CalendarPlus, run: () => openOverlay({ kind: "new-departure" }) },
    { id: "reserva", label: "Reserva manual", icon: TicketPlus, run: () => openOverlay({ kind: "new-booking", departureId: next && !closed ? next.id : undefined }) },
    {
      id: "cerrar",
      label: closed ? "Abrir salida" : "Cerrar salida",
      detail: nextRef,
      icon: closed ? LockOpen : Lock,
      disabled: !next || next.status === "cancelada" || next.status === "realizada",
      run: () => {
        if (!next) return;
        const target = closed ? "abierta" : "cerrada";
        void sim.updateDeparture(next.id, { status: target }).then(() =>
          toast(target === "cerrada" ? `${nextRef}: venta en línea cerrada` : `${nextRef}: venta en línea abierta`, {
            action: { label: "Deshacer", onClick: () => void sim.updateDeparture(next.id, { status: next.status }) },
          }),
        );
      },
    },
    { id: "clima", label: "Aviso de clima", detail: nextRef, icon: CloudRain, run: () => openOverlay({ kind: "weather", departureId: next?.id }) },
  ];

  const morph = reduce ? { duration: 0.15 } : SPRING_FOLDER;

  return (
    <div
      ref={ref}
      className="fixed right-4 bottom-[calc(max(10px,env(safe-area-inset-bottom,0px))+86px)] z-40 flex flex-col items-end lg:right-10 lg:bottom-10"
    >
      <AnimatePresence initial={false} mode="popLayout">
        {open ? (
          <motion.div
            key="panel"
            layoutId={layoutId}
            transition={morph}
            style={{ borderRadius: 20 }}
            className="w-[min(88vw,360px)] overflow-hidden bg-ink p-2 text-paper"
            role="menu"
            aria-label="Acciones rápidas"
          >
            <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: reduce ? 0 : 0.08, duration: 0.18 }}>
              <div className="grid grid-cols-2 gap-1.5">
                {items.map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <motion.button
                      key={item.id}
                      type="button"
                      role="menuitem"
                      disabled={item.disabled}
                      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, filter: "blur(4px)" }}
                      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                      transition={{ delay: reduce ? 0 : 0.06 + i * 0.04, duration: 0.22, ease: EASE_OUT }}
                      onClick={() => {
                        item.run();
                        setOpen(false);
                      }}
                      className="pressable flex min-h-[96px] flex-col items-start justify-between gap-3 rounded-field bg-paper/8 p-4 text-left select-none hover:bg-paper/16 disabled:opacity-40"
                    >
                      <Icon className="size-6" aria-hidden />
                      <span className="flex flex-col">
                        <span className="text-[16px] font-semibold leading-tight">{item.label}</span>
                        {item.detail ? <span className="text-[13px] text-paper/70">{item.detail}</span> : null}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
              <div className="flex justify-end pt-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    window.setTimeout(() => triggerRef.current?.focus(), 0);
                  }}
                  aria-label="Cerrar acciones"
                  className="pressable grid size-12 place-items-center rounded-full hover:bg-paper/12"
                >
                  <X className="size-6" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : (
          <motion.button
            key="trigger"
            ref={triggerRef}
            type="button"
            layoutId={layoutId}
            transition={morph}
            style={{ borderRadius: 28 }}
            onClick={() => setOpen(true)}
            aria-haspopup="menu"
            aria-expanded={false}
            aria-label="Acciones rápidas"
            whileTap={reduce ? undefined : { scale: 0.94 }}
            className={cn("grid size-14 place-items-center bg-ink text-paper select-none", "hover:bg-ink-soft")}
          >
            <motion.span layout>
              <Plus className="size-7" strokeWidth={2.4} />
            </motion.span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
