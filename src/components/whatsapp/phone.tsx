"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowUp, Check, CheckCheck, MapPin, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { Message } from "@/lib/domain/types";
import { formatRelativeDay, formatTime, svDateKey } from "@/lib/domain/format";
import { cn } from "@/lib/utils";
import { WaText } from "./wa-text";

// A WhatsApp conversation drawn in the site's two inks. Used by the simulator
// (visitor and Wilber phones) and by Wilber's WhatsApp screen.

interface Props {
  title: string;
  subtitle?: string;
  messages: Message[];
  /** Phone number of the person holding this phone: their messages go right. */
  owner: string;
  now: number | null;
  onSend?: (text: string) => void;
  suggestions?: string[];
  placeholder?: string;
  /** "device" draws a phone body; "panel" fills its container. */
  variant?: "device" | "panel";
  className?: string;
  emptyText?: string;
}

function Ticks({ m, now }: { m: Message; now: number | null }) {
  if (m.status === "fallido") return <TriangleAlert className="size-3.5 text-stamp" aria-label="No enviado" />;
  if (m.status === "en_cola") return <Check className="size-3.5 opacity-50" aria-label="En cola" />;
  const age = now ? now - Date.parse(m.createdAt) : 0;
  const read = m.status === "leido" || (!m.real && age > 6000);
  const delivered = read || m.status === "entregado" || (!m.real && age > 1500) || m.real;
  if (!delivered) return <Check className="size-3.5 opacity-70" aria-label="Enviado" />;
  return <CheckCheck className={cn("size-3.5", read ? "opacity-100" : "opacity-55")} aria-label={read ? "Leído" : "Entregado"} />;
}

