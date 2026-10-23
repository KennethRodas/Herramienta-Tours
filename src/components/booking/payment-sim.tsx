"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { tourById } from "@/content/catalog";
import { formatDayLong, formatTime, formatUsd } from "@/lib/domain/format";
import { sim } from "@/lib/sim/store";
import { useSettings, useSimState } from "@/lib/sim/hooks";
import { StatefulButton, type ButtonState } from "@/components/motion/button";
import { buttonClass } from "@/components/ui/button";
import { cx } from "./cx";
import { PaperStyles, Stamp } from "./paper";

// /reserva/pago?reserva=<id>: the online deposit. With Wompi keys the slip has
// one action, the Wompi checkout (test or live, as the Wompi app is set). Only
// without keys (503) does it fall back to our own simulated approve / reject,
// clearly marked as a test and never imitating Wompi.

type Outcome = "aprobar" | "rechazar";
type WompiLink =
  | { state: "cargando" }
  | { state: "listo"; url: string; productive: boolean }
  | { state: "sin_llaves" }
  | { state: "error"; message: string };

export function PaymentSim({ bookingId }: { bookingId: string | undefined }) {
  const router = useRouter();
  const s = useSimState();
  const settings = useSettings();
  const [busy, setBusy] = useState<Outcome | null>(null);
  const [done, setDone] = useState<Outcome | null>(null);
  const [link, setLink] = useState<WompiLink>({ state: "cargando" });
  const [attempt, setAttempt] = useState(0);

  const booking = s ? (s.bookings.find((b) => b.id === bookingId) ?? null) : undefined;
  const departure = booking ? s?.departures.find((d) => d.id === booking.departureId) : undefined;
  const tour = booking ? tourById(booking.tourId) : undefined;
  const pending = booking?.payment.method === "wompi" && booking.payment.status === "pendiente";

  useEffect(() => {
    if (!pending || !booking) return;
    let alive = true;
    const run = async () => {
      try {
        const res = await fetch("/api/pagos/wompi/enlace", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: booking.code, tourId: booking.tourId, partySize: booking.partySize, email: booking.email || undefined }),
        });
        const j = (await res.json().catch(() => ({}))) as { ok?: boolean; url?: string; productive?: boolean; error?: string };
        if (!alive) return;
        if (res.status === 503) setLink({ state: "sin_llaves" });
        else if (j.ok && j.url) setLink({ state: "listo", url: j.url, productive: Boolean(j.productive) });
        else setLink({ state: "error", message: j.error ?? `error ${res.status}` });
      } catch {
        if (alive) setLink({ state: "error", message: "sin conexión" });
      }
    };
    void run();
    return () => {
      alive = false;
    };
    // One request per booking (and per retry), not per re-render of the live state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, booking?.id, attempt]);

  if (booking === undefined) {
    return (
      <Shell>
        <div className="bk-skeleton h-[480px] rounded-ticket bg-sand-50" aria-busy="true" aria-label="Cargando pago" />
      </Shell>
    );
  }
  if (booking === null || !departure || !tour) {
    return (
      <Shell>
        <h1 className="font-display text-head font-bold uppercase">Pago</h1>
        <p className="mt-4 text-lead">No encontramos la reserva de este pago.</p>
        <Link href="/reserva" className={buttonClass("primary", "lg", "mt-6")}>
          Buscar reserva
        </Link>
      </Shell>
    );
  }
  if (!pending && !done) {
    return (
      <Shell>
        <h1 className="font-display text-head font-bold uppercase">Pago</h1>
        <p className="mt-4 text-lead">
          {booking.payment.status === "aprobado" ? "Este anticipo ya está pagado." : "Esta reserva se paga el día de la salida."}
        </p>
        <Link href={`/reserva/${booking.code}`} className={buttonClass("primary", "lg", "mt-6")}>
          Ver boleto
        </Link>
      </Shell>
    );
  }

  const total = booking.partySize * departure.priceUsd;
  const deposit = booking.payment.amountUsd;
  const preferred: Outcome = settings?.wompiOutcome ?? "aprobar";

  const settle = async (outcome: Outcome) => {
    setBusy(outcome);
    await sim.settlePayment(booking.id, outcome);
    setDone(outcome);
    window.setTimeout(() => {
      router.push(outcome === "aprobar" ? `/reserva/${booking.code}?nueva=1` : `/reserva/${booking.code}?pago=rechazado`);
    }, 450);
  };
  const stateFor = (o: Outcome): ButtonState => (done === o ? "success" : busy === o ? "loading" : "idle");

  // [label, value, wraps]: names and dates may wrap; codes and amounts never do.
  const rows: [string, string, boolean][] = [
    ["Boleto", booking.code, false],
    ["Tour", tour.name, true],
    ["Fecha", `${formatDayLong(departure.startsAt)}, ${formatTime(departure.startsAt)}`, true],
    ["Personas", String(booking.partySize), false],
    ["Total", formatUsd(total), false],
    ["Saldo el día de la salida", formatUsd(total - deposit), false],
  ];

  return (
    <Shell>
      <h1 className="font-display text-head font-bold uppercase">Anticipo</h1>
      <div className="paper edge-zigzag-b relative mt-6 px-6 pb-14 pt-8 sm:px-10">
        {link.state === "sin_llaves" || (link.state === "listo" && !link.productive) ? (
          <Stamp className="absolute right-6 top-7 sm:right-10">Pago de prueba</Stamp>
        ) : null}
        <p className="text-small font-semibold">A pagar ahora</p>
        <p className="tabular mt-1 font-display text-[min(var(--step-display),7rem)] font-bold leading-[0.85]">{formatUsd(deposit)}</p>
        <dl className="mt-8 flex flex-col gap-3">
          {rows.map(([k, v, wraps]) => (
            <div key={k} className="flex items-baseline text-body">
              <dt className={cx("min-w-0", wraps && "shrink-0")}>{k}</dt>
              <span aria-hidden className="dot-leader" />
              <dd className={cx("tabular text-right font-semibold", wraps ? "min-w-0" : "shrink-0 whitespace-nowrap")}>{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="mt-6 flex flex-col gap-2.5">
        {link.state === "cargando" ? (
          <span aria-busy="true" className={buttonClass("primary", "lg", "w-full opacity-70")}>
            Preparando el pago en Wompi…
          </span>
        ) : null}
        {link.state === "listo" ? (
          <>
            <a href={link.url} className={buttonClass("primary", "lg", "w-full")}>
              Pagar {formatUsd(deposit)} en Wompi
            </a>
            <p className="text-small text-ink-soft">
              {link.productive ? "Pago con tarjeta en la pasarela de Wompi." : "Wompi en modo prueba: no se cobra."}
            </p>
          </>
        ) : null}
        {link.state === "error" ? (
          <div role="status" className="flex flex-col gap-3 rounded-ticket bg-sand-300 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-body">No se pudo abrir Wompi ({link.message}).</p>
            <button
              type="button"
              onClick={() => {
                setLink({ state: "cargando" });
                setAttempt((a) => a + 1);
              }}
              className={buttonClass("primary", "md", "shrink-0")}
            >
              Reintentar
            </button>
          </div>
        ) : null}
        {link.state === "sin_llaves" ? <SimulatedPayment busy={busy} preferred={preferred} stateFor={stateFor} settle={settle} /> : null}
      </div>
    </Shell>
  );
}

function SimulatedPayment({
  busy,
  preferred,
  stateFor,
  settle,
}: {
  busy: Outcome | null;
  preferred: Outcome;
  stateFor: (o: Outcome) => ButtonState;
  settle: (o: Outcome) => Promise<void>;
}) {
  return (
    <>
        <div className={cx("grid gap-2.5 sm:grid-cols-2", busy && "pointer-events-none")}>
          {(["aprobar", "rechazar"] as const).map((o) => (
            <StatefulButton
              key={o}
              pressScale={0.98}
              state={stateFor(o)}
              loadingText={o === "aprobar" ? "Aprobando" : "Rechazando"}
              successText={o === "aprobar" ? "Aprobado" : "Rechazado"}
              onClick={() => void settle(o)}
              disabled={busy !== null && busy !== o}
              className={cx(
                "h-14 w-full rounded-full text-(length:--step-body) font-semibold",
                o === preferred ? "bg-cobalt-800 text-sand-50 hover:bg-cobalt-700" : "bg-sand-300 text-cobalt-800 hover:bg-sand-400",
              )}
            >
              {o === "aprobar" ? "Aprobar pago" : "Rechazar pago"}
            </StatefulButton>
          ))}
        </div>
        <p className="text-small text-ink-soft">Pago simulado: este entorno no tiene llaves de Wompi.</p>
    </>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[640px] px-(--gutter) pt-10 lg:pt-16">
      <PaperStyles />
      {children}
    </div>
  );
}
