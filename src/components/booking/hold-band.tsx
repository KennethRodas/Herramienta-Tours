"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { formatTime, plural } from "@/lib/domain/format";
import type { BookingFlow } from "./booking-flow";
import { cx } from "./cx";

// The seats the visitor holds while filling the form, with the time left.
// The digits are not a live region (they change twice a second); screen
// readers get the clock time the hold ends instead.

export function HoldBand({ flow, className }: { flow: BookingFlow; className?: string }) {
  const reduce = useReducedMotion();
  const { hold, holdLive, holdExpired, holdMsLeft, holdTotalMs, busy } = flow;
  const show = (hold && holdLive) || holdExpired;
  const secs = Math.ceil(holdMsLeft / 1000);
  const mm = Math.floor(secs / 60);
  const ss = String(secs % 60).padStart(2, "0"); // taste-skill-ignore: a clock's seconds
  const low = holdLive && holdMsLeft < 60_000;

  return (
    <AnimatePresence initial={false}>
      {show ? (
        <motion.div
          key="hold"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
          transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
          className={cx("relative overflow-hidden", holdLive ? (low ? "bg-stamp text-sand-50" : "field-ink") : "bg-sand-300 text-ink", className)}
        >
          {holdLive && hold ? (
            <div className="flex items-center justify-between gap-4 px-5 py-3">
              <p className="text-small font-semibold leading-tight">
                {plural(hold.partySize, "cupo apartado", "cupos apartados")}
                <span className="sr-only"> hasta las {formatTime(hold.expiresAt)}</span>
              </p>
              <p aria-hidden className="tabular font-display text-lead font-bold leading-none">
                {mm}:{ss}
              </p>
              <span
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-1 origin-left bg-current opacity-60 transition-transform duration-500 ease-linear"
                style={{ transform: `scaleX(${Math.max(0, Math.min(1, holdMsLeft / holdTotalMs))})` }}
              />
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5" role="status">
              <p className="text-small font-semibold">Se venció el apartado.</p>
              <button
                type="button"
                onClick={() => void flow.rehold()}
                disabled={busy !== null}
                className="pressable h-9 bg-cobalt-800 px-4 text-small font-semibold text-sand-50 hover:bg-cobalt-700 disabled:opacity-50"
              >
                {busy === "hold" ? "Apartando…" : "Apartar de nuevo"}
              </button>
            </div>
          )}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
