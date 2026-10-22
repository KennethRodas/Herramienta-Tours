"use client";

import { useMemo, useState } from "react";
import { DonutChart, DonutChartCenter, DonutChartLegend, DonutChartPlot, type DonutSegment } from "@/components/charts/donut-chart";
import { HeatCalendar, HeatCalendarGrid, HeatCalendarTooltip, useHeatCalendar } from "@/components/charts/heat-calendar";
import { LiquidTabBar } from "@/components/nav/liquid-tabbar";
import { Tooltip } from "@/components/motion/tooltip";
import type { BookingSource } from "@/lib/domain/types";
import { DAY, addDays, formatUsd, plural, svDateKey } from "@/lib/domain/format";
import { useNow } from "@/lib/sim/hooks";
import { cn } from "@/lib/utils";
import { useIndex, type DashIndex } from "../hooks";
import { MONTHS_SHORT, SOURCE_LABEL, SOURCE_ORDER, collectedUsd, dayLabelLong, expectedUsd, keyParts, mondayOfKey, pct } from "../lib";
import { Empty, SectionTitle, Stat } from "../ui";

type Range = "7" | "30";

// Only what the simulation actually holds: seats, bookings, payments. No traffic, no invented rates.

const WEEKS = 10;
const PAST_WEEKS = 4;

/** Ordinal steps of the two inks, validated (dataviz validator, --ordinal) on sand-50 and cobalt-900. */
const VIZ_CSS = `
.wilber-viz { --seg-1: var(--cobalt-950); --seg-2: var(--cobalt-800); --seg-3: var(--cobalt-600); --seg-otros: var(--sand-400); }
[data-theme="noche"] .wilber-viz { --seg-1: var(--cobalt-200); --seg-2: var(--cobalt-300); --seg-3: var(--cobalt-600); --seg-otros: var(--cobalt-700); }
`;

function compute(idx: DashIndex, now: number, days: number) {
  const s = idx.s;
  const from = now - days * DAY;
  const to = now + days * DAY;
  const depById = idx.departureById;

  let seats = 0;
  let cap = 0;
  let futureCount = 0;
  for (const d of s.departures) {
    const t = Date.parse(d.startsAt);
    if (d.status === "cancelada" || t <= now || t > to) continue;
    seats += d.seatsTaken;
    cap += d.capacity;
    futureCount++;
  }

  let collected = 0;
  let pastDeps = 0;
  let expected = 0;
  let shown = 0;
  let missed = 0;
  let missedPeople = 0;
  let groupSum = 0;
  let groupN = 0;
  const byTour = new Map<string, { cobrado: number; esperado: number }>();
  const channels = new Map<BookingSource, { groups: number; people: number }>(SOURCE_ORDER.map((k) => [k, { groups: 0, people: 0 }]));

  const pastSet = new Set<string>();
  for (const b of s.bookings) {
    const d = depById.get(b.departureId);
    if (!d) continue;
    const t = Date.parse(d.startsAt);
    const created = Date.parse(b.createdAt);
    if (created >= from && created <= now) {
      const c = channels.get(b.source)!;
      c.groups++;
      c.people += b.partySize;
    }
    if (d.status === "cancelada") continue;
    const ended = Date.parse(d.endsAt) <= now;
    if (ended && t >= from) {
      const money = collectedUsd(b, d.priceUsd);
      collected += money;
      pastSet.add(d.id);
      const tt = byTour.get(b.tourId) ?? { cobrado: 0, esperado: 0 };
      tt.cobrado += money;
      byTour.set(b.tourId, tt);
      if (b.status === "check_in") shown++;
      if (b.status === "no_show") {
        missed++;
        missedPeople += b.partySize;
      }
    }
    if (t > now && t <= to) {
      const money = expectedUsd(b, d.priceUsd);
      expected += money;
      const tt = byTour.get(b.tourId) ?? { cobrado: 0, esperado: 0 };
      tt.esperado += money;
      byTour.set(b.tourId, tt);
    }
    if (b.status !== "cancelada" && t >= from && t <= to) {
      groupSum += b.partySize;
      groupN++;
    }
  }
  pastDeps = pastSet.size;

  const tours = [...byTour.entries()]
    .map(([id, v]) => ({ id, name: idx.tourById.get(id)?.shortName ?? id, cobrado: v.cobrado, esperado: v.esperado, total: v.cobrado + v.esperado }))
    .filter((t) => t.total > 0)
    .sort((a, b) => b.total - a.total);

  return {
    occ: { seats, cap, count: futureCount, ratio: cap ? seats / cap : 0 },
    collected,
    pastDeps,
    expected,
    noShow: { missed, total: shown + missed, people: missedPeople },
    avgGroup: groupN ? groupSum / groupN : 0,
    groupN,
    channels,
    tours,
  };
}