export function WhatsAppPhone({
  title,
  subtitle,
  messages,
  owner,
  now,
  onSend,
  suggestions,
  placeholder = "Mensaje",
  variant = "device",
  className,
  emptyText = "Sin mensajes todavía.",
}: Props) {
  const reduce = useReducedMotion();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState("");
  const sorted = useMemo(() => [...messages].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)), [messages]);
  const rows = useMemo(
    () => sorted.map((m, i) => ({ m, showDay: i === 0 || svDateKey(sorted[i - 1].createdAt) !== svDateKey(m.createdAt) })),
    [sorted],
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: reduce ? "auto" : "smooth" });
  }, [sorted.length, reduce]);

  const send = (text: string) => {
    const t = text.trim();
    if (!t || !onSend) return;
    onSend(t);
    setDraft("");
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    send(draft);
  };

  const body = (
    <div className="flex h-full min-h-0 flex-col bg-sand-100 text-cobalt-900">
      <header className={cn("flex items-center gap-3 bg-cobalt-800 px-4 pb-3 text-sand-50", variant === "device" ? "pt-9" : "pt-4")}>
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sand-100 font-display text-lg font-bold text-cobalt-800">
          {title.slice(0, 1)}
        </span>
        <span className="min-w-0">
          <span className="block truncate font-sans text-[15px] font-semibold leading-tight">{title}</span>
          {subtitle && <span className="block truncate font-sans text-[12px] leading-tight text-cobalt-200">{subtitle}</span>}
        </span>
      </header>

      <div ref={scrollRef} data-lenis-prevent className="scrollbar-none min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 py-3">
        {sorted.length === 0 && <p className="mt-10 text-center font-sans text-sm text-cobalt-600">{emptyText}</p>}
        <AnimatePresence initial={false}>
          {rows.map(({ m, showDay }) => {
            const mine = m.from === owner;
            return (
              <motion.div
                key={m.id}
                layout={reduce ? false : "position"}
                initial={reduce ? false : { opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", duration: 0.35, bounce: 0.12 }}
              >
                {showDay && now !== null && (
                  <div className="my-2 flex justify-center">
                    <span className="bg-sand-300 px-2.5 py-0.5 font-sans text-[12px] font-semibold text-cobalt-700">
                      {formatRelativeDay(m.createdAt, now)}
                    </span>
                  </div>
                )}
                <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
                  <div className={cn("max-w-[86%]", mine ? "items-end" : "items-start", "flex flex-col gap-1")}>
                    <div
                      className={cn(
                        "px-3 py-2 font-sans text-[14px] leading-snug",
                        mine ? "rounded-[14px] rounded-br-[4px] bg-cobalt-800 text-sand-50" : "rounded-[14px] rounded-bl-[4px] bg-sand-50 text-cobalt-900",
                      )}
                    >
                      {m.location && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${m.location.lat},${m.location.lng}`}
                          target="_blank"
                          rel="noreferrer"
                          className="mb-2 block overflow-hidden rounded-[10px] bg-sand-200 text-cobalt-800"
                        >
                          <span className="relative block h-24">
                            <svg className="absolute inset-0 size-full text-cobalt-800/20" aria-hidden>
                              <defs>
                                <pattern id={`dots-${m.id}`} width="10" height="10" patternUnits="userSpaceOnUse">
                                  <circle cx="1.5" cy="1.5" r="1.2" fill="currentColor" />
                                </pattern>
                              </defs>
                              <rect width="100%" height="100%" fill={`url(#dots-${m.id})`} />
                            </svg>
                            <MapPin className="absolute left-1/2 top-1/2 size-7 -translate-x-1/2 -translate-y-full fill-cobalt-800 text-sand-50" />
                          </span>
                          <span className="block px-2.5 py-1.5 text-[13px] font-semibold">{m.location.name}</span>
                          <span className="block px-2.5 pb-2 text-[12px] opacity-80">{m.location.address}</span>
                        </a>
                      )}
                      <WaText text={m.body} />
                      <span className={cn("mt-1 flex items-center justify-end gap-1 text-[12px]", mine ? "text-cobalt-200" : "text-cobalt-600")}>
                        {m.real && <span className="font-semibold">WhatsApp real ·</span>}
                        {formatTime(m.createdAt)}
                        {mine && <Ticks m={m} now={now} />}
                      </span>
                    </div>
                    {m.buttons && m.buttons.length > 0 && (
                      <div className="flex w-full flex-col gap-1">
                        {m.buttons.map((b) => (
                          <button
                            key={b}
                            type="button"
                            disabled={!onSend || mine}
                            onClick={() => send(b)}
                            className="pressable rounded-[10px] bg-sand-50 px-3 py-1.5 text-center font-sans text-[13px] font-semibold text-cobalt-700 enabled:hover:bg-sand-300 disabled:opacity-60"
                          >
                            {b}
                          </button>
                        ))}
                      </div>
                    )}
                    {m.status === "fallido" && mine && <span className="font-sans text-[12px] font-semibold text-stamp">No se pudo enviar</span>}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {onSend && (
        <div className="bg-sand-200 px-2.5 pb-3 pt-2">
          {suggestions && suggestions.length > 0 && (
            <div className="scrollbar-none mb-2 flex gap-1.5 overflow-x-auto">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="pressable shrink-0 rounded-full bg-sand-50 px-3 py-1 font-sans text-[13px] font-semibold text-cobalt-800 hover:bg-sand-300"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <form onSubmit={submit} className="flex items-center gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={placeholder}
              aria-label={placeholder}
              className="h-11 min-w-0 flex-1 rounded-full bg-sand-50 px-4 font-sans text-[16px] text-cobalt-900 outline-none placeholder:text-cobalt-600/70 focus-visible:ring-2 focus-visible:ring-cobalt-800"
            />
            <button
              type="submit"
              disabled={!draft.trim()}
              aria-label="Enviar"
              className="pressable grid size-11 shrink-0 place-items-center rounded-full bg-cobalt-800 text-sand-50 disabled:opacity-40"
            >
              <ArrowUp className="size-5" />
            </button>
          </form>
        </div>
      )}
    </div>
  );

  if (variant === "panel") return <div className={cn("h-full min-h-0 overflow-hidden", className)}>{body}</div>;
  return (
    <div className={cn("relative mx-auto h-[640px] w-[320px] max-w-full rounded-[44px] bg-cobalt-950 p-2.5", className)}>
      <div className="absolute left-1/2 top-2.5 z-10 h-6 w-24 -translate-x-1/2 rounded-b-2xl bg-cobalt-950" aria-hidden />
      <div className="h-full overflow-hidden rounded-[36px]">{body}</div>
    </div>
  );
}
