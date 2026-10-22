"use client";

import { ArrowRight, FlaskConical, LogOut } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { OTPInput, type OTPStatus } from "@/components/motion/otp-input";
import { Switch } from "@/components/motion/switch";
import { BUSINESS } from "@/content/catalog";
import { useSettings } from "@/lib/sim/hooks";
import { sim } from "@/lib/sim/store";
import { cn } from "@/lib/utils";
import { THEME_LABEL, signOut, useEffectiveTheme, useThemeMode } from "../hooks";
import { ThemeChips } from "../nav";
import { Btn, SectionTitle, btn } from "../ui";

type Integrations = { supabase?: boolean; kapso?: boolean; resend?: boolean; wompi?: boolean; mode?: string };

function useEstado() {
  const [state, setState] = useState<{ status: "cargando" | "ok" | "sin-datos"; data?: Integrations }>({ status: "cargando" });
  useEffect(() => {
    let alive = true;
    fetch("/api/estado", { cache: "no-store" })
      .then(async (r) => (r.ok ? ((await r.json()) as Integrations) : null))
      .then((data) => alive && setState(data ? { status: "ok", data } : { status: "sin-datos" }))
      .catch(() => alive && setState({ status: "sin-datos" }));
    return () => {
      alive = false;
    };
  }, []);
  return state;
}

function Line({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_minmax(0,1fr)] items-baseline gap-3 py-2.5 sm:grid-cols-[160px_minmax(0,1fr)]">
      <dt className="text-[14px] font-medium text-ink-soft">{label}</dt>
      <dd className="min-w-0 text-[16px] text-ink">{children}</dd>
    </div>
  );
}

