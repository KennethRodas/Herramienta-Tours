"use client";

import { useEffect, useState } from "react";
import type { Tour } from "@/lib/domain/types";
import { DAY, formatTime, svDateKey } from "@/lib/domain/format";
import { fetchForecast, simForecast } from "@/lib/domain/weather";

// Weather for the day of the tour, where the walk is (not the meeting point).
// Open-Meteo has 16 days of forecast: closer than 15 days we ask it; further
// out, or offline, the line is the simulated estimate and says so.

type Real = NonNullable<Awaited<ReturnType<typeof fetchForecast>>>;

export function WeatherLine({ tour, startsAt }: { tour: Tour; startsAt: string }) {
  const [result, setResult] = useState<{ for: string; data: Real | null } | null>(null);
  const [lng, lat] = tour.route.camera.center;

  useEffect(() => {
    let alive = true;
    const run = async () => {
      await Promise.resolve();
      const ahead = Date.parse(startsAt) - Date.now();
      const data = ahead <= 15 * DAY && ahead >= -DAY ? await fetchForecast(lat, lng, svDateKey(startsAt)) : null;
      if (alive) setResult({ for: startsAt, data });
    };
    void run();
    return () => {
      alive = false;
    };
  }, [lat, lng, startsAt]);

  if (!result || result.for !== startsAt) {
    return <p className="bk-skeleton h-6 w-3/4 bg-sand-300" aria-label="Cargando pronóstico" />;
  }
  const real = result.data;
  if (real) {
    const parts = [
      `${real.tempMin}–${real.tempMax} °C`,
      real.rainChance === null ? null : `${real.rainChance} % de lluvia`,
      `viento ${real.windKmh} km/h`,
      // "a. m." already closes the sentence with its own period.
      real.sunrise ? `sale el sol a las ${formatTime(`${real.sunrise}:00-06:00`)}` : null,
    ].filter(Boolean);
    const sentence = parts.join(", ");
    return (
      <p className="text-body leading-snug">
        <span className="font-semibold">Pronóstico:</span>{" "}
        <span className="tabular">{sentence.endsWith(".") ? sentence : `${sentence}.`}</span>
        <span className="mt-1 block text-small text-ink-soft">Open-Meteo, en {tour.route.waypoints[0]?.name ?? tour.region}.</span>
      </p>
    );
  }
  const sim = simForecast(tour, startsAt);
  return (
    <p className="text-body leading-snug">
      <span className="font-semibold">Clima estimado:</span> <span className="tabular">{sim.summary}</span>
    </p>
  );
}
