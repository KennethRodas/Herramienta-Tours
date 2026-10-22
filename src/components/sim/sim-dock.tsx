"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useClock, useHydrated, useNow } from "@/lib/sim/hooks";
import { sim } from "@/lib/sim/store";
import { DAY, HOUR, formatDayShort, formatTime } from "@/lib/domain/format";
import { cn } from "@/lib/utils";
import { SPEEDS, speedId } from "./clock-bar";

// Floating control present on every page while the site runs in simulation
// mode: the simulated clock, its speed, jumps, and page-aware shortcuts.

export function SimDock() {
  const hydrated = useHydrated();
  const pathname = usePathname();
  const clock = useClock();
  const now = useNow(1000);
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!hydrated || process.env.NEXT_PUBLIC_DATA_MODE === "supabase" || pathname?.startsWith("/simulador")) return null;
  const departureId = pathname?.match(/^\/salidas\/([^/]+)/)?.[1];
  const active = speedId(clock);

  return (
    <div
      ref={ref}
      data-theme="noche"
      className={cn(
        "fixed bottom-[calc(env(safe-area-inset-bottom)+92px)] left-3 z-[60] font-sans text-sand-50 md:bottom-4 md:left-4",
        // Wilber's desktop top bar already shows the simulated clock.
        pathname?.startsWith("/wilber") && "lg:hidden",
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="pressable flex h-8 items-center gap-1.5 rounded-full bg-cobalt-950 pl-2.5 pr-3 text-[13px] font-semibold shadow-[0_0_0_2px_rgb(238_230_214/0.6)] md:h-9 md:gap-2 md:pr-3.5"
      >
        <span className={cn("size-2 rounded-full", clock?.paused ? "bg-cobalt-300" : "bg-sand-100", !clock?.paused && !reduce && "animate-pulse")} aria-hidden />
        <span className="tabular">
          {now ? (
            <>
              <span className="hidden md:inline">{formatDayShort(now)} · </span>
              {formatTime(now)}
            </>
          ) : (
            "Simulación"
          )}
        </span>
        {clock && !clock.paused && clock.speed > 1 && <span className="text-cobalt-300">×{clock.speed}</span>}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
            style={{ transformOrigin: "bottom left" }}
            className="absolute bottom-11 left-0 w-[17rem] space-y-3 rounded-2xl bg-cobalt-900 p-3 shadow-[0_18px_40px_rgb(2_20_71/0.45)]"
          >
            <p className="px-1 text-[13px] text-cobalt-300">Reloj de la simulación</p>
            <div className="grid grid-cols-5 gap-1">
              {SPEEDS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => void sim.setClock({ speed: s.speed, paused: s.paused })}
                  className={cn(
                    "pressable h-9 rounded-lg text-[12px] font-semibold",
                    active === s.id ? "bg-sand-100 text-cobalt-800" : "bg-cobalt-800 hover:bg-cobalt-700",
                  )}
                >
                  {s.id === "0" ? "II" : s.id === "1" ? "×1" : `×${s.id}`}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-1">
              {[
                ["+1 h", HOUR],
                ["+1 día", DAY],
                ["+1 sem", 7 * DAY],
              ].map(([l, ms]) => (
                <button
                  key={l as string}
                  type="button"
                  onClick={() => void sim.setClock({ jumpMs: ms as number })}
                  className="pressable h-9 rounded-lg bg-cobalt-800 text-[13px] font-semibold hover:bg-cobalt-700"
                >
                  {l}
                </button>
              ))}
            </div>
            {departureId && (
              <button
                type="button"
                onClick={async () => {
                  await sim.fillDeparture(departureId, 0);
                  toast("Salida llenada por otros visitantes");
                }}
                className="pressable h-10 w-full rounded-lg bg-sand-100 text-[14px] font-semibold text-cobalt-800 hover:bg-sand-50"
              >
                Llenar esta salida ahora
              </button>
            )}
            <Link href="/simulador" className="pressable block h-10 rounded-lg bg-cobalt-700 text-center text-[14px] font-semibold leading-10 hover:bg-cobalt-600">
              Abrir simulador
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
