"use client";

import { ArrowDown, ArrowRight, Check, Download } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import QRCode from "qrcode";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { toast } from "sonner";
import { EASE_OUT } from "@/lib/ease";
import { cn } from "@/lib/utils";
import { AndroidConfirm, AndroidInstallItem, AndroidMenu, DesktopBar, DesktopConfirm, IosAddRow, IosConfirm, IosShare } from "../install-art";
import { runInstallPrompt, useInstallPrompt, useInstalled, usePlatform, type Platform } from "../install";
import { Btn, Chips, CopyButton, SectionTitle } from "../ui";

interface Step {
  art: ReactNode;
  text: ReactNode;
}

const STEPS: Record<Exclude<Platform, "otro">, { title: string; steps: Step[] }> = {
  ios: {
    title: "iPhone o iPad · Safari",
    steps: [
      { art: <IosShare />, text: <>Tocá <b>Compartir</b> en la barra de Safari.</> },
      { art: <IosAddRow />, text: <>Bajá y tocá <b>«Agregar a inicio»</b>.</> },
      { art: <IosConfirm />, text: <>Tocá <b>«Agregar»</b>. Wilber queda en tu pantalla de inicio.</> },
    ],
  },
  android: {
    title: "Android · Chrome",
    steps: [
      { art: <AndroidMenu />, text: <>Tocá el menú <b>⋮</b> arriba a la derecha.</> },
      { art: <AndroidInstallItem />, text: <>Tocá <b>«Instalar app»</b> o <b>«Agregar a la pantalla principal»</b>.</> },
      { art: <AndroidConfirm />, text: <>Confirmá con <b>«Instalar»</b>.</> },
    ],
  },
  desktop: {
    title: "Computadora · Chrome o Edge",
    steps: [
      { art: <DesktopBar />, text: <>Hacé clic en el ícono de <b>instalar</b> al final de la barra de direcciones.</> },
      { art: <DesktopConfirm />, text: <>Confirmá con <b>«Instalar»</b>. Se abre en su propia ventana.</> },
    ],
  },
};

const subscribeNothing = () => () => undefined;

function QrCode({ text, size = 176 }: { text: string; size?: number }) {
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const quiet = 2;
  const cells: string[] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.modules.get(r, c)) cells.push(`M${c + quiet} ${r + quiet}h1v1h-1z`);
    }
  }
  return (
    <svg viewBox={`0 0 ${n + quiet * 2} ${n + quiet * 2}`} width={size} height={size} role="img" aria-label={`Código QR de ${text}`} shapeRendering="crispEdges">
      <rect width={n + quiet * 2} height={n + quiet * 2} className="fill-paper" />
      <path d={cells.join("")} className="fill-ink" />
    </svg>
  );
}

export function InstalarScreen() {
  const reduce = useReducedMotion();
  const detected = usePlatform();
  const installed = useInstalled();
  const prompt = useInstallPrompt();
  const [chosen, setChosen] = useState<Exclude<Platform, "otro"> | null>(null);
  const origin = useSyncExternalStore(subscribeNothing, () => window.location.origin, () => "");
  const secure = useSyncExternalStore(
    subscribeNothing,
    () => window.location.protocol === "https:" && !/^(localhost|127\.|192\.168\.|10\.)/.test(window.location.hostname),
    () => true,
  );
  const [busy, setBusy] = useState(false);

  const platform = chosen ?? (detected && detected !== "otro" ? detected : "desktop");
  const plan = STEPS[platform];
  const url = origin ? `${origin}/wilber` : "";

  const install = async () => {
    setBusy(true);
    try {
      const outcome = await runInstallPrompt();
      if (outcome === "accepted") toast.success("App instalada");
      else if (outcome === "dismissed") toast("Instalación cancelada");
      else toast("Este navegador no ofrece instalar desde aquí. Seguí los pasos de abajo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      {installed ? (
        <section className="flex items-center gap-4 bg-ink px-5 py-5 text-paper">
          <span className="grid size-12 shrink-0 place-items-center bg-paper text-ink">
            <Check className="size-7" strokeWidth={3} />
          </span>
          <div className="flex flex-col">
            <span className="font-display text-[26px] font-bold uppercase leading-none">Ya está instalada</span>
            <span className="text-[15px] opacity-85">Estás usando la app en este dispositivo.</span>
          </div>
        </section>
      ) : prompt ? (
        <section className="flex flex-wrap items-center justify-between gap-4 bg-paper px-5 py-5 text-paper-ink">
          <span className="font-display text-[26px] font-bold uppercase leading-none">Instalar en este dispositivo</span>
          <Btn size="lg" onClick={() => void install()} disabled={busy}>
            <Download className="size-5" /> {busy ? "Abriendo" : "Instalar"}
          </Btn>
        </section>
      ) : null}

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start">
        <section aria-labelledby="pasos">
          <SectionTitle id="pasos" aside={detected && detected !== "otro" && !chosen ? "Detectado" : undefined}>
            {plan.title}
          </SectionTitle>
          <Chips<Exclude<Platform, "otro">>
            label="Dispositivo"
            size="sm"
            value={platform}
            onChange={setChosen}
            className="mb-4"
            options={[
              { value: "ios", label: "iPhone" },
              { value: "android", label: "Android" },
              { value: "desktop", label: "Computadora" },
            ]}
          />
          <ol className={cn("grid gap-3", plan.steps.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2")}>
            {plan.steps.map((s, i) => (
              <motion.li
                key={`${platform}-${i}`}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, ease: EASE_OUT, delay: reduce ? 0 : i * 0.06 }}
                className="relative flex flex-col items-center gap-3 bg-paper px-4 pt-5 pb-4 text-paper-ink"
              >
                {s.art}
                <p className="text-center text-[16px] leading-snug">{s.text}</p>
                {i < plan.steps.length - 1 ? (
                  <span aria-hidden className="absolute -bottom-3 left-1/2 z-10 grid size-7 -translate-x-1/2 place-items-center bg-ink text-paper md:top-1/2 md:-right-3 md:bottom-auto md:left-auto md:translate-x-0 md:-translate-y-1/2">
                    <ArrowDown className="size-4 md:hidden" />
                    <ArrowRight className="hidden size-4 md:block" />
                  </span>
                ) : null}
              </motion.li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="qr" className="flex flex-col">
          <SectionTitle id="qr">En el teléfono</SectionTitle>
          <div className="flex flex-col items-center gap-3 bg-paper px-4 py-5 text-paper-ink">
            {url ? <QrCode text={url} /> : <span className="size-44 animate-pulse bg-ink/10" />}
            <p className="text-center text-[15px]">Escanealo con la cámara para abrir el panel.</p>
            {url ? (
              <div className="flex w-full flex-col items-center gap-2">
                <span className="max-w-full truncate text-[14px] font-semibold tabular">{url}</span>
                <CopyButton value={url} label="Copiar enlace" />
              </div>
            ) : null}
            {!secure ? (
              <p className="bg-destructive/10 px-3 py-2 text-center text-[13px] font-medium text-destructive">
                Instalar funciona en el sitio publicado con https. Desde esta dirección el teléfono no ofrece instalar.
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
