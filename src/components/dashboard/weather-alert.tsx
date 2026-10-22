"use client";

import { useState } from "react";
import { toast } from "sonner";
import { WaText } from "@/components/whatsapp/wa-text";
import { DAY, formatDayShort, formatTime, plural } from "@/lib/domain/format";
import { useDepartures, useNow } from "@/lib/sim/hooks";
import { sim } from "@/lib/sim/store";
import * as wa from "@/lib/whatsapp/templates";
import { cn } from "@/lib/utils";
import { useDash } from "./context";
import { useIndex } from "./hooks";
import { isLive } from "./lib";
import { SheetHeader } from "./overlay-host";
import { ActionButton, Empty, FieldLabel, inputClass, useAsyncAction } from "./ui";
import { forecastText, useForecast } from "./weather";

/** Weather warning to every group of a departure, by WhatsApp, with a button to change the date. */
export function WeatherAlertForm({ departureId }: { departureId?: string }) {
  const idx = useIndex();
  const now = useNow(30_000);
  const deps = useDepartures();
  const { close } = useDash();
  const [state, run] = useAsyncAction();
  const [selected, setSelected] = useState<string | undefined>(departureId);
  const [edited, setEdited] = useState<{ id: string; text: string } | null>(null);

  const candidates =
    deps && now !== null
      ? deps.filter((d) => d.status !== "cancelada" && Date.parse(d.startsAt) > now && Date.parse(d.startsAt) < now + 5 * DAY && d.seatsTaken > 0).slice(0, 8)
      : [];
  const chosen = (selected ? deps?.find((d) => d.id === selected) : undefined) ?? candidates[0];
  const tour = chosen && idx ? idx.tourById.get(chosen.tourId) : undefined;
  const forecast = useForecast(tour, chosen?.startsAt);

  if (!idx || now === null || !deps) {
    return (
      <>
        <SheetHeader title="Aviso de clima" />
        <div className="h-40 rounded-ticket bg-ink/5" />
      </>
    );
  }
  if (!chosen || !tour) {
    return (
      <>
        <SheetHeader title="Aviso de clima" />
        <Empty>No hay salidas con gente en los próximos 5 días.</Empty>
      </>
    );
  }

  const groups = (idx.byDeparture.get(chosen.id) ?? []).filter(isLive);
  const people = groups.reduce((n, b) => n + b.partySize, 0);
  const suggested = forecast ? `Pronóstico en ${tour.shortName}: ${forecastText(forecast)}.` : "";
  const detail = edited?.id === chosen.id ? edited.text : suggested;
  const sample = groups[0];
  const preview = sample ? wa.weatherAlert(sample, chosen, tour, detail || "…") : null;

  const send = () =>
    run(async () => {
      const text = detail.trim();
      if (!text) throw new Error("vacío");
      const sent = await sim.weatherAlert(chosen.id, text);
      if (!sent) throw new Error("sin grupos");
      toast.success(`Aviso enviado a ${plural(sent, "grupo", "grupos")} · ${plural(people, "persona", "personas")}`);
      window.setTimeout(close, 600);
    });

  return (
    <div className="flex flex-col gap-5">
      <SheetHeader title="Aviso de clima" />

      <section className="flex flex-col gap-2">
        <FieldLabel>Salida</FieldLabel>
        <div
          className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
          role="radiogroup"
          aria-label="Salida"
        >
          {candidates.map((d) => {
            const on = d.id === chosen.id;
            const t = idx.tourById.get(d.tourId);
            return (
              <button
                key={d.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setSelected(d.id)}
                className={cn(
                  "pressable flex shrink-0 flex-col items-start rounded-field px-3.5 py-2 text-left whitespace-nowrap transition-colors duration-150",
                  on ? "bg-ink text-paper" : "bg-ink/8 text-ink hover:bg-ink/14",
                )}
              >
                <span className="text-[15px] font-semibold">
                  {idx.refs.get(d.id)} · {t?.shortName}
                </span>
                <span className={cn("text-[13px]", on ? "text-paper/80" : "text-ink-soft")}>
                  {formatDayShort(d.startsAt)} {formatTime(d.startsAt)} · {d.seatsTaken} pers.
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <FieldLabel htmlFor="aviso-texto" hint={forecast ? `Fuente: ${forecast.source}` : "Cargando pronóstico"}>
          Mensaje
        </FieldLabel>
        <textarea
          id="aviso-texto"
          rows={3}
          maxLength={300}
          value={detail}
          onChange={(e) => setEdited({ id: chosen.id, text: e.target.value })}
          className={cn(inputClass, "h-auto min-h-[96px] resize-y py-3 leading-snug")}
        />
      </section>

      {preview ? (
        <section className="flex flex-col gap-2">
          <FieldLabel>Así lo recibe cada grupo</FieldLabel>
          <div className="max-w-[340px] self-start rounded-field rounded-tl-stub bg-ink/8 px-3.5 py-2.5 text-[15px] leading-snug text-ink">
            <WaText text={preview.body} />
            {preview.buttons?.length ? (
              <div className="mt-2 flex flex-col gap-1">
                {preview.buttons.map((label) => (
                  <span key={label} className="rounded-full bg-paper/70 py-1.5 text-center text-[14px] font-semibold text-ink">
                    {label}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <div className="sticky bottom-0 z-10 -mx-4 bg-paper px-4 pt-2 pb-[calc(env(safe-area-inset-bottom,0px)+8px)] lg:-mx-6 lg:px-6">
        <ActionButton state={state} size="lg" className="w-full" disabled={!detail.trim()} onClick={() => void send()} loadingText="Enviando" successText="Enviado" errorText="Escribí el mensaje">
          Enviar a {plural(groups.length, "grupo", "grupos")} · {plural(people, "persona", "personas")}
        </ActionButton>
      </div>
    </div>
  );
}
