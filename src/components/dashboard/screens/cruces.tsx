"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronRight, Wrench } from "lucide-react";
import { toast } from "sonner";
import { AnimatedNumber } from "@/components/motion/animated-number";
import { CONFLICT_KIND_LABEL } from "@/lib/domain/conflicts";
import type { Conflict } from "@/lib/domain/types";
import { formatUsd, plural } from "@/lib/domain/format";
import { EASE_OUT } from "@/lib/ease";
import { useConflicts, useNow, useStats } from "@/lib/sim/hooks";
import { sim } from "@/lib/sim/store";
import { cn } from "@/lib/utils";
import { useDash } from "../context";
import { useIndex, useIsDesktop } from "../hooks";
import { ResourceTimeline } from "../resource-timeline";
import { ActionButton, Empty, SectionTitle, Stamp, Stat, useAsyncAction } from "../ui";

export function CrucesScreen() {
  const idx = useIndex();
  const now = useNow(15_000);
  const conflicts = useConflicts();
  const stats = useStats();
  const desktop = useIsDesktop();
  const reduce = useReducedMotion();
  const { open } = useDash();
  const [allState, runAll] = useAsyncAction();

  if (!idx || now === null || !conflicts || !stats) return <div className="h-[520px] animate-pulse bg-paper" aria-busy="true" />;

  const risk = conflicts.reduce((n, c) => n + c.costRiskUsd, 0);
  const fixable = conflicts.filter((c) => c.fix);
  const crossed = new Set(conflicts.flatMap((c) => c.departureIds));

  const fixAll = () =>
    runAll(async () => {
      let saved = 0;
      let count = 0;
      for (const c of fixable) {
        const ok = await sim.applyFix(c.id);
        if (ok) {
          saved += c.costRiskUsd;
          count++;
        }
      }
      if (!count) throw new Error("nada");
      toast.success(`${plural(count, "cruce arreglado", "cruces arreglados")} · ${formatUsd(saved)} protegidos`);
    });

  return (
    <div className="flex flex-col gap-8">
      <section className="grid grid-cols-2 gap-1.5 lg:grid-cols-3" aria-label="Resumen">
        <Stat
          label="Cruces ahora"
          tone={conflicts.length ? "stamp" : "ink"}
          value={conflicts.length}
          detail={conflicts.length ? `${formatUsd(risk)} en riesgo` : "Próximos 21 días"}
          className="col-span-2 lg:col-span-1"
        />
        <Stat label="Resueltos" value={<AnimatedNumber value={stats.conflictsResolved} duration={0.8} startOnView={false} />} />
        <Stat
          label="Dinero protegido"
          value={<AnimatedNumber value={stats.moneyProtectedUsd} duration={1} startOnView={false} format={(n) => formatUsd(Math.round(n))} />}
          detail="Guía $60 · transporte $120"
        />
      </section>

      <section aria-labelledby="lista-cruces">
        <SectionTitle
          id="lista-cruces"
          aside={
            fixable.length > 1 ? (
              <ActionButton
                state={allState}
                variant="stamp"
                size="sm"
                icon={<Wrench className="size-4" />}
                onClick={() => void fixAll()}
                loadingText="Arreglando"
                successText="Arreglados"
                errorText="Ya no hay arreglos"
              >
                {`Arreglar ${fixable.length}`}
              </ActionButton>
            ) : undefined
          }
        >
          Cruces
        </SectionTitle>
        <ul className="flex flex-col gap-1.5">
          <AnimatePresence initial={false} mode="popLayout">
            {conflicts.map((c) => (
              <motion.li
                key={c.id}
                layout={!reduce}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, x: 40, transition: { duration: 0.22, ease: EASE_OUT } }}
                transition={{ duration: 0.24, ease: EASE_OUT }}
              >
                <ConflictCard c={c} refs={idx.refs} onOpen={(id) => open({ kind: "departure", id })} />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
        {!conflicts.length ? <Empty>Sin cruces en los próximos 21 días.</Empty> : null}
      </section>

      <section aria-labelledby="tablero">
        <SectionTitle id="tablero" aside="14 días · barra clara: traslado de 1.5 h">
          Guías y vehículos
        </SectionTitle>
        <ResourceTimeline
          departures={idx.s.departures}
          tours={idx.tourById}
          refs={idx.refs}
          now={now}
          crossed={crossed}
          onOpen={(id) => open({ kind: "departure", id })}
          dayWidth={desktop ? 104 : 84}
        />
      </section>
    </div>
  );
}

function ConflictCard({ c, refs, onOpen }: { c: Conflict; refs: Map<string, string>; onOpen: (id: string) => void }) {
  const [state, run] = useAsyncAction();
  const fix = () =>
    run(async () => {
      const ok = await sim.applyFix(c.id);
      if (!ok) {
        toast.error("Ese cruce cambió. Revisalo de nuevo.");
        throw new Error("cambió");
      }
      toast.success(`${c.fix?.label} · ${formatUsd(c.costRiskUsd)} protegidos`);
    });
  return (
    <div className="relative flex flex-col gap-3 bg-paper py-4 pr-4 pl-5 text-paper-ink sm:pr-5 sm:pl-6">
      <span aria-hidden className={cn("absolute inset-y-0 left-0 w-1.5", c.severity === "alta" ? "bg-destructive" : "bg-destructive/40")} />
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <Stamp tilt={false} className="text-[13px]">
          {CONFLICT_KIND_LABEL[c.kind]}
        </Stamp>
        <span className={cn("text-[15px] font-bold tabular", c.costRiskUsd ? "text-destructive" : "text-ink-soft")}>
          {c.costRiskUsd ? `${formatUsd(c.costRiskUsd)} en riesgo` : "Riesgo de seguridad"}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="text-[19px] font-bold leading-tight">{c.title}</h3>
        <p className="text-[15px] leading-snug text-ink-soft">{c.detail}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {c.departureIds.map((id) => (
          <button key={id} type="button" onClick={() => onOpen(id)} className="pressable inline-flex h-9 items-center gap-1 bg-ink/8 px-3 font-display text-[16px] font-bold uppercase hover:bg-ink/14">
            {refs.get(id) ?? "Salida"} <ChevronRight className="size-4" aria-hidden />
          </button>
        ))}
        {c.fix ? (
          <ActionButton state={state} variant="stamp" size="sm" className="ml-auto" onClick={() => void fix()} loadingText="Arreglando" successText="Arreglado" errorText="Cambió">
            {c.fix.label}
          </ActionButton>
        ) : (
          <span className="ml-auto text-[13px] font-medium text-ink-soft">Sin arreglo automático: cambiá la hora o el recurso.</span>
        )}
      </div>
    </div>
  );
}
