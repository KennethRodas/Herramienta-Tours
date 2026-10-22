"use client";

import Link from "next/link";
import { useMemo } from "react";
import { LogoMark } from "@/components/brand/logo";
import { ClockBar } from "@/components/sim/clock-bar";
import { CriteriaList } from "@/components/sim/criteria";
import { EmailInbox } from "@/components/sim/email-inbox";
import { EventLog } from "@/components/sim/event-log";
import { SimMetrics } from "@/components/sim/metrics";
import { ScenarioList } from "@/components/sim/scenario-list";
import { SimSettingsPanel } from "@/components/sim/sim-settings";
import { VisitorPhone } from "@/components/sim/visitor-phone";
import { WhatsAppPhone } from "@/components/whatsapp/phone";
import { RealWhatsAppPanel } from "@/components/whatsapp/real-panel";
import { useMessages, useNow, useSettings } from "@/lib/sim/hooks";
import { sim } from "@/lib/sim/store";
import { BUSINESS } from "@/content/catalog";

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-4 font-display text-[2rem] font-semibold uppercase leading-none tracking-tight">{children}</h2>;
}

export default function SimuladorPage() {
  const settings = useSettings();
  const now = useNow(2000);
  const wilber = settings?.wilberPhone ?? BUSINESS.whatsapp;
  const all = useMessages((m) => m.channel === "whatsapp");
  const wilberMessages = useMemo(() => (all ?? []).filter((m) => m.from === wilber || m.to === wilber), [all, wilber]);

  return (
    <main className="mx-auto max-w-[1680px] px-[var(--gutter)] pb-24 pt-5 text-[16px]">
      <header className="mb-10 flex flex-wrap items-center justify-between gap-4 font-sans">
        <Link href="/" className="pressable flex items-center gap-3">
          <LogoMark className="size-10" paper="var(--sand-100)" ink="var(--cobalt-800)" />
          <span className="font-display text-[1.75rem] font-bold uppercase leading-none">Simulador</span>
        </Link>
        <nav className="flex flex-wrap gap-2 text-[15px] font-semibold">
          {[
            ["/", "Sitio"],
            ["/wilber", "Panel de Wilber"],
            ["/wilber/whatsapp", "WhatsApp de Wilber"],
            ["/aventuras", "Reservar como visitante"],
          ].map(([href, label]) => (
            <Link
              key={href}
              href={href}
              target="_blank"
              className="pressable rounded-full bg-cobalt-900 px-4 py-2 hover:bg-cobalt-700"
            >
              {label}
            </Link>
          ))}
        </nav>
      </header>

      <section className="mb-14">
        <ClockBar />
        <p className="mt-4 max-w-3xl font-sans text-[16px] text-cobalt-200">
          Todo corre en este navegador. Abrí el sitio y el panel en otras pestañas: reservas, cupos y mensajes se sincronizan entre ellas.
        </p>
      </section>

      <section className="mb-14">
        <H2>Criterios de aceptación</H2>
        <CriteriaList />
      </section>

      <div className="grid gap-12 xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)_minmax(0,380px)]">
        <div className="space-y-12">
          <section>
            <H2>Escenarios</H2>
            <ScenarioList />
          </section>
          <section>
            <H2>Ajustes</H2>
            <SimSettingsPanel />
          </section>
          <RealWhatsAppPanel className="rounded-ticket bg-cobalt-900 p-4" />
        </div>

        <div className="min-w-0 space-y-12">
          <section>
            <H2>Teléfonos</H2>
            <div className="grid justify-items-center gap-8 md:grid-cols-2">
              <VisitorPhone className="w-full max-w-[340px]" />
              <div className="flex w-full max-w-[340px] flex-col gap-3">
                <p className="font-sans text-[14px] font-semibold text-cobalt-200">Teléfono de Wilber</p>
                <WhatsAppPhone
                  title="Asistente de reservas"
                  subtitle="Comandos: hoy, semana, lista SA24, cruces"
                  messages={wilberMessages}
                  owner={wilber}
                  now={now}
                  onSend={(t) => void sim.wilberSays(t)}
                  suggestions={["Hoy", "Mañana", "Semana", "Cruces", "Caja", "Menu"]}
                  placeholder="Escribir como Wilber"
                  emptyText="Escribí «hoy»."
                  className="mt-[52px]"
                />
              </div>
            </div>
          </section>
          <section>
            <H2>Correos</H2>
            <EmailInbox className="h-[560px]" />
          </section>
        </div>

        <div className="space-y-12">
          <section>
            <H2>Números</H2>
            <SimMetrics />
          </section>
          <section className="flex h-[880px] flex-col">
            <H2>Registro</H2>
            <EventLog className="min-h-0 flex-1" />
          </section>
        </div>
      </div>
    </main>
  );
}
