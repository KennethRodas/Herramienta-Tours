import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

// A manila folder tab: rounded top corners (14px) and concave flares (12px)
// where the tab meets the folder body. Two fixed-size SVG ends and a middle
// that stretches with the label, all filled with the folder's colour (--c)
// and set in its ink (--t). The ends overlap the middle by a pixel, and the
// tab sinks a pixel into the body, so no seam shows at any position.
//
//   left end   M0 40  flare (r12) → up the side → top corner (r14) → down to the body
//   right end  mirror image

const LEFT = "M0 40A12 12 0 0 0 12 28V14A14 14 0 0 1 26 0V40Z";
const RIGHT = "M0 0A14 14 0 0 1 14 14V28A12 12 0 0 0 26 40H0Z";

type Props = { as?: "span" | "h2"; children: ReactNode; className?: string } & HTMLAttributes<HTMLElement>;

export function FolderTab({ as = "span", children, className, ...rest }: Props) {
  const Tag = as;
  return (
    <Tag className={cn("ft", className)} {...rest}>
      <svg aria-hidden viewBox="0 0 26 40" className="ft-end">
        <path d={LEFT} />
      </svg>
      <span className="ft-mid">{children}</span>
      <svg aria-hidden viewBox="0 0 26 40" className="ft-end">
        <path d={RIGHT} />
      </svg>
    </Tag>
  );
}
