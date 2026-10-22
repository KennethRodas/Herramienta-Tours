"use client";

import { useState } from "react";
import { RangeSlider } from "@/components/motion/range-slider";
import { Switch } from "@/components/motion/switch";
import { useSettings, useSimState } from "@/lib/sim/hooks";
import { sim } from "@/lib/sim/store";
import { cn } from "@/lib/utils";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="text-[16px] leading-snug">{label}</span>
      {children}
    </div>
  );
}

export function SimSettingsPanel({ className }: { className?: string }) {
  const settings = useSettings();
  const state = useSimState();
  const [seed, setSeed] = useState("");
  if (!settings) return <div className={cn("h-64 rounded-ticket bg-cobalt-900", className)} />;

  const exportJson = () => {
    if (!state) return;
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `wilber-simulacion-${state.seed}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className={cn("font-sans", className)}>
      <div className="pb-4">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-[16px]">Visitantes simulados</span>
          <span className="font-display text-2xl font-semibold tabular">{settings.trafficPerHour}/h</span>
        </div>
        <RangeSlider
          min={0}
          max={60}
          step={5}
          value={settings.trafficPerHour}
          onValueChange={(v) => void sim.updateSettings({ trafficPerHour: v })}
          aria-label="Reservas simuladas por hora"
          formatValueText={(v) => `${v} reservas por hora simulada`}
        />
        <p className="mt-2 text-[13px] text-cobalt-300">Reservas por hora de reloj simulado.</p>
      </div>
      <Row label="Mensajes automáticos">
        <Switch checked={settings.autoMessages} onCheckedChange={(v) => void sim.updateSettings({ autoMessages: v })} ariaLabel="Mensajes automáticos" />
      </Row>
      <Row label="Anticipo en línea (Wompi simulado)">
        <Switch checked={settings.onlineDeposit} onCheckedChange={(v) => void sim.updateSettings({ onlineDeposit: v })} ariaLabel="Anticipo en línea" />
      </Row>
      <Row label="Pagos aprobados">
        <Switch
          checked={settings.wompiOutcome === "aprobar"}
          onCheckedChange={(v) => void sim.updateSettings({ wompiOutcome: v ? "aprobar" : "rechazar" })}
          ariaLabel="Aprobar pagos simulados"
        />
      </Row>
      <Row label="Falla el envío de confirmaciones">
        <Switch checked={settings.failConfirmations} onCheckedChange={(v) => void sim.updateSettings({ failConfirmations: v })} ariaLabel="Falla de confirmaciones" />
      </Row>
      <Row label="Catálogo vacío">
        <Switch checked={settings.catalogEmpty} onCheckedChange={(v) => void sim.updateSettings({ catalogEmpty: v })} ariaLabel="Catálogo vacío" />
      </Row>

      <div className="mt-4 space-y-2 rounded-ticket bg-cobalt-900 p-4">
        <p className="text-[15px]">
          Semilla actual <span className="font-semibold tabular">{state?.seed}</span>. La misma semilla genera el mismo mundo.
        </p>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void sim.reset(seed ? Number(seed.replace(/\D/g, "")) : undefined);
            setSeed("");
          }}
        >
          <input
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            inputMode="numeric"
            placeholder="Semilla (opcional)"
            aria-label="Semilla"
            className="h-10 min-w-0 flex-1 rounded-full bg-cobalt-800 px-4 text-[16px] text-sand-50 placeholder:text-cobalt-300"
          />
          <button type="submit" className="pressable h-10 rounded-full bg-sand-100 px-4 text-[15px] font-semibold text-cobalt-800 hover:bg-sand-50">
            Reiniciar
          </button>
        </form>
        <button type="button" onClick={exportJson} className="pressable text-[15px] font-semibold underline underline-offset-4">
          Descargar estado en JSON
        </button>
      </div>
    </div>
  );
}
