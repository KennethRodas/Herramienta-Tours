"use client";

import { useMemo } from "react";
import { Switch } from "@/components/motion/switch";
import { WhatsAppPhone } from "@/components/whatsapp/phone";
import { RealWhatsAppPanel } from "@/components/whatsapp/real-panel";
import { useMessages, useNow, useSettings } from "@/lib/sim/hooks";
import { sim } from "@/lib/sim/store";
import { BUSINESS } from "@/content/catalog";

// Wilber runs the business from WhatsApp: this is his chat with the
// business number's bot, plus the automatic messages it sends for him.

const COMMANDS: [string, string][] = [
  ["hoy · mañana", "Salidas del día con cupos, guía y vehículo"],
  ["semana", "Próximos 7 días"],
  ["lista SA24", "Quién va en una salida"],
  ["cupos santa ana", "Disponibilidad por tour"],
  ["WIL-7K2Q", "Datos de una reserva"],
  ["llegó WIL-7K2Q", "Marcar llegada"],
  ["cerrar SA24 · abrir SA24", "Cerrar o abrir la venta en línea"],
  ["cruces · arreglar 1", "Guías o vehículos encimados y su arreglo"],
  ["caja", "Cobrado y por cobrar"],
];

const AUTOMATIONS: [string, string, string][] = [
  ["Confirmación con boleto", "Al reservar", "Cliente"],
  ["Recordatorio con clima y qué llevar", "24 h antes", "Cliente"],
  ["Ubicación del punto de encuentro", "2 h antes", "Cliente"],
  ["Pedido de calificación", "3 h después", "Cliente"],
  ["Nueva reserva", "Al reservar", "Wilber"],
  ["Cruce detectado", "Al aparecer", "Wilber"],
  ["Resumen de mañana", "6:00 p. m.", "Wilber"],
];

export default function WilberWhatsAppPage() {
  const settings = useSettings();
  const now = useNow(2000);
  const wilber = settings?.wilberPhone ?? BUSINESS.whatsapp;
  const all = useMessages((m) => m.channel === "whatsapp");
  const messages = useMemo(() => (all ?? []).filter((m) => m.from === wilber || m.to === wilber), [all, wilber]);

  return (
    <div className="grid gap-8 pb-28 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] lg:pb-10">
      <div className="h-[min(720px,calc(100dvh-180px))] min-h-[480px] lg:h-[720px]">
        <WhatsAppPhone
          variant="panel"
          className="rounded-[28px]"
          title="Asistente de reservas"
          subtitle={`Número del negocio · ${BUSINESS.whatsappDisplay}`}
          messages={messages}
          owner={wilber}
          now={now}
          onSend={(t) => void sim.wilberSays(t)}
          suggestions={["Hoy", "Mañana", "Semana", "Cruces", "Caja", "Reservas", "Cupos", "Menu"]}
          placeholder="Escribí un comando"
          emptyText="Escribí «hoy» para ver las salidas del día."
        />
      </div>

      <div className="space-y-10 font-sans">
        <section>
          <h2 className="mb-3 font-display text-3xl font-semibold">Comandos</h2>
          <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
            {COMMANDS.map(([cmd, what]) => (
              <div key={cmd} className="contents">
                <dt className="font-semibold">
                  <button type="button" className="pressable text-left underline-offset-4 hover:underline" onClick={() => void sim.wilberSays(cmd.split(" · ")[0])}>
                    {cmd}
                  </button>
                </dt>
                <dd className="text-ink-soft">{what}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between gap-4">
            <h2 className="font-display text-3xl font-semibold">Mensajes automáticos</h2>
            <Switch
              checked={Boolean(settings?.autoMessages)}
              onCheckedChange={(v: boolean) => void sim.updateSettings({ autoMessages: v })}
              ariaLabel="Mensajes automáticos"
            />
          </div>
          <table className="w-full text-left text-[16px]">
            <thead className="text-sm text-ink-soft">
              <tr>
                <th className="pb-2 font-semibold">Mensaje</th>
                <th className="pb-2 font-semibold">Cuándo</th>
                <th className="pb-2 font-semibold">Para</th>
              </tr>
            </thead>
            <tbody>
              {AUTOMATIONS.map(([what, when, who]) => (
                <tr key={what} className="even:bg-surface/60">
                  <td className="py-1.5 pr-3">{what}</td>
                  <td className="py-1.5 pr-3 tabular">{when}</td>
                  <td className="py-1.5">{who}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <RealWhatsAppPanel className="max-w-xl" />
      </div>
    </div>
  );
}
