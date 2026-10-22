"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { tourById } from "@/content/catalog";
import type { Route } from "@/lib/domain/types";
import { useSimState, useTours } from "@/lib/sim/hooks";
import { sim } from "@/lib/sim/store";
import { cn } from "@/lib/utils";
import { RouteEditor } from "./index";

// /wilber/rutas: pick a tour, edit its route, save it into the simulation as a
// tour override (the public maps read it from there).

function sameRoute(a: Route | undefined, b: Route | undefined) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function RouteAdmin() {
  const tours = useTours({ includeInactive: true });
  const state = useSimState();
  const [selectedId, setSelectedId] = useState(() => tours[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  // Restoring replaces the route under the editor: a new key starts it fresh.
  const [restored, setRestored] = useState(0);
  const tour = tours.find((t) => t.id === selectedId) ?? tours[0];

  const edited = (id: string) => {
    const override = state?.tourOverrides[id]?.route;
    return Boolean(override) && !sameRoute(override, tourById(id)?.route);
  };
  const editedCount = tours.filter((t) => edited(t.id)).length;

  const save = async (route: Route) => {
    if (!tour) return;
    setBusy(true);
    try {
      await sim.setTourOverride(tour.id, { route });
      toast.success(`Ruta guardada: ${tour.shortName}`);
    } catch {
      toast.error("No se pudo guardar la ruta. Intentá de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    const original = tour ? tourById(tour.id)?.route : undefined;
    if (!tour || !original) return;
    setBusy(true);
    try {
      await sim.setTourOverride(tour.id, { route: original });
      setRestored((n) => n + 1);
      toast.success(`Ruta original restaurada: ${tour.shortName}`);
    } catch {
      toast.error("No se pudo restaurar la ruta. Intentá de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <p className="text-small text-muted-foreground tabular">
          {tours.length} aventuras · {state ? `${editedCount} con ruta editada` : "…"}
        </p>
        <nav aria-label="Aventuras" className="min-w-0">
          <ul className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {tours.map((t) => {
              const on = t.id === tour?.id;
              const mark = state ? edited(t.id) : false;
              return (
                <li key={t.id} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => setSelectedId(t.id)}
                    aria-current={on ? "true" : undefined}
                    className={cn(
                      "pressable flex h-12 items-center gap-2 rounded-full px-4 text-left focus-visible:outline-2 focus-visible:-outline-offset-2",
                      on ? "bg-primary text-primary-foreground" : "bg-muted text-foreground hover:bg-accent",
                    )}
                  >
                    <span className="flex flex-col">
                      <span className="whitespace-nowrap text-[15px] font-semibold leading-tight">{t.shortName}</span>
                      <span className={cn("whitespace-nowrap text-[13px] leading-tight", on ? "opacity-80" : "text-muted-foreground")}>
                        {t.region}
                        {t.active ? "" : " · inactiva"}
                      </span>
                    </span>
                    {mark ? (
                      <span
                        className={cn(
                          "shrink-0 rounded-stub px-1.5 py-0.5 text-[13px] font-semibold",
                          on ? "bg-primary-foreground text-primary" : "bg-primary text-primary-foreground",
                        )}
                      >
                        Editada
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      <section aria-label={tour ? `Ruta de ${tour.name}` : "Ruta"} className="flex min-w-0 flex-col gap-3">
        {tour ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-lead font-semibold">{tour.name}</h2>
              {state && edited(tour.id) ? (
                <button
                  type="button"
                  onClick={restore}
                  disabled={busy}
                  className="pressable inline-flex h-10 items-center gap-2 rounded-full bg-muted pl-3.5 pr-4 text-[15px] font-semibold text-foreground hover:bg-accent disabled:opacity-45"
                >
                  <RotateCcw size={16} strokeWidth={2.25} aria-hidden />
                  Restaurar ruta original
                </button>
              ) : null}
            </div>
            {state ? (
              <RouteEditor key={`${tour.id}:${restored}`} tour={tour} onSave={save} />
            ) : (
              <div className="h-[640px] rounded-ticket bg-muted" role="status" aria-label="Cargando simulación" />
            )}
          </>
        ) : (
          <p className="text-body">No hay aventuras en el catálogo.</p>
        )}
      </section>
    </div>
  );
}