export function AjustesScreen() {
  const router = useRouter();
  const settings = useSettings();
  const estado = useEstado();
  const [mode] = useThemeMode();
  const effective = useEffectiveTheme();

  return (
    <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
      <div className="flex flex-col gap-8">
        <section aria-labelledby="negocio">
          <SectionTitle id="negocio">Negocio</SectionTitle>
          <dl className="bg-paper px-4 py-2 text-paper-ink">
            <Line label="Nombre">{BUSINESS.legalName}</Line>
            <Line label="WhatsApp">
              <span className="tabular">{BUSINESS.whatsappDisplay}</span>
            </Line>
            <Line label="Correo">
              <span className="break-all">{BUSINESS.email}</span>
            </Line>
            <Line label="Instagram">{BUSINESS.instagram}</Line>
            <Line label="Ciudad">{BUSINESS.city}</Line>
            <Line label="Horario">
              <span className="flex flex-col">
                {BUSINESS.hours.map((h) => (
                  <span key={h.days}>
                    {h.days}: <span className="tabular">{h.time}</span>
                  </span>
                ))}
              </span>
            </Line>
          </dl>
        </section>

        <section aria-labelledby="tema">
          <SectionTitle id="tema" aside={mode === "auto" && effective ? `Ahora: ${effective === "noche" ? "noche" : "día"}` : undefined}>
            Tema
          </SectionTitle>
          <div className="flex flex-col gap-2 bg-paper px-4 py-4 text-paper-ink">
            <ThemeChips />
            <p className="text-[14px] text-ink-soft">{mode === "auto" ? "Noche de 6:00 p. m. a 5:30 a. m., hora de El Salvador." : `Siempre ${THEME_LABEL[mode].toLowerCase()}.`}</p>
          </div>
        </section>

        <section aria-labelledby="mensajes">
          <SectionTitle id="mensajes">Mensajes automáticos</SectionTitle>
          <div className="flex items-center justify-between gap-4 bg-paper px-4 py-4 text-paper-ink">
            <div className="flex flex-col">
              <span className="text-[16px] font-semibold">{settings?.autoMessages ? "Activados" : "Apagados"}</span>
              <span className="text-[14px] text-ink-soft">Recordatorio 24 h, ubicación 2 h antes, reseña, resumen de las 6 p. m. y alertas de cruces.</span>
            </div>
            <Switch
              checked={Boolean(settings?.autoMessages)}
              disabled={!settings}
              ariaLabel="Mensajes automáticos"
              onCheckedChange={(v) => {
                void sim.updateSettings({ autoMessages: v }).then(() => toast(v ? "Mensajes automáticos activados" : "Mensajes automáticos apagados"));
              }}
            />
          </div>
        </section>
      </div>

      <div className="flex flex-col gap-8">
        <PinSection current={settings?.adminPin} />

        <section aria-labelledby="integraciones">
          <SectionTitle id="integraciones">Integraciones</SectionTitle>
          <ul className="flex flex-col bg-paper px-4 py-2 text-paper-ink">
            {(
              [
                ["supabase", "Supabase", "Base de datos"],
                ["kapso", "Kapso", "WhatsApp"],
                ["resend", "Resend", "Correo"],
                ["wompi", "Wompi", "Pagos en línea"],
              ] as const
            ).map(([key, name, role]) => {
              const on = estado.data?.[key];
              const label = estado.status === "cargando" ? "…" : estado.status === "sin-datos" ? "Sin datos" : on ? "Conectado" : "Simulación";
              return (
                <li key={key} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="flex flex-col">
                    <span className="text-[16px] font-semibold">{name}</span>
                    <span className="text-[13px] text-ink-soft">{role}</span>
                  </span>
                  <span
                    className={cn(
                      "inline-flex h-7 items-center px-2 text-[13px] font-semibold",
                      estado.status === "cargando" && "animate-pulse bg-ink/8 text-ink-soft",
                      estado.status === "sin-datos" && "bg-ink/5 text-ink-soft",
                      estado.status === "ok" && (on ? "bg-ink text-paper" : "bg-ink/10 text-ink"),
                    )}
                  >
                    {label}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <Link href="/simulador" className={cn(btn("quiet", "lg"), "justify-between")}>
            <span className="inline-flex items-center gap-2">
              <FlaskConical className="size-5" /> Simulador
            </span>
            <ArrowRight className="size-5" />
          </Link>
          <Btn
            variant="outline"
            size="lg"
            className="justify-between hover:bg-destructive/10 hover:text-destructive hover:ring-destructive/40"
            onClick={() => {
              signOut();
              toast("Sesión cerrada");
              router.replace("/wilber/entrar");
            }}
          >
            <span className="inline-flex items-center gap-2">
              <LogOut className="size-5" /> Salir
            </span>
          </Btn>
        </section>
      </div>
    </div>
  );
}

function PinSection({ current }: { current?: string }) {
  const [step, setStep] = useState<"nuevo" | "repetir">("nuevo");
  const [first, setFirst] = useState("");
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<OTPStatus>("idle");
  const [message, setMessage] = useState<string | undefined>(undefined);
  // Remounting the slots puts the caret back on the first digit after a reset.
  const [round, setRound] = useState(0);

  const reset = (delay: number) =>
    window.setTimeout(() => {
      setValue("");
      setStatus("idle");
      setRound((r) => r + 1);
    }, delay);

  const complete = (pin: string) => {
    if (step === "nuevo") {
      if (pin === current) {
        setMessage("Ese ya es tu PIN.");
        setStatus("error");
        reset(900);
        return;
      }
      setFirst(pin);
      setStep("repetir");
      setMessage(undefined);
      window.setTimeout(() => {
        setValue("");
        setRound((r) => r + 1);
      }, 160);
      return;
    }
    if (pin !== first) {
      setMessage("No coincide. Escribí el PIN nuevo otra vez.");
      setStatus("error");
      setStep("nuevo");
      setFirst("");
      reset(900);
      return;
    }
    void sim.updateSettings({ adminPin: pin }).then(() => {
      setStatus("success");
      toast.success("PIN cambiado");
      window.setTimeout(() => {
        setStep("nuevo");
        setFirst("");
        setValue("");
        setStatus("idle");
        setRound((r) => r + 1);
      }, 1400);
    });
  };

  return (
    <section aria-labelledby="pin">
      <SectionTitle id="pin">PIN del panel</SectionTitle>
      <div className="flex flex-col gap-3 bg-paper px-4 py-4 text-paper-ink">
        <span className="text-[16px] font-semibold">{step === "nuevo" ? "PIN nuevo" : "Repetí el PIN nuevo"}</span>
        <OTPInput
          key={round}
          autoFocus={round > 0}
          length={4}
          mask
          value={value}
          onChange={setValue}
          onComplete={complete}
          status={status}
          aria-label={step === "nuevo" ? "PIN nuevo" : "Repetir PIN"}
          hint={message ?? "4 dígitos"}
          errorMessage={message}
          className="[&_[class*=emerald]]:border-ink! [&_[class*=emerald]]:text-ink! [&_p]:text-[14px]"
        />
      </div>
    </section>
  );
}
