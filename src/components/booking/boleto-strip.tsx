"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

// One paper boleto per seat of a departure. Sold seats are torn off the strip,
// the visitor's selection is highlighted, the rest are free.
// Text fallback for screen readers and no-JS: "6 de 14 libres".

interface Props {
  capacity: number;
  taken: number;
  /** Seats the visitor is about to take (highlighted). */
  selected?: number;
  /** Seats held by other visitors right now. */
  held?: number;
  size?: "sm" | "md";
  className?: string;
}

export function BoletoStrip({ capacity, taken, selected = 0, held = 0, size = "md", className }: Props) {
  const reduce = useReducedMotion();
  const free = Math.max(0, capacity - taken - held);
  const cells = Array.from({ length: capacity }, (_, i) => {
    if (i < taken) return "taken" as const;
    if (i < taken + held) return "held" as const;
    if (i < taken + held + selected) return "selected" as const;
    return "free" as const;
  });
  const h = size === "sm" ? 22 : 34;
  const w = size === "sm" ? 14 : 22;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex flex-wrap gap-[3px]" aria-hidden>
        {cells.map((state, i) => (
          <motion.span
            key={i}
            layout={!reduce}
            initial={false}
            animate={
              state === "taken"
                ? { opacity: 0.22, y: reduce ? 0 : -3, rotate: reduce ? 0 : i % 2 ? -4 : 3 }
                : { opacity: 1, y: 0, rotate: 0 }
            }
            transition={{ type: "spring", duration: 0.45, bounce: 0.2 }}
            className={cn(
              "ticket-notch block [--n:3px]",
              state === "free" && "bg-cobalt-800",
              state === "taken" && "bg-cobalt-600",
              state === "held" && "bg-cobalt-300",
              state === "selected" && "bg-stamp",
            )}
            style={{ width: w, height: h }}
          />
        ))}
      </div>
      <span className="sr-only">
        {free} de {capacity} cupos libres
      </span>
    </div>
  );
}
