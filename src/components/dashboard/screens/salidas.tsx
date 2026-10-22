"use client";

import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useState } from "react";
import { LiquidTabBar } from "@/components/nav/liquid-tabbar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/motion/select";
import { addDays, plural, svDateKey } from "@/lib/domain/format";
import { useConflicts, useDepartures, useNow, type DepartureView } from "@/lib/sim/hooks";
import { cn } from "@/lib/utils";
import { MonthGrid, WeekGrid, type CalendarData } from "../calendar";
import { useDash } from "../context";
import { DepartureRow } from "../departure-row";
import { useIndex, useIsDesktop } from "../hooks";
import { capitalize, dayLabelLong, keyParts, mondayOfKey, monthGrid, monthTitle, MONTHS_SHORT } from "../lib";
import { Btn, Empty, IconBtn, SectionTitle } from "../ui";

type View = "mes" | "semana";

export function SalidasScreen() {
  const idx = useIndex();
  const now = useNow(30_000);
  const deps = useDepartures();
  const conflicts = useConflicts();
  const desktop = useIsDesktop();
  const { open } = useDash();
  const [view, setView] = useState<View>("mes");
  const [anchor, setAnchor] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [tour, setTour] = useState("todos");
  const [dir, setDir] = useState(1);

  if (!idx || now === null || !deps) return <div className="h-[520px] animate-pulse bg-paper" aria-busy="true" />;

  const today = svDateKey(now);
  const base = anchor ?? today;
  const day = selected ?? today;
  const list = tour === "todos" ? deps : deps.filter((d) => d.tourId === tour);
  const byDay = new Map<string, DepartureView[]>();
  for (const d of list) {
    const k = svDateKey(d.startsAt);
    const arr = byDay.get(k);
    if (arr) arr.push(d);
    else byDay.set(k, [d]);
  }
  const data: CalendarData = {
    byDay,
    tours: idx.tourById,
    refs: idx.refs,
    crossed: new Set((conflicts ?? []).flatMap((c) => c.departureIds)),
    today,
  };

  const p = keyParts(base);
  const { days } = monthGrid(p.year, p.month);
  const month = base.slice(0, 7);
  const weekStart = mondayOfKey(base);
  const weekEnd = addDays(weekStart, 6);
  const wp = keyParts(weekEnd);
  const sp = keyParts(weekStart);
  const title =
    view === "mes"
      ? monthTitle(p.year, p.month)
      : sp.month === wp.month
        ? `${sp.day}–${wp.day} ${MONTHS_SHORT[wp.month - 1]}`
        : `${sp.day} ${MONTHS_SHORT[sp.month - 1]} – ${wp.day} ${MONTHS_SHORT[wp.month - 1]}`;

  const page = (step: number) => {
    setDir(step);
    if (view === "mes") {
      const target = new Date(Date.UTC(p.year, p.month - 1 + step, 1));
      const key = `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, "0")}-01`;
      setAnchor(key);
      if (!desktop) setSelected(key.slice(0, 7) === today.slice(0, 7) ? today : key);
    } else {
      setAnchor(addDays(weekStart, step * 7));
    }
  };

  const goToday = () => {
    setDir(base > today ? -1 : 1);
    setAnchor(null);
    setSelected(null);
  };

  const inRange = view === "mes" ? list.filter((d) => svDateKey(d.startsAt).slice(0, 7) === month) : list.filter((d) => svDateKey(d.startsAt) >= weekStart && svDateKey(d.startsAt) <= weekEnd);
  const live = inRange.filter((d) => d.status !== "cancelada");
  const seats = live.reduce((n, d) => n + d.seatsTaken, 0);
  const cap = live.reduce((n, d) => n + d.capacity, 0);
  const agenda = byDay.get(day) ?? [];
  const newOn = (key: string) => open({ kind: "new-departure", dateKey: key, tourId: tour === "todos" ? undefined : tour });

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
        <div className="flex items-center">
          <IconBtn label={view === "mes" ? "Mes anterior" : "Semana anterior"} onClick={() => page(-1)}>
            <ChevronLeft className="size-6" />
          </IconBtn>
          <h2 className="min-w-[9.5rem] text-center font-display text-[26px] font-bold uppercase leading-none text-ink">{title}</h2>
          <IconBtn label={view === "mes" ? "Mes siguiente" : "Semana siguiente"} onClick={() => page(1)}>
            <ChevronRight className="size-6" />
          </IconBtn>
        </div>
        <Btn variant="quiet" size="sm" onClick={goToday} disabled={!anchor && !selected}>
          Hoy
        </Btn>
        <div className="ml-auto flex w-full items-center gap-2 sm:w-auto">
          <LiquidTabBar
            variant="segmented"
            ariaLabel="Vista"
            activeId={view}
            onSelect={(id) => setView(id as View)}
            tabs={[
              { id: "mes", label: "Mes" },
              { id: "semana", label: "Semana" },
            ]}
            className="w-[196px] shrink-0"
          />
          <Select value={tour} onValueChange={setTour} className="min-w-0 flex-1 sm:w-56 sm:flex-none">
            <SelectTrigger className="h-[52px] rounded-none! text-[15px]">
              <SelectValue placeholder="Tour" />
            </SelectTrigger>
            <SelectContent className="max-h-80 overflow-y-auto rounded-none!">
              <SelectItem value="todos" className="rounded-none py-2 text-[15px]">
                Todos los tours
              </SelectItem>
              {idx.tours.map((t) => (
                <SelectItem key={t.id} value={t.id} className="rounded-none py-2 text-[15px]">
                  {t.shortName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {desktop ? (
          <Btn onClick={() => newOn(day >= today ? day : today)}>
            <Plus className="size-4" /> Nueva salida
          </Btn>
        ) : null}
      </div>

      <p className="text-[14px] text-ink-soft">
        {plural(live.length, "salida", "salidas")} · {seats} de {cap} asientos vendidos{cap ? ` (${Math.round((seats / cap) * 100)} %)` : ""}
        {data.crossed.size ? <span className="font-semibold text-destructive"> · {plural(inRange.filter((d) => data.crossed.has(d.id)).length, "salida con cruce", "salidas con cruce")}</span> : null}
      </p>

      {view === "mes" ? (
        <MonthGrid
          days={days}
          month={month}
          data={data}
          dir={dir}
          compact={!desktop}
          selected={day}
          onSelectDay={(key) => {
            if (desktop) {
              setAnchor(key);
              setView("semana");
            } else setSelected(key);
          }}
          onOpen={(id) => open({ kind: "departure", id })}
          onNew={newOn}
          onPage={page}
        />
      ) : (
        <WeekGrid start={weekStart} data={data} dir={dir} onOpen={(id) => open({ kind: "departure", id })} onNew={newOn} onPage={page} />
      )}

      {view === "mes" && !desktop ? (
        <section aria-live="polite" className="mt-2">
          <SectionTitle
            aside={
              day >= today ? (
                <Btn size="sm" onClick={() => newOn(day)}>
                  <Plus className="size-4" /> Salida
                </Btn>
              ) : undefined
            }
          >
            {capitalize(dayLabelLong(day))}
          </SectionTitle>
          {agenda.length ? (
            <ul className={cn("flex flex-col gap-1.5")}>
              {agenda.map((d) => (
                <li key={d.id}>
                  <DepartureRow dep={d} tour={idx.tourById.get(d.tourId)} refCode={idx.refs.get(d.id) ?? ""} crossed={data.crossed.has(d.id)} onOpen={() => open({ kind: "departure", id: d.id })} />
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Sin salidas ese día.</Empty>
          )}
        </section>
      ) : null}
    </div>
  );
}
