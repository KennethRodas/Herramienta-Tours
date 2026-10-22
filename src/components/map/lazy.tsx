"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

// Maps cost a WebGL context, a worker and a few hundred KB of script, so the
// module loads only when its box is about to scroll into view. The box keeps
// the caller's size from the first paint: placeholder, loader and map all
// fill it, so nothing shifts.

export function LazyMount({
  className,
  placeholder,
  children,
  lenisPrevent,
}: {
  className?: string;
  placeholder: ReactNode;
  children: ReactNode;
  /** The map owns wheel and touch inside the box (full-page explorer, editor). */
  lenisPrevent?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "400px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={className} data-lenis-prevent={lenisPrevent ? "" : undefined}>
      {visible ? children : placeholder}
    </div>
  );
}

/** Sand box with the shape of what is coming: a map, and a profile strip if any. */
export function MapSkeleton({ profile = false, label = "Cargando mapa" }: { profile?: boolean; label?: string }) {
  return (
    <div className="absolute inset-0 flex flex-col gap-2" role="status" aria-label={label}>
      <div className="relative grid min-h-0 flex-1 place-items-center rounded-ticket bg-sand-300">
        <span aria-hidden className="text-[15px] font-semibold text-cobalt-800">
          {label}
        </span>
      </div>
      {profile ? <div className="paper h-[170px] shrink-0" /> : null}
    </div>
  );
}

/** Covers the canvas until the style has loaded, then fades out (opacity only). */
export function LoadingVeil({ ready }: { ready: boolean }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 grid place-items-center bg-sand-300 transition-opacity duration-300 ease-out-strong",
        ready ? "opacity-0" : "opacity-100",
      )}
    >
      <span className="text-[15px] font-semibold text-cobalt-800">Cargando mapa</span>
    </div>
  );
}

export function EditorSkeleton() {
  return (
    <div className="absolute inset-0 grid grid-rows-[auto_1fr] gap-3" role="status" aria-label="Cargando editor">
      <div className="h-10 w-2/3 rounded-full bg-sand-300" />
      <div className="rounded-ticket bg-sand-300" />
    </div>
  );
}

export const FILL = "absolute inset-0";

export function shellClass(base: string, className?: string) {
  return cn("relative", base, className);
}
