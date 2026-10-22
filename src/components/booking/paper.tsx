import type { CSSProperties, ReactNode } from "react";
import { cx as cn } from "./cx";

// Paper pieces for the booking pages. globals.css has the single-orientation
// edges; these add a ticket whose stub sits under the body on phones and to
// its right from `lg`, with the notches following the tear line.
// The CSS ships once (React 19 hoists and dedupes <style href>).

// The notches are stencils: a transparent circle in a mask layer cuts a hole
// in the paper. Nothing here paints a gradient fill.
const hole = (at: string, r = "var(--n)") => `radial-gradient(circle ${r} at ${at},#0000 98%,#000 101%)`; // taste-skill-ignore
const mask = (layers: string) => `-webkit-mask:${layers};mask:${layers}`;
// Two half-masks, one per side of the tear line: "y" splits left/right halves, "x" top/bottom.
const pair = (a: string, b: string, axis: "x" | "y") =>
  axis === "y"
    ? mask(`${hole(a)} 0 0/51% 100% no-repeat,${hole(b)} 100% 0/51% 100% no-repeat`)
    : mask(`${hole(a)} 0 0/100% 51% no-repeat,${hole(b)} 0 100%/100% 51% no-repeat`);

const CSS = `
.bk-body,.bk-stub{--n:14px}
.bk-body{${pair("0 100%", "100% 100%", "y")}}
.bk-stub{${pair("0 0", "100% 0", "y")}}
@media (min-width:1024px){
.bk-split-lg>.bk-body{${pair("100% 0", "100% 100%", "x")}}
.bk-split-lg>.bk-stub{${pair("0 0", "0 100%", "x")}}
}
@media (min-width:640px){
.bk-split-sm>.bk-body{${pair("100% 0", "100% 100%", "x")}}
.bk-split-sm>.bk-stub{${pair("0 0", "0 100%", "x")}}
}
.bk-tag{clip-path:polygon(22px 0,calc(100% - 22px) 0,100% 22px,100% 100%,0 100%,0 22px);${mask(hole("50% 30px", "9px"))}}
@keyframes bk-pulse{0%,100%{opacity:1}50%{opacity:.45}}
.bk-skeleton{animation:bk-pulse 1.6s var(--ease-in-out) infinite}
@keyframes bk-rise{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
.bk-rise{animation:bk-rise 620ms var(--ease-out) both}
@media (prefers-reduced-motion:reduce){.bk-skeleton{animation:none}.bk-rise{animation:none}}
`;

export function PaperStyles() {
  return (
    <style href="wilber-booking-paper" precedence="medium">
      {CSS}
    </style>
  );
}

/**
 * Ticket body + stub. `split` decides from which width the stub moves to the
 * right; below it the stub hangs under the body with the tear line between.
 */
export function SplitTicket({
  body,
  stub,
  split = "lg",
  stubWidth = "17rem",
  className,
  bodyClassName,
  stubClassName,
  as: Tag = "div",
}: {
  body: ReactNode;
  stub: ReactNode;
  split?: "sm" | "lg";
  stubWidth?: string;
  className?: string;
  bodyClassName?: string;
  stubClassName?: string;
  as?: "div" | "article" | "section";
}) {
  const row = split === "lg" ? "lg:flex-row" : "sm:flex-row";
  return (
    <Tag className={cn("relative flex flex-col", row, split === "lg" ? "bk-split-lg" : "bk-split-sm", className)} style={{ "--stub": stubWidth } as CSSProperties}>
      <PaperStyles />
      <div className={cn("bk-body paper min-w-0 flex-1", bodyClassName)}>{body}</div>
      <div
        className={cn(
          "bk-stub paper relative shrink-0",
          split === "lg" ? "lg:w-(--stub)" : "sm:w-(--stub)",
          stubClassName,
        )}
      >
        {/* Tear line along the seam: horizontal while stacked, vertical when side by side. */}
        <span aria-hidden className={cn("perforation-x absolute inset-x-4 -top-[5px]", split === "lg" ? "lg:hidden" : "sm:hidden")} />
        <span aria-hidden className={cn("perforation-y absolute inset-y-4 -left-[5px] hidden", split === "lg" ? "lg:block" : "sm:block")} />
        {stub}
      </div>
    </Tag>
  );
}

/** Label + value printed on a ticket. */
export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <dt className="text-small text-ink-soft">{label}</dt>
      <dd className="min-w-0 text-body font-semibold leading-tight">{children}</dd>
    </div>
  );
}

/** Rubber stamp. Stamp red is only for full, cancelled and errors. */
export function Stamp({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("stamp text-lead leading-none", className)}>{children}</span>;
}
