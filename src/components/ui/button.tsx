import Link from "next/link";
import { forwardRef, type ButtonHTMLAttributes, type ComponentProps } from "react";
import { cn } from "@/lib/utils";

// One button shape for the whole public site: flat, square-cornered, one fill.
// primary = cobalt block with sand type · quiet = sand step · inverse = sand on cobalt fields.

type Variant = "primary" | "quiet" | "inverse" | "stamp";
type Size = "md" | "lg";

const base =
  "pressable inline-flex items-center justify-center gap-2 font-sans font-semibold leading-none select-none whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-3";

const variants: Record<Variant, string> = {
  primary: "bg-cobalt-800 text-sand-50 hover:bg-cobalt-700",
  quiet: "bg-sand-300 text-cobalt-800 hover:bg-sand-400",
  inverse: "bg-sand-100 text-cobalt-800 hover:bg-sand-50",
  stamp: "bg-stamp text-sand-50 hover:brightness-110",
};

const sizes: Record<Size, string> = {
  md: "h-12 px-5 text-[17px]",
  lg: "h-14 px-7 text-[19px]",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }>(
  function Button({ variant = "primary", size = "md", className, type = "button", ...props }, ref) {
    return <button ref={ref} type={type} className={buttonClass(variant, size, className)} {...props} />;
  },
);

export function ButtonLink({ variant = "primary", size = "md", className, ...props }: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}