export function NumerosScreen() {
  const idx = useIndex();
  const now = useNow(60_000);
  const [range, setRange] = useState<Range>("30");
  const days = Number(range);
  const data = useMemo(() => (idx && now !== null ? compute(idx, now, days) : null), [idx, now, days]);

  if (!idx || now === null || !data) return <div className="h-[520px] animate-pulse bg-paper" aria-busy="true" />;

  const n = days === 7 ? "7 días" : "30 días";
  const channelTotal = [...data.channels.values()].reduce((s, c) => s + c.groups, 0);

  return (
    <div className="wilber-viz flex flex-col gap-8">
      <style>{VIZ_CSS}</style>

      <div className="flex flex-wrap items-center gap-3">
        <LiquidTabBar
          variant="segmented"
          ariaLabel="Período"
          activeId={range}
          onSelect={(id) => setRange(id as Range)}
          tabs={[
            { id: "7", label: "7 días" },
            { id: "30", label: "30 días" },
          ]}
          className="w-[200px]"
        />
      </div>

      <section className="grid grid-cols-2 gap-1.5 lg:grid-cols-5" aria-label="Resumen">
        <Stat
          className="col-span-2 lg:col-span-1"
          label={`Ocupación · próximos ${n}`}
          value={pct(data.occ.ratio)}
          detail={`${data.occ.seats} de ${data.occ.cap} asientos · ${plural(data.occ.count, "salida", "salidas")}`}
        />
        <Stat label={`Cobrado · últimos ${n}`} value={formatUsd(data.collected)} detail={plural(data.pastDeps, "salida realizada", "salidas realizadas")} />
        <Stat label={`Esperado · próximos ${n}`} value={formatUsd(data.expected)} detail="Reservas activas" />
        <Stat label="Grupo promedio" value={data.avgGroup ? data.avgGroup.toFixed(1).replace(".", ",") : "—"} detail={`personas · ${plural(data.groupN, "reserva", "reservas")}`} />
        <Stat
          label={`No vino · últimos ${n}`}
          value={data.noShow.total ? pct(data.noShow.missed / data.noShow.total) : "—"}
          detail={`${data.noShow.missed} de ${plural(data.noShow.total, "grupo", "grupos")} · ${plural(data.noShow.people, "persona", "personas")}`}
          tone={data.noShow.total && data.noShow.missed / data.noShow.total > 0.1 ? "stamp" : "ink"}
        />
      </section>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <OccupancyCalendar idx={idx} now={now} />
        <RevenueByTour tours={data.tours} label={n} />
      </div>

      <section aria-labelledby="canales">
        <SectionTitle id="canales" aside={`Creadas en los últimos ${n} · ${plural(channelTotal, "reserva", "reservas")}`}>
          Reservas por canal
        </SectionTitle>
        <div className="flex flex-col gap-1.5 bg-paper px-4 py-4 text-paper-ink">
          {SOURCE_ORDER.map((k) => {
            const c = data.channels.get(k)!;
            const share = channelTotal ? c.groups / channelTotal : 0;
            return (
              <Tooltip
                key={k}
                side="top"
                content={
                  <span className="text-[13px]">
                    <b>{c.groups}</b> {SOURCE_LABEL[k]} · {pct(share)} · {plural(c.people, "persona", "personas")}
                  </span>
                }
              >
                <button type="button" className="grid grid-cols-[92px_minmax(0,1fr)_96px] items-center gap-3 py-1 text-left">
                  <span className="text-[15px] font-semibold">{SOURCE_LABEL[k]}</span>
                  <span className="relative h-3.5 bg-ink/8">
                    <span className="absolute inset-y-0 left-0 rounded-r-[3px] bg-ink transition-[width] duration-500" style={{ width: `${share * 100}%`, transitionTimingFunction: "var(--ease-out)" }} />
                  </span>
                  <span className="text-right text-[14px] tabular">
                    <b className="font-semibold">{c.groups}</b> <span className="text-ink-soft">· {pct(share)}</span>
                  </span>
                </button>
              </Tooltip>
            );
          })}
        </div>
      </section>
    </div>
  );
}

// --- Daily occupancy -----------------------------------------------------------------

