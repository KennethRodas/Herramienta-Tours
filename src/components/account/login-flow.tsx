"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { OTPInput, type OTPStatus } from "@/components/motion/otp-input";
import { PhoneField, TextField } from "@/components/booking/fields";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/brand/logo";
import { formatPhone, normalizePhone } from "@/lib/domain/format";
import { setCustomerSession, useCustomer } from "@/lib/sim/customer";
import { sim } from "@/lib/sim/store";
import { PHOTO_CREDITS } from "@/content/photo-credits";

// Login and sign-up in one flow: WhatsApp number → 6-digit code → (first time) name and email.
// No passwords: in El Salvador the WhatsApp number is the account.

type Step = "telefono" | "codigo" | "perfil";

const SIMULATION = process.env.NEXT_PUBLIC_DATA_MODE !== "supabase";
const validSv = (digits: string) => /^503[67]\d{7}$/.test(digits);

export function LoginFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/cuenta";
  const { customer, ready } = useCustomer();
  const reduce = useReducedMotion();
  const [step, setStep] = useState<Step>("telefono");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string>();
  const [code, setCode] = useState("");
  const [codeStatus, setCodeStatus] = useState<OTPStatus>("idle");
  const [codeError, setCodeError] = useState<string>();
  const [wait, setWait] = useState(0);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [profileError, setProfileError] = useState<{ name?: string; email?: string }>({});
  const [busy, setBusy] = useState(false);

  const digits = normalizePhone(phone);

  // Already signed in: nothing to do here.
  useEffect(() => {
    if (ready && customer?.name && step === "telefono") router.replace(next);
  }, [ready, customer, step, next, router]);

  // Resend countdown.
  useEffect(() => {
    if (wait <= 0) return;
    const id = window.setTimeout(() => setWait((w) => w - 1), 1000);
    return () => window.clearTimeout(id);
  }, [wait]);

  const sendCode = async () => {
    if (!validSv(digits)) {
      setPhoneError("Escribí un WhatsApp de El Salvador: 8 dígitos que empiezan con 6 o 7.");
      return;
    }
    setBusy(true);
    const { code: sent } = await sim.requestLoginCode(digits);
    setBusy(false);
    setPhoneError(undefined);
    setCode("");
    setCodeStatus("idle");
    setWait(45);
    setStep("codigo");
    if (SIMULATION) {
      toast(`WhatsApp · Wilber`, { description: `${sent} es tu código para entrar a Wilber.`, duration: 9000 });
    }
  };

  const verify = async (value: string) => {
    setBusy(true);
    const r = await sim.verifyLoginCode(digits, value);
    setBusy(false);
    if (!r.ok) {
      setCodeStatus("error");
      setCodeError(
        r.reason === "vencido"
          ? "El código venció. Pedí otro."
          : r.reason === "intentos"
            ? "Demasiados intentos. Pedí otro código."
            : `Código incorrecto. Te quedan ${r.left} intentos.`,
      );
      return;
    }
    setCodeStatus("success");
    setCustomerSession(r.customer.phone);
    if (r.isNew) {
      setName(r.customer.name);
      setEmail(r.customer.email ?? "");
      window.setTimeout(() => setStep("perfil"), 450);
    } else {
      toast("Entraste", { description: r.customer.name });
      window.setTimeout(() => router.replace(next), 450);
    }
  };

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    const errs: { name?: string; email?: string } = {};
    if (name.trim().split(/\s+/).length < 2) errs.name = "Escribí nombre y apellido.";
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errs.email = "Ese correo no parece válido.";
    setProfileError(errs);
    if (errs.name || errs.email) return;
    setBusy(true);
    await sim.saveCustomer({ phone: digits, name, email });
    setBusy(false);
    toast("Cuenta creada", { description: name.trim() });
    router.replace(next);
  };

  const panel = {
    initial: reduce ? { opacity: 0 } : { opacity: 0, x: 24 },
    animate: { opacity: 1, x: 0 },
    exit: reduce ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 0, x: -16, transition: { duration: 0.12, ease: [0.23, 1, 0.32, 1] as const } },
    transition: { duration: 0.22, ease: [0.23, 1, 0.32, 1] as const },
  };

  const photo = PHOTO_CREDITS["santa-ana"];
  const rise = (i: number) =>
    reduce
      ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.2, delay: i * 0.06 } }
      : { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.42, delay: 0.08 + i * 0.07, ease: [0.23, 1, 0.32, 1] as const } };

  return (
    <main className="mx-auto grid max-w-[1200px] items-center gap-8 px-[var(--gutter)] pb-32 pt-8 lg:grid-cols-[1.15fr_1fr] lg:gap-14 lg:pt-12">
      <motion.figure {...rise(0)} className="order-2 lg:order-1">
        <div className="relative aspect-[4/3] overflow-hidden rounded-ticket lg:aspect-[4/5]">
          <Image
            src={photo.src}
            alt={photo.alt}
            fill
            priority
            sizes="(min-width: 1024px) 600px, 100vw"
            className="object-cover"
          />
        </div>
        <figcaption className="mt-2 text-small text-ink-soft">
          Cráter del volcán de Santa Ana. Foto: {photo.author}, {photo.licence}.
        </figcaption>
      </motion.figure>
      <motion.div {...rise(1)} className="paper ticket-notch order-1 w-full px-7 pb-10 pt-8 sm:px-10 lg:order-2 [--ny:96px]">
        <LogoMark className="mb-6 size-12" paper="var(--cobalt-800)" ink="var(--sand-50)" />
        <AnimatePresence mode="wait" initial={false}>
          {step === "telefono" && (
            <motion.form
              key="telefono"
              {...panel}
              onSubmit={(e) => {
                e.preventDefault();
                void sendCode();
              }}
              className="space-y-6"
            >
              <div>
                <h1 className="font-display text-[clamp(2.75rem,8vw,4rem)] font-bold uppercase leading-[0.9]">Entrar</h1>
                <p className="mt-3 text-body">Te mandamos un código por WhatsApp. Si es tu primera vez, se crea tu cuenta.</p>
              </div>
              <PhoneField id="login-phone" label="WhatsApp" value={phone} onChange={(v) => setPhone(v)} error={phoneError} success={validSv(digits)} placeholder="7012 3456" />
              <Button type="submit" size="lg" className="w-full" disabled={busy}>
                {busy ? "Enviando…" : "Enviar código"}
              </Button>
            </motion.form>
          )}

          {step === "codigo" && (
            <motion.div key="codigo" {...panel} className="space-y-6">
              <div>
                <h1 className="font-display text-[clamp(2.75rem,8vw,4rem)] font-bold uppercase leading-[0.9]">Código</h1>
                <p className="mt-3 text-body">
                  Lo enviamos al <span className="font-semibold tabular">{formatPhone(digits)}</span>.
                </p>
              </div>
              <OTPInput
                length={6}
                value={code}
                onChange={(v) => {
                  setCode(v);
                  if (codeStatus === "error") setCodeStatus("idle");
                }}
                onComplete={(v) => void verify(v)}
                status={codeStatus}
                errorMessage={codeError}
                successMessage="Listo"
                disabled={busy || codeStatus === "success"}
                autoFocus
                aria-label="Código de 6 dígitos"
              />
              <div className="flex flex-wrap items-center justify-between gap-3 text-small font-semibold">
                <button
                  type="button"
                  disabled={wait > 0 || busy}
                  onClick={() => void sendCode()}
                  className="pressable underline decoration-2 underline-offset-4 disabled:no-underline disabled:opacity-60"
                >
                  {wait > 0 ? `Reenviar en 0:${String(wait).padStart(2, "0")}` : "Reenviar código"}
                </button>
                <button type="button" onClick={() => setStep("telefono")} className="pressable underline decoration-2 underline-offset-4">
                  Cambiar número
                </button>
              </div>
              {SIMULATION && <p className="text-small text-ink-soft">Simulación: el código aparece arriba, en el aviso.</p>}
            </motion.div>
          )}

          {step === "perfil" && (
            <motion.form key="perfil" {...panel} onSubmit={saveProfile} className="space-y-6">
              <div>
                <h1 className="font-display text-[clamp(2.75rem,8vw,4rem)] font-bold uppercase leading-[0.9]">Tu cuenta</h1>
                <p className="mt-3 text-body">Con estos datos llenamos tus próximas reservas.</p>
              </div>
              <TextField id="login-name" label="Nombre y apellido" value={name} onChange={setName} error={profileError.name} autoComplete="name" />
              <TextField
                id="login-email"
                label="Correo (opcional, para recibir el boleto)"
                value={email}
                onChange={setEmail}
                error={profileError.email}
                type="email"
                inputMode="email"
                autoComplete="email"
              />
              <Button type="submit" size="lg" className="w-full" disabled={busy}>
                {busy ? "Guardando…" : "Guardar"}
              </Button>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </main>
  );
}
