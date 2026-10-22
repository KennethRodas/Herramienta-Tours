"use client";
// Adapted from beui.dev/components/blocks/not-found (stacked), MIT, Saurabh Chauhan:
// the three cards are Wilber's paper boletos and fan out under the pointer.

import { motion, useReducedMotion } from "motion/react";
import type { CSSProperties } from "react";
import { SPRING_PANEL } from "@/lib/ease";
import { useHoverCapable } from "@/lib/hooks/use-hover-capable";

const TICKET = "ticket-notch absolute inset-0";
const notch = { ["--n" as string]: "18px" } as CSSProperties;

export function NotFoundTickets() {
  const reduce = useReducedMotion();
  const canHover = useHoverCapable();
  const interactive = !reduce && canHover;

  return (
    <motion.div
      initial="rest"
      animate="rest"
      whileHover={interactive ? "hover" : undefined}
      className="relative h-[200px] w-[min(86vw,420px)] sm:h-[220px]"
    >
      <motion.div
        aria-hidden
        variants={{ rest: { rotate: -4, x: -10, y: 6 }, hover: { rotate: -11, x: -44, y: 14 } }}
        transition={SPRING_PANEL}
        className={`${TICKET} bg-sand-400`}
        style={notch}
      />
      <motion.div
        aria-hidden
        variants={{ rest: { rotate: 3.5, x: 10, y: 4 }, hover: { rotate: 10, x: 44, y: 12 } }}
        transition={SPRING_PANEL}
        className={`${TICKET} bg-cobalt-600`}
        style={notch}
      />
      <motion.div
        variants={{ rest: { y: 0 }, hover: { y: -8 } }}
        transition={SPRING_PANEL}
        className={`${TICKET} flex items-center justify-center bg-sand-50 text-cobalt-800`}
        style={notch}
      >
        <p className="font-display text-[clamp(5rem,22vw,8.5rem)] font-bold leading-[0.8] tracking-[-0.01em] tabular">404</p>
      </motion.div>
    </motion.div>
  );
}
