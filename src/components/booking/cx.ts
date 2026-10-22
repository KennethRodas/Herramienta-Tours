import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// `cn` from @/lib/utils runs the default tailwind-merge, which reads the
// type steps (text-small, text-body, text-lead, text-head, text-display) as
// colours: `cn("text-small text-ink-soft")` drops the size. This merge knows
// the steps. Inside beui `classNames`, which go through `cn`, use the
// length form instead: `text-(length:--step-small)`.

const merge = extendTailwindMerge({
  extend: { theme: { text: ["small", "body", "lead", "head", "display"] } },
});

export function cx(...inputs: ClassValue[]) {
  return merge(clsx(inputs));
}
