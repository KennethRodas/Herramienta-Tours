"use client";

import { NumberTicker } from "@/components/motion/number-ticker";
import { useSimState, useStats } from "@/lib/sim/hooks";
import { cn } from "@/lib/utils";

export function SimMetrics({ className }: { className?: string }) {
  const stats = useStats();
  const state = useSimState();
  const overbooked = state ? state.departures.filter((d) => d.seatsTaken > d.capacity).length : 0;
  const items: { label: string; value: number; prefix?: string; alert?: boolean }[] = stats
    ? [
        { label: "Reservas en esta sesión", value: stats.bookingsCreated },
        { label: "Cupos vendidos", value: stats.seatsSold },
        { label: "Rechazadas por falta de cupo", value: stats.overbookingsPrevented },
        { label: "Salidas con sobreventa", value: overbooked, alert: overbooked > 0 },
        { label: "Cruces resueltos", value: stats.conflictsResolved },
        { label: "Gasto evitado por cruces", value: stats.moneyProtectedUsd, prefix: "$" },
        { label: "Mensajes enviados", value: stats.messagesSent },
      ]
    : [];
  return (
    <dl className={cn("grid grid-cols-2 gap-2 font-sans", className)}>
      {items.map((it, i) => (
        <div key={it.label} className={cn("rounded-ticket bg-cobalt-900 p-4", i === items.length - 1 && items.length % 2 === 1 && "col-span-2")}>
          <dt className="text-[14px] leading-tight text-cobalt-200">{it.label}</dt>
          <dd className={cn("mt-1 font-display text-4xl font-semibold leading-none", it.alert && "text-[#ff8b7e]")}>
            <NumberTicker value={it.value} prefix={it.prefix} />
          </dd>
        </div>
      ))}
    </dl>
  );
}
