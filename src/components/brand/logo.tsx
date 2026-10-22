import type { SVGProps } from "react";
import { cn } from "@/lib/utils";

// The mark: a paper boleto with side notches, and a W drawn as a trail's
// elevation line — down from Cerro Verde, up the Izalco, down, up again.

export const TICKET_PATH = "M4 12H60V27A5 5 0 0 0 60 37V52H4V37A5 5 0 0 0 4 27Z";
export const TRAIL_PATH = "M14 21.5 22.5 40 32 27.5 41.5 40 50 21.5";

/** Ticket in the current ink, W knocked out in the ground colour. */
export function LogoMark({
  className,
  paper = "var(--ink)",
  ink = "var(--ground)",
  ...props
}: SVGProps<SVGSVGElement> & { paper?: string; ink?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={cn("shrink-0", className)} {...props}>
      <path d={TICKET_PATH} fill={paper} />
      <path d={TRAIL_PATH} fill="none" stroke={ink} strokeWidth={4.6} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Wordmark({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 leading-none text-ink", className)}>
      <LogoMark className="size-10" />
      <span className="flex flex-col">
        <span className="font-display text-[1.75rem] font-bold uppercase leading-[0.85] tracking-[-0.01em]">Wilber</span>
        {!compact && <span className="mt-1 font-sans text-[13px] font-medium leading-none">Tours de aventura</span>}
      </span>
    </span>
  );
}
