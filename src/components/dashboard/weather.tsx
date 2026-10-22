"use client";

import { CloudRain, Sunrise, Thermometer, Wind } from "lucide-react";
import { useEffect, useState } from "react";
import type { Tour } from "@/lib/domain/types";
import { svDateKey } from "@/lib/domain/format";
import { fetchForecast, simForecast } from "@/lib/domain/weather";
import { cn } from "@/lib/utils";

export interface Forecast {
  tempMin: number;
  tempMax: number;
  rainChance: number | null;
  windKmh?: number;
  wind?: string;
  sunrise?: string;
  source: "Open-Meteo" | "Estimado";
}

const cache = new Map<string, Promise<Forecast>>();

/** Where the weather matters: the start of the trail, not the meeting point in the city. */
function trailPoint(tour: Tour) {
  const start = tour.route.waypoints.find((w) => w.kind === "inicio") ?? tour.route.waypoints[0];
  if (start) return { lat: start.lat, lng: start.lng };
  const [lng, lat] = tour.route.camera.center;
  return { lat, lng };
}

function load(tour: Tour, startsAt: string): Promise<Forecast> {
  const { lat, lng } = trailPoint(tour);
  const dateKey = svDateKey(startsAt);
  const key = `${lat.toFixed(3)},${lng.toFixed(3)},${dateKey}`;
  let hit = cache.get(key);
  if (!hit) {
    hit = fetchForecast(lat, lng, dateKey).then((real) => {
      if (real) {
        return {
          tempMin: real.tempMin,
          tempMax: real.tempMax,
          rainChance: real.rainChance,
          windKmh: real.windKmh,
          sunrise: real.sunrise?.slice(11, 16),
          source: "Open-Meteo" as const,
        };
      }
      const sim = simForecast(tour, startsAt);
      return { tempMin: sim.tempMin, tempMax: sim.tempMax, rainChance: sim.rainChance, wind: sim.wind, source: "Estimado" as const };
    });
    cache.set(key, hit);
  }
  return hit;
}

/** Real forecast for the trail (Open-Meteo), the simulated one when offline or out of range. */
export function useForecast(tour: Tour | undefined, startsAt: string | undefined) {
  const key = tour && startsAt ? `${tour.id}|${startsAt}` : "";
  const [state, setState] = useState<{ key: string; data: Forecast | null }>({ key: "", data: null });
  useEffect(() => {
    if (!tour || !startsAt) return;
    let alive = true;
    const k = `${tour.id}|${startsAt}`;
    void load(tour, startsAt).then((data) => {
      if (alive) setState((prev) => (prev.key === k && prev.data === data ? prev : { key: k, data }));
    });
    return () => {
      alive = false;
    };
  }, [tour, startsAt]);
  return state.key === key ? state.data : null;
}

export function forecastText(f: Forecast) {
  const parts = [`${f.tempMin}–${f.tempMax} °C`];
  if (f.rainChance !== null) parts.push(`${f.rainChance} % de lluvia`);
  if (f.windKmh !== undefined) parts.push(`viento ${f.windKmh} km/h`);
  else if (f.wind) parts.push(`viento ${f.wind}`);
  return parts.join(", ");
}

export function WeatherLine({ tour, startsAt, className }: { tour: Tour | undefined; startsAt: string | undefined; className?: string }) {
  const f = useForecast(tour, startsAt);
  if (!f) {
    return (
      <div className={cn("flex h-6 items-center gap-3 text-[14px] text-ink-soft", className)} aria-busy="true">
        <span className="h-3 w-40 rounded-full bg-ink/10" />
      </div>
    );
  }
  const wet = (f.rainChance ?? 0) >= 50;
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px] text-ink", className)}>
      <span className="inline-flex items-center gap-1.5 tabular">
        <Thermometer className="size-4 text-ink-soft" aria-hidden />
        {f.tempMin}–{f.tempMax} °C
      </span>
      {f.rainChance !== null ? (
        <span className={cn("inline-flex items-center gap-1.5 tabular", wet && "font-semibold text-destructive")}>
          <CloudRain className="size-4" aria-hidden />
          {f.rainChance} %
        </span>
      ) : null}
      <span className="inline-flex items-center gap-1.5 tabular">
        <Wind className="size-4 text-ink-soft" aria-hidden />
        {f.windKmh !== undefined ? `${f.windKmh} km/h` : f.wind}
      </span>
      {f.sunrise ? (
        <span className="inline-flex items-center gap-1.5 tabular">
          <Sunrise className="size-4 text-ink-soft" aria-hidden />
          {f.sunrise}
        </span>
      ) : null}
      <span className="text-[12px] text-ink-soft">{f.source}</span>
    </div>
  );
}
