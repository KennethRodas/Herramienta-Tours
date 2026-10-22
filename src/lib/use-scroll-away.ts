"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const STEP = 6; // px of scroll before anything reacts

/**
 * Floating chrome (the phone tab bar, the simulation clock) gets out of the way
 * while you read down a page and comes back on any scroll up, near the top, at
 * the end of the page and on a new page. `show()` brings it back on demand, for
 * example when keyboard focus enters it.
 */
export function useScrollAway() {
  const pathname = usePathname() ?? "/";
  // The path it was hidden on; a new page shows it again without an effect.
  const [hiddenOn, setHiddenOn] = useState<string | null>(null);

  useEffect(() => {
    let lastY = window.scrollY;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const y = window.scrollY;
        const end = document.documentElement.scrollHeight - window.innerHeight - 24;
        const dy = y - lastY;
        if (y < 80 || y > end) setHiddenOn(null);
        else if (dy > STEP) setHiddenOn(window.location.pathname);
        else if (dy < -STEP) setHiddenOn(null);
        if (Math.abs(dy) > STEP) lastY = y;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  return { hidden: hiddenOn === pathname, show: () => setHiddenOn(null) };
}
