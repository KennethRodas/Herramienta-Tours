"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, Copy } from "lucide-react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { StatefulButton, type ButtonState } from "@/components/motion/button/stateful";
import type { BookingStatus } from "@/lib/domain/types";
import type { DepartureState } from "@/lib/domain/availability";
import { DEPARTURE_STATE_LABEL } from "@/lib/domain/availability";
import { EASE_OUT } from "@/lib/ease";
import { cn } from "@/lib/utils";
import { BOOKING_STATUS_LABEL } from "./lib";

// Building blocks of the panel. Every colour is a theme token, so the same
// markup prints cobalt on sand by day and sand on cobalt at night.

// --- Buttons -----------------------------------------------------------------------

export type BtnVariant = "primary" | "quiet" | "ghost" | "stamp" | "outline";
export type BtnSize = "sm" | "md" | "lg";

const BTN_BASE =
  "pressable inline-flex items-center justify-center gap-2 font-sans font-semibold leading-none select-none whitespace-nowrap [-webkit-touch-callout:none] disabled:cursor-not-allowed disabled:opacity-45";

const BTN_VARIANT: Record<BtnVariant, string> = {
  primary: "bg-ink text-paper hover:bg-ink-soft",
  quiet: "bg-ink/10 text-ink hover:bg-ink/16",
  ghost: "text-ink hover:bg-ink/10",
  stamp: "bg-destructive text-paper hover:brightness-110",
  outline: "text-ink ring-2 ring-inset ring-ink/25 hover:ring-ink/50",
};

const BTN_SIZE: Record<BtnSize, string> = {
  sm: "h-9 px-3 text-[14px]",
  md: "h-11 px-4 text-[15px]",
  lg: "h-14 px-6 text-[17px]",
};

export function btn(variant: BtnVariant = "primary", size: BtnSize = "md", className?: string) {
  return cn(BTN_BASE, BTN_VARIANT[variant], BTN_SIZE[size], className);
}

export const Btn = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: BtnSize }
>(function Btn({ variant = "primary", size = "md", className, type = "button", ...props }, ref) {
  return <button ref={ref} type={type} className={btn(variant, size, className)} {...props} />;
});