function OccupancyCalendar({ idx, now }: { idx: DashIndex; now: number }) {
  const today = svDateKey(now);
  const startKey = addDays(mondayOfKey(today), -PAST_WEEKS * 7);
  const endKey = addDays(startKey, WEEKS * 7 - 1);

  const daily = useMemo(() => {
    const map = new Map<string, { seats: number; cap: number; count: number }>();
    for (const d of idx.s.departures) {
      if (d.status === "cancelada") continue;
      const k = svDateKey(d.startsAt);
      if (k < startKey || k > endKey) continue;
      const cur = map.get(k) ?? { seats: 0, cap: 0, count: 0 };
      cur.seats += d.seatsTaken;
      cur.cap += d.capacity;
      cur.count++;
      map.set(k, cur);
    }
    return map;
  }, [idx, startKey, endKey]);

  const values: number[][] = Array.from({ length: WEEKS }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const v = daily.get(addDays(startKey, w * 7 + d));
      return v && v.cap ? v.seats / v.cap : 0;
    }),
  );
  const todayIndex = Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${startKey}T12:00:00Z`)) / DAY);
  const tw = Math.floor(todayIndex / 7);
  const td = todayIndex % 7;
  const months: { w: number; label: string }[] = [];
  for (let w = 0; w < WEEKS; w++) {
    const first = addDays(startKey, w * 7);
    const m = keyParts(first).month;
    const prev = w ? keyParts(addDays(startKey, (w - 1) * 7)).month : -1;
    if (m !== prev) months.push({ w, label: MONTHS_SHORT[m - 1] });
  }
  const keyOf = (date: Date) => date.toISOString().slice(0, 10);
  const spanStats = (from: string, to: string) => {
    let seats = 0;
    let cap = 0;
    let count = 0;
    for (let k = from; k <= to; k = addDays(k, 1)) {
      const v = daily.get(k);
      if (!v) continue;
      seats += v.seats;
      cap += v.cap;
      count += v.count;
    }
    return { seats, cap, count };
  };

  return (
    <section aria-labelledby="ocupacion">
      <SectionTitle id="ocupacion" aside="4 semanas atrás · 6 adelante">
        Ocupación por día
      </SectionTitle>
      <div id="ocupacion-cal" className="flex flex-col gap-3 bg-paper px-4 py-4 text-paper-ink">
        <style>{`#ocupacion-cal [data-heat-cell="${tw}-${td}"]{outline:2px solid var(--destructive);outline-offset:2px}`}</style>
        <HeatCalendar values={values} weeks={WEEKS} endDate={new Date(`${endKey}T00:00:00Z`)} maxCount={100} unit="% de ocupación" color="var(--ink)" className="w-full">
          <div className="flex gap-2">
            <div aria-hidden className="grid shrink-0 gap-1 text-[11px] font-semibold text-ink-soft" style={{ gridTemplateRows: "12px repeat(7, minmax(0, 1fr))" }}>
              <span />
              {["L", "M", "M", "J", "V", "S", "D"].map((l, i) => (
                <span key={i} className="flex items-center">
                  {i % 2 === 0 ? l : ""}
                </span>
              ))}
            </div>
            <div className="relative min-w-0 flex-1">
              <HeatCalendarGrid className="w-full! [&>span.whitespace-nowrap]:invisible">
                <HeatCalendarTooltip>
                  {(t) => {
                    const from = keyOf(t.startDate ?? t.date);
                    const to = keyOf(t.endDate ?? t.date);
                    const st = spanStats(from, to);
                    return (
                      <span className="flex flex-col gap-0.5 text-[13px]">
                        <span className="font-semibold">{st.cap ? pct(st.seats / st.cap) : "Sin salidas"}</span>
                        <span>{from === to ? dayLabelLong(from) : `${dayLabelLong(from)} – ${dayLabelLong(to)}`}</span>
                        {st.cap ? (
                          <span className="opacity-75">
                            {st.seats} de {st.cap} asientos · {plural(st.count, "salida", "salidas")}
                          </span>
                        ) : null}
                      </span>
                    );
                  }}
                </HeatCalendarTooltip>
              </HeatCalendarGrid>
              <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-3">
                {months.map((m) => (
                  <span key={m.w} className="absolute top-0 text-[11px] font-semibold leading-none text-ink-soft" style={{ left: `calc(${m.w} * (100% + 4px) / ${WEEKS})` }}>
                    {m.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <HeatLegend />
        </HeatCalendar>
      </div>
    </section>
  );
}

function HeatLegend() {
  const { step, setStep, fill, canHover, reduce } = useHeatCalendar();
  const labels = ["0–19 %", "20–39 %", "40–59 %", "60–79 %", "80–100 %"];
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-[12px] text-ink-soft">
      <span className="flex items-center gap-1.5">
        <span aria-hidden className="size-3 outline-2 outline-offset-1 outline-destructive" style={{ outlineStyle: "solid", background: fill(0) }} />
        Hoy
      </span>
      <span className="flex items-center gap-1" onPointerLeave={() => setStep(null)}>
        <span className="mr-0.5">0 %</span>
        {labels.map((l, i) => (
          <button
            key={l}
            type="button"
            aria-label={`Mostrar días con ${l}`}
            aria-pressed={step === i}
            onPointerEnter={() => {
              if (canHover) setStep(i);
            }}
            onFocus={() => setStep(i)}
            onBlur={() => setStep(null)}
            onClick={() => setStep(step === i ? null : i)}
            className="size-3.5 transition-transform duration-150"
            style={{ background: fill(i), transform: !reduce && step === i ? "scale(1.25)" : undefined }}
          />
        ))}
        <span className="ml-0.5">100 %</span>
      </span>
    </div>
  );
}

// --- Revenue by tour ---------------------------------------------------------------------

function RevenueByTour({ tours, label }: { tours: { id: string; name: string; cobrado: number; esperado: number; total: number }[]; label: string }) {
  const [active, setActive] = useState<string | null>(null);
  const top = tours.slice(0, 3);
  const rest = tours.slice(3);
  const restTotal = rest.reduce((s, t) => s + t.total, 0);
  const segments: DonutSegment[] = [
    ...top.map((t, i) => ({ id: t.id, name: t.name, value: t.total, color: `var(--seg-${i + 1})` })),
    ...(restTotal > 0 ? [{ id: "otros", name: `Otros (${rest.length})`, value: restTotal, color: "var(--seg-otros)" }] : []),
  ];
  const total = tours.reduce((s, t) => s + t.total, 0);

  return (
    <section aria-labelledby="ingresos">
      <SectionTitle id="ingresos" aside={`Cobrado + esperado · ${label} atrás y adelante`}>
        Ingresos por tour
      </SectionTitle>
      {total ? (
        <div className="flex flex-col gap-4 bg-paper px-4 py-4 text-paper-ink">
          <DonutChart segments={segments} formatValue={(v) => formatUsd(Math.round(v))} label="Ingresos por tour" activeId={active} onActiveChange={setActive}>
            <div className="grid items-center gap-5 sm:grid-cols-[minmax(0,13rem)_1fr]">
              <DonutChartPlot className="max-w-52">
                <DonutChartCenter>
                  {(segment, sum) => (
                    <div className="flex flex-col items-center gap-0.5 text-center">
                      <span className="font-display text-[28px] font-bold leading-none">{formatUsd(Math.round(segment?.value ?? sum))}</span>
                      <span className="text-[12px] leading-tight text-ink-soft">{segment ? `${segment.name} · ${pct(segment.share)}` : "Total"}</span>
                    </div>
                  )}
                </DonutChartCenter>
              </DonutChartPlot>
              <DonutChartLegend
                className="space-y-0.5"
                renderValue={(s) => (
                  <>
                    <span className="font-semibold">{formatUsd(Math.round(s.value))}</span>
                    <span className="ml-2 text-ink-soft">{pct(s.share)}</span>
                  </>
                )}
              />
            </div>
          </DonutChart>
          <table className="w-full border-collapse text-[14px]">
            <caption className="sr-only">Ingresos por tour</caption>
            <thead>
              <tr className="border-b border-border text-left text-[12px] text-ink-soft">
                <th className="py-1.5 font-semibold">Tour</th>
                <th className="py-1.5 text-right font-semibold">Cobrado</th>
                <th className="py-1.5 text-right font-semibold">Esperado</th>
                <th className="py-1.5 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {tours.map((t) => (
                <tr
                  key={t.id}
                  className={cn("border-b border-border/60 transition-colors duration-150", (active === t.id || (active === "otros" && !top.some((x) => x.id === t.id))) && "bg-ink/8")}
                  onPointerEnter={() => setActive(top.some((x) => x.id === t.id) ? t.id : "otros")}
                  onPointerLeave={() => setActive(null)}
                >
                  <td className="py-1.5 font-semibold">{t.name}</td>
                  <td className="py-1.5 text-right tabular">{formatUsd(Math.round(t.cobrado))}</td>
                  <td className="py-1.5 text-right tabular">{formatUsd(Math.round(t.esperado))}</td>
                  <td className="py-1.5 text-right font-semibold tabular">{formatUsd(Math.round(t.total))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>Sin ingresos en este período.</Empty>
      )}
    </section>
  );
}
