"use client";

import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LogoMark } from "@/components/brand/logo";
import { OTPInput, type OTPStatus } from "@/components/motion/otp-input";
import { useSettings } from "@/lib/sim/hooks";
import { EASE_OUT } from "@/lib/ease";
import { signIn, useSession } from "../hooks";

const MAX_TRIES = 5;
const LOCK_MS = 30_000;

export function EntrarScreen({ volver }: { volver?: string }) {
  const router = useRouter();
  const session = useSession();
  const settings = useSettings();
  const reduce = useReducedMotion();
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<OTPStatus>("idle");
  const [fails, setFails] = useState(0);
  const [lockLeft, setLockLeft] = useState(0);
  const [round, setRound] = useState(0);
  const target = volver && volver.startsWith("/wilber") && !volver.startsWith("/wilber/entrar") ? volver : "/wilber";
  const pin = settings?.adminPin ?? "2381";
  const demo = process.env.NEXT_PUBLIC_DATA_MODE !== "supabase";

  useEffect(() => {
    if (session === true) router.replace(target);
  }, [session, router, target]);

  useEffect(() => {
    if (lockLeft <= 0) return;
    const t = window.setTimeout(() => setLockLeft((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearTimeout(t);
  }, [lockLeft]);

  const check = (value: string) => {
    if (lockLeft > 0) return;
    if (value === pin) {
      setStatus("success");
      try {
        navigator.vibrate?.(10);
      } catch {
        /* no motor */
      }
      window.setTimeout(signIn, 520);
      return;
    }
    const tries = fails + 1;
    setFails(tries);
    setStatus("error");
    try {
      navigator.vibrate?.([30, 40, 30]);
    } catch {
      /* no motor */
    }
    if (tries >= MAX_TRIES) {
      setFails(0);
      setLockLeft(LOCK_MS / 1000);
    }
    window.setTimeout(() => {
      setCode("");
      setStatus("idle");
      // Remount the slots so the caret goes back to the first digit.
      setRound((r) => r + 1);
    }, 900);
  };

  const left = MAX_TRIES - fails;

  return (
    <main className="grid min-h-dvh place-items-center bg-ground px-4 pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)] text-ink">
      <motion.div
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: EASE_OUT }}
        className="flex w-full max-w-sm flex-col items-center gap-7 text-center"
      >
        <motion.div
          animate={status === "success" && !reduce ? { rotate: [0, -8, 0], scale: [1, 1.08, 1] } : { rotate: 0, scale: 1 }}
          transition={{ duration: 0.45, ease: EASE_OUT }}
        >
          <LogoMark className="size-20" />
        </motion.div>
        <div className="flex flex-col items-center gap-2">
          <h1 className="font-display text-[40px] font-bold uppercase leading-none tracking-[-0.01em]">Campamento base</h1>
          <p className="text-[15px] text-ink-soft">PIN de 4 dígitos</p>
        </div>
        <OTPInput
          key={round}
          length={4}
          mask
          autoFocus
          value={code}
          onChange={setCode}
          onComplete={check}
          status={status}
          disabled={lockLeft > 0 || status === "success"}
          aria-label="PIN"
          hint={lockLeft > 0 ? `Demasiados intentos. Esperá ${lockLeft} s.` : demo ? `PIN de demostración: ${pin}` : undefined}
          errorMessage={left < MAX_TRIES && left > 0 ? `PIN incorrecto. ${left === 1 ? "Queda 1 intento" : `Quedan ${left} intentos`}.` : "PIN incorrecto."}
          className="items-center [&_[class*=emerald]]:border-ink! [&_[class*=emerald]]:text-ink! [&_[data-filled]]:h-16 [&_[data-filled]]:w-14 [&_[data-filled]]:text-[26px] [&_p]:text-[15px]"
        />
        <Link href="/" className="pressable px-3 py-2 text-[15px] font-semibold text-ink-soft underline decoration-ink/25 underline-offset-4 hover:text-ink">
          Ir al sitio
        </Link>
      </motion.div>
    </main>
  );
}