export function IconBtn({
  label,
  className,
  children,
  size = "md",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; size?: "sm" | "md" }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "pressable grid shrink-0 place-items-center text-ink select-none hover:bg-ink/10 disabled:opacity-40",
        size === "md" ? "size-11" : "size-9",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/** idle → loading → success/error, with the label rolling between states. */
export function useAsyncAction() {
  const [state, setState] = useState<ButtonState>("idle");
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const run = useCallback(async (fn: () => Promise<unknown> | unknown) => {
    window.clearTimeout(timer.current);
    setState("loading");
    try {
      // A short floor keeps the spinner from flashing for a 3 ms local write.
      await Promise.all([fn(), new Promise((r) => setTimeout(r, 260))]);
      setState("success");
      timer.current = window.setTimeout(() => setState("idle"), 1300);
      return true;
    } catch {
      setState("error");
      timer.current = window.setTimeout(() => setState("idle"), 1600);
      return false;
    }
  }, []);
  return [state, run, setState] as const;
}

export function ActionButton({
  state,
  onClick,
  children,
  loadingText = "Guardando",
  successText = "Listo",
  errorText = "No se pudo",
  variant = "primary",
  size = "md",
  className,
  disabled,
  icon,
  type = "button",
}: {
  state: ButtonState;
  onClick?: () => void;
  children: ReactNode;
  loadingText?: ReactNode;
  successText?: ReactNode;
  errorText?: ReactNode;
  variant?: BtnVariant;
  size?: BtnSize;
  className?: string;
  disabled?: boolean;
  icon?: ReactNode;
  type?: "button" | "submit";
}) {
  return (
    <StatefulButton
      type={type}
      state={state}
      onClick={onClick}
      disabled={disabled}
      icon={icon}
      pressScale={0.97}
      loadingText={loadingText}
      successText={successText}
      errorText={errorText}
      className={cn(
        "rounded-none font-semibold [-webkit-touch-callout:none]",
        BTN_VARIANT[variant],
        BTN_SIZE[size],
        state === "error" && "bg-destructive text-paper",
        className,
      )}
    >
      {children}
    </StatefulButton>
  );
}

// --- Text ------------------------------------------------------------------------------

export function SectionTitle({
  children,
  aside,
  className,
  id,
}: {
  children: ReactNode;
  aside?: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div className={cn("mb-3 flex flex-wrap items-end justify-between gap-x-3 gap-y-1.5", className)}>
      <h2 id={id} className="font-display text-[22px] font-bold uppercase leading-none tracking-[-0.005em] text-ink">
        {children}
      </h2>
      {aside ? <div className="flex shrink-0 items-center gap-2 text-[14px] text-ink-soft">{aside}</div> : null}
    </div>
  );
}

export function Empty({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3 bg-ink/5 px-4 py-4 text-[15px] text-ink-soft", className)}>
      <p>{children}</p>
      {action}
    </div>
  );
}

// --- Surfaces ------------------------------------------------------------------------

export const Paper = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<"div">>(function Paper({ className, ...props }, ref) {
  return <div ref={ref} className={cn("bg-paper text-paper-ink", className)} {...props} />;
});

/** Tear line of round dots in the ground colour, between two parts of a paper object. */
export function Perforation({ className }: { className?: string }) {
  return <div aria-hidden className={cn("perforation-x w-full", className)} />;
}

// --- Tags ------------------------------------------------------------------------------

const BOOKING_TONE: Record<BookingStatus, string> = {
  confirmada: "bg-ink/10 text-ink",
  pendiente_pago: "bg-ink/5 text-ink-soft",
  pagada: "bg-ink/10 text-ink",
  check_in: "bg-ink text-paper",
  no_show: "bg-destructive/12 text-destructive",
  cancelada: "bg-destructive/12 text-destructive line-through decoration-2",
};

export function StatusTag({ status, className }: { status: BookingStatus; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <span
      className={cn(
        "relative inline-flex h-7 items-center overflow-hidden px-2 text-[13px] font-semibold leading-none transition-colors duration-200",
        BOOKING_TONE[status],
        className,
      )}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={status}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10, filter: "blur(3px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -10, filter: "blur(3px)", transition: { duration: 0.12, ease: EASE_OUT } }}
          transition={{ duration: 0.2, ease: EASE_OUT }}
          className="whitespace-nowrap"
        >
          {BOOKING_STATUS_LABEL[status]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

const DEPARTURE_TONE: Record<DepartureState, string> = {
  disponible: "bg-ink/10 text-ink",
  ultimos: "bg-ink text-paper",
  llena: "",
  cerrada: "bg-ink/5 text-ink-soft",
  cancelada: "",
  pasada: "bg-ink/5 text-ink-soft",
};

export function DepartureTag({ state, className }: { state: DepartureState; className?: string }) {
  if (state === "llena" || state === "cancelada") return <Stamp className={className}>{DEPARTURE_STATE_LABEL[state]}</Stamp>;
  return (
    <span className={cn("inline-flex h-7 items-center px-2 text-[13px] font-semibold leading-none", DEPARTURE_TONE[state], className)}>
      {DEPARTURE_STATE_LABEL[state]}
    </span>
  );
}

/** Rubber stamp in stamp red: "Llena", "Cancelada", cross warnings. */
export function Stamp({ children, className, tilt = true }: { children: ReactNode; className?: string; tilt?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center border-[3px] border-current px-1.5 py-0.5 font-display text-[15px] font-bold uppercase leading-none tracking-[0.02em] text-destructive",
        tilt && "-rotate-3",
        className,
      )}
    >
      {children}
    </span>
  );
}

// --- Seats -----------------------------------------------------------------------------

/** Thin seat meter: sold seats in ink over a faint track. */
export function SeatMeter({ taken, capacity, className, tone = "ink" }: { taken: number; capacity: number; className?: string; tone?: "ink" | "stamp" }) {
  const ratio = capacity ? Math.min(1, taken / capacity) : 0;
  return (
    <span aria-hidden className={cn("relative block h-1 w-full overflow-hidden bg-ink/12", className)}>
      <span
        className={cn("absolute inset-y-0 left-0 block origin-left transition-transform duration-300", tone === "stamp" ? "bg-destructive" : "bg-ink")}
        style={{ width: "100%", transform: `scaleX(${ratio})`, transitionTimingFunction: "var(--ease-out)" }}
      />
    </span>
  );
}

// --- Stat tile ---------------------------------------------------------------------------

export function Stat({
  label,
  value,
  detail,
  tone = "ink",
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  detail?: ReactNode;
  tone?: "ink" | "stamp";
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5 bg-paper px-4 py-3.5 text-paper-ink", className)}>
      <span className="text-[13px] font-medium leading-tight text-ink-soft">{label}</span>
      <span className={cn("font-display text-[34px] font-bold leading-none tracking-[-0.01em]", tone === "stamp" && "text-destructive")}>{value}</span>
      {detail ? <span className="text-[13px] leading-snug text-ink-soft">{detail}</span> : null}
    </div>
  );
}

// --- Copy ---------------------------------------------------------------------------------

export function CopyButton({ value, label = "Copiar", className }: { value: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const reduce = useReducedMotion();
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          toast.success(`${value} copiado`);
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => setCopied(false), 1400);
        } catch {
          toast.error("No se pudo copiar. Mantené presionado el código para copiarlo.");
        }
      }}
      className={cn(btn("quiet", "sm"), "min-w-[104px]", className)}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={copied ? "ok" : "copy"}
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.8, filter: "blur(3px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.8, filter: "blur(3px)" }}
          transition={{ duration: 0.16, ease: EASE_OUT }}
          className="inline-flex items-center gap-1.5"
        >
          {copied ? <Check className="size-4" strokeWidth={2.5} /> : <Copy className="size-4" />}
          {copied ? "Copiado" : label}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

