"use client";

import { useState } from "react";
import { LiquidTabBar } from "@/components/nav/liquid-tabbar";
import { useClock, useNow } from "@/lib/sim/hooks";
import { sim } from "@/lib/sim/store";
import { DAY, HOUR, formatDayLong, formatTime, svDateKey, svISO } from "@/lib/domain/format";
import { cn } from "@/lib/utils";

export const SPEEDS = [
  { id: "0", label: "Pausa", speed: 1, paused: true },
  { id: "1", label: "Real", speed: 1, paused: false },
  { id: "60", label: "1 min/s", speed: 60, paused: false },
  { id: "600", label: "10 min/s", speed: 600, paused: false },
  { id: "3600", label: "1 h/s", speed: 3600, paused: false },
] as const;

export function speedId(clock: { speed: number; paused: boolean } | null) {
  if (!clock) return "1";
  if (clock.paused) return "0";
  return String(clock.speed);
}

export function ClockBar({ className }: { className?: string }) {
  const clock = useClock();
  const now = useNow(250);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("05:00");

  return (
    <div className={cn("flex flex-wrap items-end gap-x-8 gap-y-4", className)}>
      <div className="min-w-[16rem]">
        <p className="font-sans text-sm font-semibold text-ink-soft">Hora simulada · El Salvador</p>
        <p className="font-display text-[clamp(2.75rem,5vw,4rem)] font-semibold leading-none tabular">{now ? formatTime(now) : "—"}</p>
        <p className="font-sans text-[17px] first-letter:uppercase">{now ? formatDayLong(now) : " "}</p>
      </div>
      <LiquidTabBar
        variant="segmented"
        ariaLabel="Velocidad del reloj"
        tabs={SPEEDS.map((s) => ({ id: s.id, label: s.label }))}
        activeId={speedId(clock)}
        onSelect={(id) => {
          const s = SPEEDS.find((x) => x.id === id)!;
          void sim.setClock({ speed: s.speed, paused: s.paused });
        }}
        className="w-full max-w-[520px]"
      />
      <div className="flex flex-wrap items-center gap-2 font-sans">
        {[
          ["+1 h", HOUR],
          ["+6 h", 6 * HOUR],
          ["+1 día", DAY],
          ["+1 semana", 7 * DAY],
        ].map(([label, ms]) => (
          <button
            key={label as string}
            type="button"
            onClick={() => void sim.setClock({ jumpMs: ms as number })}
            className="pressable h-10 rounded-full bg-cobalt-900 px-4 text-[15px] font-semibold text-sand-100 hover:bg-cobalt-700"
          >
            {label}
          </button>
        ))}
        <form
          className="flex items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!date) return;
            void sim.setClock({ setTo: Date.parse(svISO(date, time || "05:00")) });
          }}
        >
          <input
            type="date"
            value={date || (now ? svDateKey(now) : "")}
            onChange={(e) => setDate(e.target.value)}
            aria-label="Fecha"
            className="h-10 rounded-full bg-cobalt-900 px-3 text-[15px] text-sand-100 [color-scheme:dark]"
          />
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            aria-label="Hora"
            className="h-10 rounded-full bg-cobalt-900 px-3 text-[15px] text-sand-100 [color-scheme:dark]"
          />
          <button type="submit" className="pressable h-10 rounded-full bg-sand-100 px-4 text-[15px] font-semibold text-cobalt-800 hover:bg-sand-50">
            Ir
          </button>
        </form>
      </div>
    </div>
  );
}
