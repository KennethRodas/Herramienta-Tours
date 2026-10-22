"use client";

import { motion, useReducedMotion } from "motion/react";
import { useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { capturePointer, releasePointer, TOUCH_GESTURE_CLASS } from "@/lib/touch";
import { cx as cn } from "./cx";

// One paper boleto per seat of a departure. Sold seats are torn off the strip
// (a faint ghost stays where they were), seats other visitors are holding
// right now are printed in the light ink, the visitor's own seats are lifted
// and punched with a check, the rest are free.
// With `onPick` the strip is also a picker: tap or drag across the boletos to
// choose how many to take. The accessible control for that value lives next
// to it (stepper / wheel); the strip itself is presentation for screen readers,
// which get the counts as text.

export type SeatState = "taken" | "held" | "selected" | "free";

interface Props {
  capacity: number;
  /** Seats already sold. */
  taken: number;
  /** Seats the visitor is taking (lifted, checked). */
  selected?: number;
  /** Seats held by other visitors right now. */
  held?: number;
  size?: "sm" | "md" | "lg";
  /** Makes the free boletos pickable: tap or drag to set how many (1…maxPick). */
  onPick?: (count: number) => void;
  maxPick?: number;
  className?: string;
}

const DIM = {
  // The notch radius goes inline: `.ticket-notch` sets its own --n and a
  // utility class of the same weight is not guaranteed to win.
  sm: { w: 14, h: 22, notch: "3px", gap: "gap-[3px]", check: 0 },
  // 14 boletos (one microbus) fit one line on a 375px phone: 14 × (20 + 2).
  md: { w: 20, h: 32, notch: "4px", gap: "gap-[2px]", check: 12 },
  lg: { w: 30, h: 46, notch: "5px", gap: "gap-1", check: 15 },
} as const;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function seatStates(capacity: number, taken: number, held = 0, selected = 0): SeatState[] {
  const t = clamp(taken, 0, capacity);
  const h = clamp(held, 0, capacity - t);
  const s = clamp(selected, 0, capacity - t - h);
  return Array.from({ length: capacity }, (_, i) => {
    if (i < t) return "taken";
    if (i < t + h) return "held";
    if (i < t + h + s) return "selected";
    return "free";
  });
}

export function BoletoStrip({ capacity, taken, selected = 0, held = 0, size = "md", onPick, maxPick, className }: Props) {
  const reduce = useReducedMotion();
  const rowRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const cells = seatStates(capacity, taken, held, selected);
  const firstPickable = cells.findIndex((c) => c === "selected" || c === "free");
  const counts = cells.reduce(
    (acc, c) => ({ ...acc, [c]: acc[c] + 1 }),
    { taken: 0, held: 0, selected: 0, free: 0 } as Record<SeatState, number>,
  );
  const limit = maxPick ?? counts.selected + counts.free;
  const pickable = Boolean(onPick) && firstPickable >= 0 && limit > 0;
  const d = DIM[size];

  const pickAt = (x: number, y: number) => {
    const row = rowRef.current;
    if (!row || !onPick || firstPickable < 0) return;
    const nodes = Array.from(row.children) as HTMLElement[];
    let best = -1;
    let bestDist = Infinity;
    for (let i = 0; i < nodes.length; i++) {
      const r = nodes[i].getBoundingClientRect();
      // Same printed line first, then the closest boleto on it.
      if (y < r.top - 10 || y > r.bottom + 10) continue;
      const dist = x < r.left ? r.left - x : x > r.right ? x - r.right : 0;
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    }
    if (best < 0) return;
    onPick(clamp(best - firstPickable + 1, 1, limit));
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!pickable || e.button !== 0) return;
    capturePointer(e.currentTarget, e.pointerId);
    setDragging(true);
    pickAt(e.clientX, e.clientY);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (dragging) pickAt(e.clientX, e.clientY);
  };
  const endDrag = (e: PointerEvent<HTMLDivElement>) => {
    releasePointer(e.currentTarget, e.pointerId);
    setDragging(false);
  };

  return (
    <div className={cn("flex flex-col", className)}>
      <div
        ref={rowRef}
        aria-hidden
        data-strip=""
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className={cn(
          "flex flex-wrap",
          d.gap,
          // Room for the lifted (selected) boletos so the row never jumps.
          size === "sm" ? "pt-1" : "pt-2",
          pickable && cn("cursor-pointer touch-none", TOUCH_GESTURE_CLASS),
        )}
      >
        {cells.map((state, i) => (
          <motion.span
            key={i}
            data-seat={state}
            initial={false}
            animate={
              state === "taken"
                ? { opacity: 0.2, y: reduce ? 0 : -2, rotate: reduce ? 0 : i % 2 ? -5 : 4 }
                : state === "selected"
                  ? { opacity: 1, y: reduce ? 0 : size === "sm" ? -3 : -6, rotate: 0 }
                  : { opacity: 1, y: 0, rotate: 0 }
            }
            transition={reduce ? { duration: 0 } : { type: "spring", duration: 0.42, bounce: 0.25 }}
            className={cn(
              "ticket-notch relative grid shrink-0 place-items-center rounded-stub transition-colors duration-150",
              state === "free" && "bg-cobalt-800",
              state === "taken" && "bg-cobalt-600",
              state === "held" && "bg-cobalt-300",
              state === "selected" && "bg-cobalt-950",
              pickable && state === "free" && "hover:bg-cobalt-700",
            )}
            style={{ width: d.w, height: d.h, "--n": d.notch } as CSSProperties}
          >
            {state === "selected" && d.check > 0 ? (
              <svg viewBox="0 0 24 24" width={d.check} height={d.check} fill="none" aria-hidden>
                <path d="M5 12.5l4.5 4.5L19 7.5" stroke="var(--sand-50)" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : null}
          </motion.span>
        ))}
      </div>
      <span className="sr-only">
        {counts.free} de {capacity} cupos libres{counts.selected ? `, ${counts.selected} para tu grupo` : ""}
        {counts.held ? `, ${counts.held} apartados por otras personas` : ""}.
      </span>
    </div>
  );
}

/** Small printed key under a strip; only the states that are on it. */
export function StripKey({ taken, held = 0, selected = 0, free, className }: { taken: number; held?: number; selected?: number; free: number; className?: string }) {
  const items = [
    { n: selected, label: selected === 1 ? "tuyo" : "tuyos", swatch: "bg-cobalt-950" },
    { n: free, label: free === 1 ? "libre" : "libres", swatch: "bg-cobalt-800" },
    { n: held, label: held === 1 ? "apartado ahora" : "apartados ahora", swatch: "bg-cobalt-300" },
    { n: taken, label: taken === 1 ? "vendido" : "vendidos", swatch: "bg-cobalt-600 opacity-25" },
  ].filter((x) => x.n > 0);
  return (
    <ul aria-hidden className={cn("flex flex-wrap gap-x-4 gap-y-1 text-small text-ink-soft", className)}>
      {items.map((x) => (
        <li key={x.label} className="inline-flex items-center gap-1.5">
          <span className={cn("ticket-notch inline-block h-3.5 w-2.5 rounded-stub", x.swatch)} style={{ "--n": "2px" } as CSSProperties} />
          <span className="tabular">{x.n}</span> {x.label}
        </li>
      ))}
    </ul>
  );
}
