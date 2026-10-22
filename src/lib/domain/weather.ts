import type { Tour } from "./types";
import { svParts } from "./format";

// A believable, deterministic forecast used inside the simulation (WhatsApp
// reminders, the ticket page fallback). The UI can ask Open-Meteo for the real one.

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1000) / 1000;
};

export interface SimForecast {
  tempMin: number;
  tempMax: number;
  rainChance: number;
  wind: "calma" | "suave" | "fuerte";
  summary: string;
}

export function simForecast(tour: Pick<Tour, "maxAltitudeM" | "slug">, at: number | string): SimForecast {
  const p = svParts(at);
  const rainy = p.month >= 5 && p.month <= 10;
  const jitter = hash(`${tour.slug}-${p.year}-${p.month}-${p.day}`);
  const lapse = (tour.maxAltitudeM / 1000) * 6.5;
  const tempMax = Math.round(31 - lapse + jitter * 3);
  const tempMin = Math.round(tempMax - 7 - jitter * 3);
  const morning = p.hour < 11;
  const rainChance = Math.round((rainy ? (morning ? 15 : 55) : 4) + jitter * (rainy ? 25 : 8));
  const wind = tour.maxAltitudeM > 1800 ? (jitter > 0.6 ? "fuerte" : "suave") : jitter > 0.8 ? "suave" : "calma";
  const rainText = rainChance >= 50 ? `${rainChance} % de lluvia, sobre todo por la tarde` : `${rainChance} % de lluvia`;
  return {
    tempMin,
    tempMax,
    rainChance,
    wind,
    summary: `${tempMin} °C al salir y ${tempMax} °C al mediodía, viento ${wind}, ${rainText}.`,
  };
}

/** Real forecast from Open-Meteo (free, no key). Returns null when offline or out of range. */
export async function fetchForecast(lat: number, lng: number, dateKey: string) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,sunrise,sunset&timezone=America%2FEl_Salvador&start_date=${dateKey}&end_date=${dateKey}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const j = await res.json();
    const d = j?.daily;
    if (!d?.time?.length) return null;
    return {
      tempMax: Math.round(d.temperature_2m_max[0]),
      tempMin: Math.round(d.temperature_2m_min[0]),
      rainChance: d.precipitation_probability_max?.[0] ?? null,
      windKmh: Math.round(d.wind_speed_10m_max?.[0] ?? 0),
      sunrise: d.sunrise?.[0] as string | undefined,
      sunset: d.sunset?.[0] as string | undefined,
    };
  } catch {
    return null;
  }
}