// --- Form fields ------------------------------------------------------------------------

export function FieldLabel({ children, htmlFor, hint }: { children: ReactNode; htmlFor?: string; hint?: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="flex items-baseline justify-between gap-2 text-[14px] font-semibold text-ink">
      <span>{children}</span>
      {hint ? <span className="text-[13px] font-medium text-ink-soft">{hint}</span> : null}
    </label>
  );
}

export function FieldError({ children, id }: { children?: ReactNode; id?: string }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence initial={false}>
      {children ? (
        <motion.p
          id={id}
          role="alert"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: EASE_OUT }}
          className="text-[13px] font-medium text-destructive"
        >
          {children}
        </motion.p>
      ) : null}
    </AnimatePresence>
  );
}

/** beui's liquid stepper fills with --background; give it a visible tint on paper. */
export const STEPPER_CLASS = "bg-ink/6 [--background:color-mix(in_srgb,var(--ink)_16%,var(--paper))]";

export const inputClass =
  "h-12 w-full rounded-none bg-background px-3.5 text-[16px] text-foreground ring-1 ring-inset ring-input outline-none transition-shadow duration-150 placeholder:text-muted-foreground/70 focus:ring-2 focus:ring-ring aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-destructive";

/** Horizontal choice chips: every option visible, one tap. */
export function Chips<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
  size = "md",
}: {
  value: T;
  options: { value: T; label: ReactNode; hint?: ReactNode; disabled?: boolean }[];
  onChange: (v: T) => void;
  label: string;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("flex flex-wrap gap-1.5", className)}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              "pressable inline-flex shrink-0 items-center gap-1.5 px-3 font-semibold whitespace-nowrap transition-colors duration-150 select-none disabled:opacity-40",
              size === "md" ? "h-10 text-[15px]" : "h-8 text-[13px]",
              on ? "bg-ink text-paper" : "bg-ink/8 text-ink hover:bg-ink/14",
            )}
          >
            {o.label}
            {o.hint ? <span className={cn("text-[12px] font-medium", on ? "text-paper/75" : "text-ink-soft")}>{o.hint}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="inline-flex h-6 items-center bg-ink/10 px-1.5 font-sans text-[12px] font-semibold text-ink-soft">{children}</kbd>;
}
