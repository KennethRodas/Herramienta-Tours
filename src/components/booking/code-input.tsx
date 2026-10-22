"use client";

import { animate, AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cx } from "./cx";

// Booking code entry: "WIL-" is printed, the visitor fills four punch boxes.
// Same mechanics as beui's otp-input (one real input over presentational
// slots, rolling characters, caret, shake on error), but letters are allowed:
// codes look like WIL-7K2Q. Pasting "wil-7k2q" or "WIL7K2Q" fills all four.

export type CodeStatus = "idle" | "error" | "success" | "loading";

export function cleanCode(raw: string) {
  const s = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const at = s.lastIndexOf("WIL");
  const body = at >= 0 && s.length - (at + 3) >= 1 ? s.slice(at + 3) : s;
  return body.slice(0, 4);
}

interface Props {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  status?: CodeStatus;
  describedBy?: string;
}

export function CodeInput({ id, value, onChange, onComplete, status = "idle", describedBy }: Props) {
  const reduce = useReducedMotion();
  const [focused, setFocused] = useState(false);
  const slots = useRef<HTMLDivElement>(null);
  const chars = Array.from({ length: 4 }, (_, i) => value[i] ?? "");
  const active = Math.min(value.length, 3);

  useEffect(() => {
    if (status !== "error" || reduce || !slots.current) return;
    animate(slots.current, { x: [0, -7, 7, -4, 4, -2, 0] }, { duration: 0.42 });
  }, [status, reduce]);

  const set = (next: string) => {
    const was = value.length;
    onChange(next);
    if (was < 4 && next.length === 4) onComplete?.(next);
  };

  return (
    <div className="flex items-center gap-2 sm:gap-4">
      <span aria-hidden className="font-display text-head font-bold leading-none">
        WIL-
      </span>
      <div className="relative">
        <input
          id={id}
          value={value}
          onChange={(e) => set(cleanCode(e.target.value))}
          onPaste={(e) => {
            e.preventDefault();
            set(cleanCode(e.clipboardData.getData("text")));
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          maxLength={9}
          aria-label="Código del boleto: los 4 caracteres después de WIL-"
          aria-invalid={status === "error" || undefined}
          aria-describedby={describedBy}
          className="absolute inset-0 z-10 h-full w-full cursor-text opacity-0"
        />
        <div ref={slots} aria-hidden className="flex gap-1.5 sm:gap-2">
          {chars.map((c, i) => {
            const isActive = focused && i === active && status !== "success";
            return (
              <span
                key={i}
                className={cx(
                  "relative grid h-14 w-10 place-items-center overflow-hidden rounded-field border-2 font-display text-head font-bold leading-none transition-[background-color,border-color,color] duration-200 min-[380px]:h-16 min-[380px]:w-12 sm:h-[4.5rem] sm:w-14",
                  status === "error"
                    ? "border-stamp bg-sand-50 text-stamp"
                    : status === "success"
                      ? "border-cobalt-800 bg-cobalt-800 text-sand-50"
                      : c
                        ? "border-cobalt-800 bg-sand-50"
                        : "border-cobalt-800/25 bg-sand-100",
                  isActive && status === "idle" && "border-cobalt-800 bg-sand-50",
                )}
              >
                {isActive && !c ? (
                  <motion.span
                    className="absolute h-8 w-[3px] bg-cobalt-800"
                    animate={reduce ? undefined : { opacity: [1, 1, 0, 0] }}
                    transition={reduce ? undefined : { duration: 1, repeat: Infinity, ease: "linear" }}
                  />
                ) : null}
                <AnimatePresence initial={false}>
                  {c ? (
                    <motion.span
                      key={c + i}
                      initial={reduce ? { opacity: 0 } : { y: 18, opacity: 0, filter: "blur(4px)" }}
                      animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
                      exit={reduce ? { opacity: 0 } : { y: -18, opacity: 0, filter: "blur(4px)" }}
                      transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                      className="absolute inset-0 grid place-items-center"
                    >
                      {c}
                    </motion.span>
                  ) : null}
                </AnimatePresence>
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
