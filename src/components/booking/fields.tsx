"use client";

import { animate, AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Plus } from "lucide-react";
import type { PaymentMethod } from "@/lib/domain/types";
import { formatUsd } from "@/lib/domain/format";
import { Input } from "@/components/motion/input";
import { RadioGroup, RadioGroupItem } from "@/components/motion/radio";
import { cx } from "./cx";

// Form fields of the booking panel: beui Input/Radio set as Wilber's forms
// (square, 2px field edge, sand well that lightens on focus, stamp red errors).
// Sizes inside beui classNames use the length form (see cx.ts).

const INPUT_CLASSES = {
  root: "gap-2",
  label: "px-0 text-(length:--step-small) font-semibold",
  field:
    "h-[52px] rounded-none border-2 bg-sand-100 transition-[background-color,border-color,box-shadow] duration-200 hover:bg-sand-50 focus-within:bg-sand-50",
  input: "text-(length:--step-body)",
  errorMessage: "px-0 text-(length:--step-small) font-semibold",
  successIcon: "text-cobalt-700",
};

interface TextFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  success?: boolean;
  type?: string;
  inputMode?: "text" | "email" | "tel" | "numeric";
  autoComplete?: string;
  placeholder?: string;
  maxLength?: number;
}

export function TextField({ id, label, value, onChange, onBlur, error, success, type = "text", inputMode, autoComplete, placeholder, maxLength }: TextFieldProps) {
  return (
    <Input
      id={id}
      label={label}
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      error={error}
      success={success && !error}
      type={type}
      inputMode={inputMode}
      autoComplete={autoComplete}
      placeholder={placeholder}
      maxLength={maxLength}
      spellCheck={false}
      classNames={{ ...INPUT_CLASSES, input: cx(INPUT_CLASSES.input, "placeholder:text-cobalt-600/70") }}
    />
  );
}

/** "7012 3456" while typing; pasting "+503 7012-3456" also works. */
export function formatLocalPhone(raw: string) {
  let digits = raw.replace(/\D/g, "");
  if (digits.length > 8 && digits.startsWith("503")) digits = digits.slice(3);
  digits = digits.slice(0, 8);
  return digits.length > 4 ? `${digits.slice(0, 4)} ${digits.slice(4)}` : digits;
}

export function PhoneField(props: Omit<TextFieldProps, "type" | "inputMode" | "autoComplete" | "maxLength">) {
  return (
    <Input
      id={props.id}
      label={props.label}
      value={props.value}
      onChange={(v) => props.onChange(formatLocalPhone(v))}
      onBlur={props.onBlur}
      error={props.error}
      success={props.success && !props.error}
      type="tel"
      inputMode="tel"
      autoComplete="tel-national"
      placeholder={props.placeholder}
      leftIcon={<span className="text-(length:--step-body) font-semibold text-cobalt-800">+503</span>}
      classNames={{ ...INPUT_CLASSES, input: cx(INPUT_CLASSES.input, "pl-[4.4rem] tabular placeholder:text-cobalt-600/70") }}
    />
  );
}

/** Optional notes: a one-line button until the visitor wants to write. */
export function NotesField({ id, label, value, onChange, max = 280 }: { id: string; label: string; value: string; onChange: (v: string) => void; max?: number }) {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  const left = max - value.length;
  if (!open && !value) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="pressable -mx-1 inline-flex items-center gap-2 self-start px-1 py-1.5 text-small font-semibold underline decoration-2 underline-offset-4 hover:bg-sand-300"
      >
        <Plus aria-hidden className="size-4" strokeWidth={3} />
        {label}
      </button>
    );
  }
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
      className="flex flex-col gap-2"
    >
      <label htmlFor={id} className="text-small font-semibold">
        {label}
      </label>
      <div className="relative">
        <textarea
          id={id}
          value={value}
          maxLength={max}
          rows={3}
          autoFocus={open && !value}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={`${id}-count`}
          className="block w-full resize-none rounded-none border-2 border-border bg-sand-100 px-3.5 pb-7 pt-3 text-body leading-snug text-ink outline-none transition-[background-color,border-color,box-shadow] duration-200 hover:bg-sand-50 focus:border-cobalt-800/40 focus:bg-sand-50 focus:ring-2 focus:ring-ring/40"
        />
        <span
          id={`${id}-count`}
          className={cx("tabular pointer-events-none absolute bottom-2 right-3 text-small", left < 20 ? "font-semibold text-stamp" : "text-ink-soft")}
        >
          {left}
          <span className="sr-only"> caracteres disponibles</span>
        </span>
      </div>
    </motion.div>
  );
}

export function PayChoice({
  value,
  onChange,
  total,
  deposit,
  error,
}: {
  value: PaymentMethod;
  onChange: (value: PaymentMethod) => void;
  total: number;
  deposit: number;
  error?: string;
}) {
  const uid = useId();
  const options: { value: PaymentMethod; label: string; detail: string }[] = [
    { value: "en_sitio", label: "El día de la salida", detail: `Pagás ${formatUsd(total)} al llegar.` },
    { value: "wompi", label: "Anticipo en línea", detail: `${formatUsd(deposit)} ahora · ${formatUsd(total - deposit)} el día de la salida.` },
  ];
  return (
    <fieldset id="bk-paymentMethod" tabIndex={-1} className="flex flex-col gap-2 outline-none">
      <legend className="mb-2 text-small font-semibold">Pago</legend>
      <RadioGroup value={value} onValueChange={(v) => onChange(v as PaymentMethod)} aria-label="Pago" className="gap-1.5">
        {options.map((o) => {
          const selected = o.value === value;
          const id = `${uid}-${o.value}`;
          return (
            <div
              key={o.value}
              onClick={() => onChange(o.value)}
              className={cx(
                "print-corners flex cursor-pointer items-start gap-3.5 px-4 py-3.5 transition-[background-color,color,transform] duration-200 active:scale-[0.99]",
                selected ? "field-ink" : "bg-sand-100 hover:bg-sand-300",
              )}
            >
              <RadioGroupItem value={o.value} id={id} className="mt-1" />
              <label htmlFor={id} className="flex min-w-0 flex-1 cursor-pointer flex-col gap-0.5">
                <span className="text-body font-semibold leading-tight">{o.label}</span>
                <span className="tabular text-small">{o.detail}</span>
              </label>
            </div>
          );
        })}
      </RadioGroup>
      {error ? (
        <p role="alert" className="text-small font-semibold text-stamp">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

/** Shakes its child when `signal` changes (a failed confirm, a blocked step). */
export function Shake({ signal, children, className }: { signal: number; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (!signal || reduce || !ref.current) return;
    animate(ref.current, { x: [0, -7, 7, -4, 4, -2, 0] }, { duration: 0.42 });
  }, [signal, reduce]);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

/** One line of status under a control; slides in, says what happened. */
export function Note({ tone = "ink", children, id }: { tone?: "ink" | "stamp"; children?: ReactNode; id?: string }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence initial={false} mode="popLayout">
      {children ? (
        <motion.p
          key={String(children)}
          id={id}
          role={tone === "stamp" ? "alert" : "status"}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6, filter: "blur(3px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4, filter: "blur(3px)" }}
          transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
          className={cx("text-small font-semibold leading-snug", tone === "stamp" ? "text-stamp" : "text-ink")}
        >
          {children}
        </motion.p>
      ) : null}
    </AnimatePresence>
  );
}
