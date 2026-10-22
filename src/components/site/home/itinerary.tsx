import type { CSSProperties } from "react";
import { meetingPointById, tourById } from "@/content/catalog";
import { formatDuration, formatUsd } from "@/lib/domain/format";
import type { ItineraryStep } from "@/lib/domain/types";
import { Reveal } from "../reveal";

// Preparación: a typical day printed as an itinerary slip with a zigzag tear,
// next to what the price includes, what to bring and when to arrive.
// The day is Wilber's most-run tour, Volcán de Santa Ana, read from the catalog.

const WEEKDAY_PLURAL = ["domingos", "lunes", "martes", "miércoles", "jueves", "viernes", "sábados"];
const MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0];
const LIST = new Intl.ListFormat("es", { style: "long", type: "conjunction" });

function period(time: string) {
  const hour = Number(time.slice(0, 2));
  if (hour < 6) return "Madrugada";
  if (hour < 12) return "Mañana";
  return "Tarde";
}

function minusMinutes(hhmm: string, minutes: number) {
  const [h, m] = hhmm.split(":").map(Number);
  const total = (h * 60 + m - minutes + 24 * 60) % (24 * 60);
  const hour = Math.floor(total / 60);
  const minute = String(total % 60).padStart(2, "0"); // taste-skill-ignore: minutes of a clock time
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${minute} ${hour < 12 ? "a. m." : "p. m."}`;
}

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

export function Itinerary() {
  const tour = tourById("t-santa-ana")!;
  const meeting = meetingPointById(tour.meetingPointId);
  const steps = tour.itinerary.slice(0, -1);
  const last = tour.itinerary[tour.itinerary.length - 1];
  const groups: { label: string; items: ItineraryStep[] }[] = [];
  for (const step of steps) {
    const label = period(step.time);
    const group = groups.find((g) => g.label === label);
    if (group) group.items.push(step);
    else groups.push({ label, items: [step] });
  }
  const days = MONDAY_FIRST.filter((d) => tour.weekdays.includes(d)).map((d) => WEEKDAY_PLURAL[d]);
  const daysLine = LIST.format(days);

  return (
    <Reveal id="preparacion" aria-labelledby="preparacion-titulo" className="ink-night bg-cobalt-600 text-sand-50">
      <div className="mx-auto grid max-w-[1760px] gap-y-14 px-[var(--gutter)] py-[var(--section-gap)] lg:grid-cols-12 lg:gap-x-8">
        <div className="lg:col-span-5">
          <h2 id="preparacion-titulo" data-reveal className="font-display text-head font-bold uppercase leading-[0.92]">
            Un día de salida
          </h2>
          <p data-reveal className="mt-7 max-w-[36ch] text-body leading-snug">
            {tour.name}, {formatUsd(tour.priceUsd)} por persona. Incluye {tour.includes.map(lowerFirst).join(", ")}.
          </p>
          <h3 data-reveal className="mt-10 font-display text-lead font-bold uppercase leading-none">
            Qué llevar
          </h3>
          <ul data-reveal className="mt-4 flex max-w-[36ch] flex-col gap-1.5 text-body leading-snug">
            {tour.bring.map((item) => (
              <li key={item} className="flex gap-3">
                <span aria-hidden className="mt-[0.55em] size-1.5 shrink-0 bg-sand-50" />
                {item}
              </li>
            ))}
          </ul>
          <p data-reveal className="mt-8 max-w-[36ch] text-body font-semibold leading-snug">
            Llegá al {meeting?.name ?? "punto de encuentro"} a las {minusMinutes(tour.departureTime, tour.arriveMinutesBefore)}
          </p>
        </div>

        <div className="flex justify-center lg:col-span-5 lg:col-start-8 lg:justify-start">
          <div
            data-reveal="slip"
            className="ink-paper edge-zigzag-b w-full max-w-[480px] bg-sand-50 pb-8 text-ink"
            style={{ ["--z" as string]: "18px" } as CSSProperties}
          >
            <div className="px-6 pt-8 pb-5 text-center sm:px-8">
              <p className="font-display text-lead font-bold uppercase leading-none">{tour.name}</p>
              <p className="mt-2 text-small">
                {daysLine.charAt(0).toUpperCase() + daysLine.slice(1)}, desde el {meeting?.name}
              </p>
            </div>
            <div aria-hidden className="perforation-x" style={{ ["--perf" as string]: "var(--cobalt-600)" } as CSSProperties} />
            <div className="px-6 pt-1 pb-7 sm:px-8">
              {groups.map((g) => (
                <div key={g.label} className="mt-6">
                  <p className="text-[17px] font-bold">{g.label}</p>
                  <ul className="mt-2 flex flex-col gap-2 text-[17px] leading-snug">
                    {g.items.map((s) => (
                      <li key={s.time} className="flex items-baseline">
                        <span>{s.label}</span>
                        <span aria-hidden className="dot-leader" />
                        <span className="tabular">{s.time}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="flex h-11 items-center justify-between bg-cobalt-800 px-6 text-[17px] font-semibold text-sand-50 sm:px-8">
              <span>Regreso {last.time}</span>
              <span className="tabular">{formatDuration(tour.durationHours)}</span>
            </div>
          </div>
        </div>
      </div>
    </Reveal>
  );
}
