"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useClock, useHydrated, useNow } from "@/lib/sim/hooks";
import { useScrollAway } from "@/lib/use-scroll-away";
import { sim } from "@/lib/sim/store";
import { DAY, HOUR, formatDayShort, formatTime } from "@/lib/domain/format";
import { cn } from "@/lib/utils";
import { SPEEDS, speedId } from "./clock-bar";

// The simulated clock, its speed, jumps, and page-aware shortcuts, present while
// the site runs in simulation mode. Public pages carry it in their header
// (placement "header"); it floats only over Wilber's panel and the offline page,
// so it never sits on a headline.

// Hidden from visitors unless NEXT_PUBLIC_SIM_CONTROLS=1; /simulador stays reachable by its URL.
const SIM_CONTROLS = process.env.NEXT_PUBLIC_SIM_CONTROLS === "1";

const OWN_CHROME = /^\/(wilber|simulador|offline)(\/|$)/;

export function SimDock({ placement = "float" }: { placement?: "float" | "header" }) {
  const hydrated = useHydrated();
  const pathname = usePathname();
  const clock = useClock();
  const now = useNow(1000);
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const header = placement === "header";
  // Floating, it gets out of the way while reading down a page.
  const { hidden, show } = useScrollAway();
  const away = !header && hidden && !open;

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

  if (!hydrated || !SIM_CONTROLS || process.env.NEXT_PUBLIC_DATA_MODE === "supabase" || pathname?.startsWith("/simulador")) return null;
  if (!header && !OWN_CHROME.test(pathname ?? "/")) return null;
  const departureId = pathname?.match(/^\/salidas\/([^/]+)/)?.[1];
  const active = speedId(clock);

  return (
    <div
      ref={ref}
      data-theme="noche"
      onFocusCapture={header ? undefined : show}
      style={
        header
          ? undefined
          : {
              transform: away ? "translateY(calc(100% + 120px + env(safe-area-inset-bottom, 0px)))" : "translateY(0)",
              transition: away ? "transform 220ms var(--ease-out)" : "transform 320ms var(--ease-drawer)",
            }
      }
      className={cn(
        "font-sans text-sand-50",
        header && "relative",
        // Above Wilber's phone tab bar until his desktop top bar, which shows the clock itself,
        // and under his quick-actions panel, which covers it when it opens.
        !header && pathname?.startsWith("/wilber") && "fixed bottom-[calc(max(10px,env(safe-area-inset-bottom,0px))+82px)] left-3 z-[39] lg:hidden",
        !header && !pathname?.startsWith("/wilber") && "fixed bottom-4 left-4 z-[39]",
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="pressable flex h-8 items-center gap-1.5 rounded-full bg-cobalt-950 pl-2.5 pr-3 text-[13px] font-semibold outline-2 outline-offset-0 outline-sand-100/60 md:h-9 md:gap-2 md:pr-3.5"
      >
        <span className={cn("size-2 rounded-full", clock?.paused ? "bg-cobalt-300" : "bg-sand-100")} aria-hidden />
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
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: header ? -6 : 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.18, ease: [0.23, 1, 0.32, 1] } }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: header ? -6 : 6, scale: 0.97, transition: { duration: 0.12, ease: [0.23, 1, 0.32, 1] } }}
            style={{ transformOrigin: header ? "top right" : "bottom left" }}
            className={cn(
              "absolute z-50 w-[17rem] space-y-3 rounded-ticket bg-cobalt-900 p-3 shadow-[0_18px_40px_rgb(2_20_71/0.45)]", // taste-skill-ignore: floating menu
              header ? "right-0 top-11" : "bottom-11 left-0",
            )}
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
