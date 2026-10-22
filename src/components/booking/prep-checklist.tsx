"use client";

import { motion, useReducedMotion } from "motion/react";
import { Checkbox } from "@/components/motion/checkbox";
import { cx } from "./cx";
import { useStored } from "./use-stored";

// "Qué llevar" on the visitor's ticket: ticks are kept on this device, per code.

export function PrepChecklist({ code, items }: { code: string; items: string[] }) {
  const reduce = useReducedMotion();
  const [raw, write] = useStored(`wilber.llevar.${code}`);
  const ticked = new Set<number>(parse(raw));
  const done = items.filter((_, i) => ticked.has(i)).length;

  const toggle = (i: number, on: boolean) => {
    const next = new Set(ticked);
    if (on) next.add(i);
    else next.delete(i);
    write(JSON.stringify([...next].sort((a, b) => a - b)));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="font-display text-lead font-bold uppercase">Qué llevar</h3>
        <p className="tabular text-small font-semibold" aria-live="polite">
          {done} de {items.length} listos
        </p>
      </div>
      <div aria-hidden className="h-1.5 bg-sand-300">
        <motion.div
          className="h-full origin-left bg-cobalt-800"
          initial={false}
          animate={{ scaleX: items.length ? done / items.length : 0 }}
          transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 30 }}
        />
      </div>
      <ul className="flex flex-col">
        {items.map((item, i) => {
          const on = ticked.has(i);
          return (
            <li key={item} className={cx("print-corners -mx-2 px-2 py-2 transition-colors duration-200", on ? "bg-transparent" : "hover:bg-sand-100")}>
              <Checkbox
                checked={on}
                onCheckedChange={(v) => toggle(i, v)}
                label={item}
                className={cx(
                  "w-full [&>span]:text-(length:--step-body) [&>span_span]:text-(length:--step-body) [&>span_span]:leading-snug",
                  on && "[&>span_span]:text-ink-soft [&>span_span]:line-through [&>span_span]:decoration-2",
                )}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function parse(raw: string | null): number[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((n): n is number => Number.isInteger(n)) : [];
  } catch {
    return [];
  }
}
