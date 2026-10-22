"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * Lenis smooth wheel scroll for the public site, driven by GSAP's ticker so
 * ScrollTrigger and Lenis share one frame loop. Touch keeps native momentum.
 * Elements with `data-lenis-prevent` (maps, inner scrollers) scroll natively.
 * Reduced motion: no Lenis at all; ScrollTrigger keeps working on native scroll.
 */
export function SmoothScroll({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({
      autoRaf: false,
      anchors: true,
      lerp: 0.12,
      stopInertiaOnNavigate: true,
    });
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
    };
  }, []);

  // New page, new heights: let every trigger measure again once it has painted.
  useEffect(() => {
    const frame = requestAnimationFrame(() => ScrollTrigger.refresh());
    let alive = true;
    document.fonts?.ready.then(() => {
      if (alive) ScrollTrigger.refresh();
    });
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
    };
  }, [pathname]);

  return <>{children}</>;
}
