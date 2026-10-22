"use client";

import { useLayoutEffect, useRef, type ElementType, type ReactNode } from "react";
import { cx as cn } from "./cx";

// Entrance for the parts of a section: heading, text, picture, staggered.
// Content is visible on the server and without script; only blocks that start
// below the fold are lowered and faded, then rise once as they enter.

interface Props {
  as?: ElementType;
  className?: string;
  children: ReactNode;
  id?: string;
  "aria-labelledby"?: string;
}

export function Reveal({ as: Tag = "div", className, children, ...rest }: Props) {
  const ref = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return;
    const parts = Array.from(el.children) as HTMLElement[];
    parts.forEach((p, i) => {
      p.style.opacity = "0";
      p.style.transform = "translateY(24px)";
      p.style.transition = `opacity 520ms var(--ease-out) ${i * 70}ms, transform 620ms var(--ease-out) ${i * 70}ms`;
    });
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        for (const p of parts) {
          p.style.opacity = "";
          p.style.transform = "";
        }
        window.setTimeout(() => parts.forEach((p) => (p.style.transition = "")), 1400);
      },
      { rootMargin: "0px 0px -12% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag ref={ref} className={cn(className)} {...rest}>
      {children}
    </Tag>
  );
}
