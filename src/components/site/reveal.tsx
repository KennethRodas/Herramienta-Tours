"use client";

import { useRef, type HTMLAttributes, type ReactNode, type RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

// Section entrances. Inside a scope, every element marked `data-reveal` arrives
// in reading order, 75ms apart, once, as the section enters. The manner follows
// the content:
//   (default) rises 24px with opacity
//   "plate"   a picture opens from its top edge and settles from a slight scale
//   "slip"    an itinerary slip unrolls from the top, like a printed receipt
//   "card"    a paper object is set down from 48px
//   "row"     list rows arrive one by one as each enters the viewport
// Content is visible in the server HTML; the hidden state is applied only once
// the script runs, and never under prefers-reduced-motion.

const STAGGER = 0.075;

function addPart(tl: gsap.core.Timeline, el: HTMLElement, at: number) {
  const kind = el.dataset.reveal;
  if (kind === "plate") {
    tl.fromTo(
      el,
      { clipPath: "inset(0% 0% 100% 0%)", scale: 1.04 },
      { clipPath: "inset(0% 0% 0% 0%)", scale: 1, duration: 1.15, ease: "power3.inOut", clearProps: "clipPath,transform" },
      at,
    );
  } else if (kind === "slip") {
    tl.fromTo(
      el,
      { clipPath: "inset(0% 0% 100% 0%)" },
      { clipPath: "inset(0% 0% 0% 0%)", duration: 1.25, ease: "power2.inOut", clearProps: "clipPath" },
      at,
    );
  } else if (kind === "card") {
    tl.fromTo(el, { opacity: 0, y: 48 }, { opacity: 1, y: 0, duration: 0.95, ease: "expo.out", clearProps: "transform" }, at);
  } else {
    tl.fromTo(el, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.85, ease: "expo.out", clearProps: "transform" }, at);
  }
}

export function useReveal(scope: RefObject<HTMLElement | null>, start = "top 78%") {
  useGSAP(
    () => {
      const root = scope.current;
      if (!root) return;
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const all = gsap.utils.toArray<HTMLElement>("[data-reveal]", root);
        const parts = all.filter((el) => el.dataset.reveal !== "row");
        const rows = all.filter((el) => el.dataset.reveal === "row");
        if (parts.length) {
          const tl = gsap.timeline({ paused: true });
          parts.forEach((el, i) => addPart(tl, el, i * STAGGER));
          ScrollTrigger.create({ trigger: root, start, once: true, onEnter: () => tl.play() });
        }
        if (rows.length) {
          gsap.set(rows, { opacity: 0, y: 18 });
          ScrollTrigger.batch(rows, {
            start: "top 94%",
            once: true,
            onEnter: (batch) =>
              gsap.to(batch, { opacity: 1, y: 0, duration: 0.7, ease: "expo.out", stagger: 0.06, overwrite: true, clearProps: "transform" }),
          });
        }
      });
      return () => mm.revert();
    },
    { scope },
  );
}

type Tag = "section" | "div" | "article" | "aside" | "footer";

/** A server-friendly wrapper: renders the element and runs the entrances on its `data-reveal` children. */
export function Reveal({
  as = "section",
  start,
  children,
  ...rest
}: { as?: Tag; start?: string; children: ReactNode } & HTMLAttributes<HTMLElement>) {
  const ref = useRef<HTMLDivElement>(null);
  useReveal(ref, start);
  // One element type for the typings; the tag itself is whatever `as` names.
  const Tag = as as "div";
  return (
    <Tag ref={ref} {...rest}>
      {children}
    </Tag>
  );
}
