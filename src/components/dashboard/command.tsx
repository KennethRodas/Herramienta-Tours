"use client";

import { CalendarPlus, CloudRain, Moon, Sun, SunMoon, Ticket, TicketPlus, CalendarDays } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { toast } from "sonner";
import type { CommandItem } from "@/components/motion/command-palette";
import { DAY, formatDayShort, formatTime, svDateKey } from "@/lib/domain/format";
import { useNow } from "@/lib/sim/hooks";
import { useDash } from "./context";
import { THEME_LABEL, useIndex, useThemeMode, type ThemeMode } from "./hooks";
import { BOOKING_STATUS_LABEL } from "./lib";
import { NAV, OUTSIDE } from "./nav";

/** Everything the ⌘K palette can find: pages, actions, departures by ref, bookings by code or name. */
export function useCommandItems(): CommandItem[] {
  const idx = useIndex();
  const now = useNow(60_000);
  const router = useRouter();
  const { open } = useDash();
  const [, setMode] = useThemeMode();

  return useMemo(() => {
    const items: CommandItem[] = [];
    for (const n of [...NAV, ...OUTSIDE]) {
      items.push({
        id: `ir-${n.id}`,
        label: n.label,
        group: "Ir a",
        icon: n.icon,
        keywords: [n.href.replace("/wilber/", "")],
        onSelect: () => router.push(n.href),
      });
    }
    items.push(
      { id: "accion-salida", label: "Nueva salida", group: "Acciones", icon: CalendarPlus, keywords: ["crear", "salida"], onSelect: () => open({ kind: "new-departure" }) },
      { id: "accion-reserva", label: "Reserva manual", group: "Acciones", icon: TicketPlus, keywords: ["whatsapp", "telefono", "nueva"], onSelect: () => open({ kind: "new-booking" }) },
      { id: "accion-clima", label: "Aviso de clima", group: "Acciones", icon: CloudRain, keywords: ["lluvia", "tormenta"], onSelect: () => open({ kind: "weather" }) },
    );
    for (const mode of ["auto", "dia", "noche"] as ThemeMode[]) {
      items.push({
        id: `tema-${mode}`,
        label: `Tema: ${THEME_LABEL[mode]}`,
        group: "Acciones",
        icon: mode === "auto" ? SunMoon : mode === "dia" ? Sun : Moon,
        keywords: ["tema", "oscuro", "claro"],
        onSelect: () => {
          setMode(mode);
          toast(`Tema: ${THEME_LABEL[mode]}`);
        },
      });
    }
    if (!idx || now === null) return items;

    const from = now - DAY;
    const deps = idx.s.departures
      .filter((d) => d.status !== "cancelada" && Date.parse(d.startsAt) > from)
      .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
    for (const d of deps) {
      const tour = idx.tourById.get(d.tourId);
      const ref = idx.refs.get(d.id) ?? "";
      items.push({
        id: `salida-${d.id}`,
        label: `${ref} · ${tour?.shortName ?? ""} · ${formatDayShort(d.startsAt)} ${formatTime(d.startsAt)}`,
        group: "Salidas",
        icon: CalendarDays,
        hint: `${d.seatsTaken}/${d.capacity}`,
        keywords: [ref, tour?.name ?? "", tour?.code ?? "", svDateKey(d.startsAt)],
        onSelect: () => open({ kind: "departure", id: d.id }),
      });
    }

    const recent = now - 7 * DAY;
    for (const b of idx.s.bookings) {
      const d = idx.departureById.get(b.departureId);
      if (!d || Date.parse(d.startsAt) < recent) continue;
      const tour = idx.tourById.get(b.tourId);
      const ref = idx.refs.get(d.id) ?? "";
      items.push({
        id: `reserva-${b.id}`,
        label: `${b.code} · ${b.name}`,
        group: "Reservas",
        icon: Ticket,
        hint: ref,
        keywords: [b.code.slice(4), b.phone, b.phone.slice(3), tour?.shortName ?? "", ref, BOOKING_STATUS_LABEL[b.status]],
        onSelect: () => open({ kind: "booking", id: b.id }),
      });
    }
    return items;
  }, [idx, now, router, open, setMode]);
}
