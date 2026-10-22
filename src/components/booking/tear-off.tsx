"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import gsap from "gsap";
import { seatStates } from "./boleto-strip";
import { cx } from "./cx";

// The moment the visitor gets their boleto: the departure's strip appears,
// their boletos lift and tear off toward the ticket, the ticket drops into
// place, and a few punch chads in the two inks fly out of it.
// Plays once (the page decides when); reduced motion skips straight to the end.

interface Props {
  play: boolean;
  capacity: number;
  /** Sold seats that were not this booking. */
  othersTaken: number;
  mine: number;
  onReveal: () => void;
  onDone: () => void;
  children: ReactNode;
}

export function TearOff({ play, capacity, othersTaken, mine, onReveal, onDone, children }: Props) {
  const stage = useRef<HTMLDivElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const ticket = useRef<HTMLDivElement>(null);
  const reveal = useRef(onReveal);
  const done = useRef(onDone);
  useEffect(() => {
    reveal.current = onReveal;
    done.current = onDone;
  });

  useEffect(() => {
    if (!play || !stage.current || !strip.current || !ticket.current) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      reveal.current();
      done.current();
      return;
    }
    const ctx = gsap.context(() => {
      const torn = strip.current!.querySelectorAll("[data-tear='mine']");
      gsap.set(ticket.current, { opacity: 0, y: -36, rotate: -1.6, transformOrigin: "50% 0%" });
      const tl = gsap.timeline({ defaults: { overwrite: "auto" }, onComplete: () => done.current() });
      // Lift (a quick overshoot, the tug), fall (gravity: accelerating), then the
      // ticket settles with a long ease-out. The stagger stays tight so 25 seats
      // tear in under half a second.
      const stagger = Math.min(0.03, 0.4 / Math.max(1, torn.length));
      tl.from(strip.current, { opacity: 0, y: -12, duration: 0.22, ease: "power2.out" })
        .to(torn, { y: -10, rotate: (i: number) => (i % 2 ? 8 : -7), duration: 0.16, ease: "back.out(2.4)", stagger }, "+=0.06")
        .to(torn, { y: 120, x: (i: number) => (i - (torn.length - 1) / 2) * -6, opacity: 0, scale: 0.6, duration: 0.36, ease: "power2.in", stagger })
        .to(ticket.current, { opacity: 1, y: 0, rotate: 0, duration: 0.5, ease: "expo.out" }, "-=0.28")
        .add(() => {
          reveal.current();
          void chads(ticket.current!);
        }, "-=0.36")
        .to(strip.current, { opacity: 0, y: -8, duration: 0.28, ease: "power1.out" }, "+=0.1");
    }, stage);
    return () => ctx.revert();
  }, [play]);

  const cells = seatStates(capacity, othersTaken, 0, mine);
  // The strip is laid over the top edge of the (still hidden) ticket: no space
  // is reserved for it, so nothing on the page moves when it goes.
  return (
    <div ref={stage} className="relative">
      {play ? (
        <div ref={strip} aria-hidden className="pointer-events-none absolute inset-x-0 top-5 z-10 flex justify-center px-4">
          <div className="flex flex-wrap justify-center gap-1">
            {cells.map((c, i) => (
              <span
                key={i}
                data-tear={c === "selected" ? "mine" : c}
                className={cx(
                  "ticket-notch block h-[46px] w-[30px] rounded-stub",
                  c === "taken" && "bg-cobalt-600 opacity-20",
                  c === "selected" && "bg-cobalt-950",
                  c === "free" && "bg-cobalt-800",
                )}
                style={{ "--n": "5px" } as CSSProperties}
              />
            ))}
          </div>
        </div>
      ) : null}
      <div ref={ticket}>{children}</div>
    </div>
  );
}

/** Round chads from a conductor's punch, cobalt and sand, from the ticket's top edge. */
async function chads(from: HTMLElement) {
  const confetti = (await import("canvas-confetti")).default;
  const css = getComputedStyle(document.documentElement);
  const colors = ["--cobalt-800", "--cobalt-700", "--cobalt-300", "--sand-50"].map((v) => css.getPropertyValue(v).trim()).filter(Boolean);
  const r = from.getBoundingClientRect();
  const y = Math.min(0.9, Math.max(0.05, r.top / window.innerHeight));
  const base = { particleCount: 34, spread: 62, startVelocity: 34, gravity: 1.15, ticks: 170, scalar: 0.75, shapes: ["circle" as const], colors, disableForReducedMotion: true, zIndex: 60 };
  void confetti({ ...base, angle: 64, origin: { x: (r.left + r.width * 0.22) / window.innerWidth, y } });
  void confetti({ ...base, angle: 116, origin: { x: (r.left + r.width * 0.78) / window.innerWidth, y } });
}
