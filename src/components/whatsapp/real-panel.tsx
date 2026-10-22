"use client";

import { useState } from "react";
import { Switch } from "@/components/motion/switch";
import { useSettings } from "@/lib/sim/hooks";
import { sim } from "@/lib/sim/store";
import { useIntegrations } from "@/components/sim/use-integrations";
import { cn } from "@/lib/utils";
import { useRealWhatsAppBridge } from "./use-real-bridge";

// Controls to push the simulation through the real WhatsApp (Kapso sandbox).
// Messages only ever go to the tester's number, never to simulated customers.

export function RealWhatsAppPanel({ className }: { className?: string }) {
  const settings = useSettings();
  const status = useIntegrations();
  const [bridge, setBridge] = useState(false);
  const { state, lastError } = useRealWhatsAppBridge(bridge && Boolean(status?.kapso));
  const [phone, setPhone] = useState<string | null>(null);
  const value = phone ?? settings?.testPhone ?? "";
  const kapso = status?.kapso ?? false;

  return (
    <section className={cn("space-y-4 font-sans", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-display text-2xl font-semibold">WhatsApp real</h3>
        <span className={cn("text-sm font-semibold", kapso ? "text-ink" : "text-stamp")}>
          {status === null ? "Revisando…" : kapso ? "Kapso conectado" : "Kapso sin configurar"}
        </span>
      </div>
      <ol className="list-decimal space-y-1 pl-5 text-[15px] leading-snug">
        <li>Agregá tu número a WHATSAPP_TEST_NUMBERS en las variables de Vercel.</li>
        <li>En Kapso: WhatsApp › Sandbox › Add Test Number. Mandá el código de 6 caracteres al número sandbox desde ese mismo WhatsApp (vence en 15 min).</li>
        <li>Escribí tu número aquí y encendé el envío.</li>
      </ol>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold">Número de prueba (con 503)</span>
        <input
          inputMode="tel"
          value={value}
          onChange={(e) => setPhone(e.target.value)}
          onBlur={() => phone !== null && void sim.updateSettings({ testPhone: phone.replace(/\D/g, "") })}
          placeholder="50370000000"
          className="h-11 w-full rounded-md bg-sand-50 px-3 text-[16px] text-cobalt-900 outline-none ring-cobalt-800 focus-visible:ring-2"
        />
      </label>
      <div className="flex items-center justify-between gap-4">
        <span className="text-[15px]">Enviar por WhatsApp real los avisos de Wilber y las reservas hechas con ese número</span>
        <Switch
          checked={Boolean(settings?.realWhatsApp)}
          disabled={!kapso || !value}
          onCheckedChange={(v: boolean) => void sim.updateSettings({ realWhatsApp: v, testPhone: value.replace(/\D/g, "") })}
          ariaLabel="Enviar por WhatsApp real"
        />
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-[15px]">Contestar con el bot lo que ese número escriba</span>
        <Switch checked={bridge} disabled={!kapso} onCheckedChange={(v: boolean) => setBridge(v)} ariaLabel="Responder mensajes reales" />
      </div>
      {bridge && (
        <p className={cn("text-sm", state === "error" ? "text-stamp" : "text-ink-soft")}>
          {state === "escuchando" ? "Escuchando mensajes cada 5 segundos." : state === "error" ? `Error: ${lastError}` : "Conectando…"}
        </p>
      )}
    </section>
  );
}
