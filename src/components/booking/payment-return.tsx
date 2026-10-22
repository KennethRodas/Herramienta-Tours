"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { normalizeCode } from "@/lib/domain/availability";
import { formatUsd } from "@/lib/domain/format";
import { sim } from "@/lib/sim/store";
import { useSimState } from "@/lib/sim/hooks";
import { buttonClass } from "@/components/ui/button";
import { PaperStyles, Stamp } from "./paper";

// /reserva/pago/retorno: where Wompi sends the visitor back. The redirect is
// not proof of payment, so the transaction is read back through the lead's
// /api/pagos/wompi/verificar before anything is shown as paid.

export interface ReturnQuery {
  idTransaccion?: string;
  identificadorEnlaceComercio?: string;
  monto?: string;
  hash?: string;
}

type Verify =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "off" }
  | { kind: "error"; status: number | null }
  | { kind: "ok"; approved: boolean; amount: number | null; hashValid: boolean | null; reference: string | null; message: string | null };

export function PaymentReturn({ query }: { query: ReturnQuery }) {
  const s = useSimState();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Verify>(query.idTransaccion ? { kind: "loading" } : { kind: "missing" });

  useEffect(() => {
    if (!query.idTransaccion) return;
    let alive = true;
    const run = async () => {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(query)) if (v) params.set(k, v);
      try {
        const res = await fetch(`/api/pagos/wompi/verificar?${params.toString()}`, { cache: "no-store" });
        if (!alive) return;
        if (res.status === 503) return setResult({ kind: "off" });
        if (!res.ok) return setResult({ kind: "error", status: res.status });
        const j = (await res.json()) as { ok?: boolean; approved?: boolean; amount?: number | null; hashValid?: boolean | null; reference?: string | null; message?: string | null };
        if (!alive) return;
        if (!j.ok) return setResult({ kind: "error", status: res.status });
        setResult({ kind: "ok", approved: Boolean(j.approved), amount: j.amount ?? null, hashValid: j.hashValid ?? null, reference: j.reference ?? null, message: j.message ?? null });
      } catch {
        if (alive) setResult({ kind: "error", status: null });
      }
    };
    void run();
    return () => {
      alive = false;
    };
  }, [query, attempt]);

  const reference = result.kind === "ok" && result.reference ? result.reference : query.identificadorEnlaceComercio;
  const code = reference && /^WIL-?[A-Z0-9]{4}$/i.test(reference) ? normalizeCode(reference) : null;
  const local = code && s ? s.bookings.find((b) => b.code === code) : undefined;
  const approved = result.kind === "ok" && result.approved && result.hashValid !== false;

  // Keep the simulated booking in step with a real approval.
  const settleId = approved && local && local.payment.status === "pendiente" ? local.id : null;
  useEffect(() => {
    if (settleId) void sim.settlePayment(settleId, "aprobar");
  }, [settleId]);

  const ticket = code ? `/reserva/${code}` : "/reserva";
  const amount = result.kind === "ok" && result.amount !== null ? result.amount : query.monto ? Number(query.monto) : null;

  return (
    <div className="mx-auto w-full max-w-[640px] px-(--gutter) pt-10 lg:pt-16">
      <PaperStyles />
      <h1 className="font-display text-head font-bold uppercase">Pago en línea</h1>
      <div className="paper edge-zigzag-b relative mt-6 flex flex-col gap-4 px-6 pb-14 pt-8 sm:px-10" aria-live="polite">
        {result.kind === "loading" ? (
          <>
            <p className="text-lead font-semibold">Verificando el pago con Wompi.</p>
            <span className="bk-skeleton block h-5 w-2/3 rounded-full bg-sand-300" />
          </>
        ) : result.kind === "missing" ? (
          <p className="text-lead font-semibold">Falta el identificador de la transacción en el enlace.</p>
        ) : result.kind === "off" ? (
          <p className="text-lead font-semibold">El pago en línea todavía no está activo. Tu reserva sigue en pie.</p>
        ) : result.kind === "error" ? (
          <>
            <p className="text-lead font-semibold">No pudimos verificar el pago{result.status ? ` (error ${result.status})` : ""}.</p>
            <p className="text-body">Si el cobro aparece en tu tarjeta, escribile a Wilber con tu código.</p>
          </>
        ) : (
          <>
            <Stamp className="absolute right-6 top-7 sm:right-10">{approved ? "Pagado" : "Sin pagar"}</Stamp>
            <p className="text-lead font-semibold">{approved ? "Pago aprobado." : result.hashValid === false ? "La respuesta de Wompi no pasó la verificación." : "Wompi no aprobó el pago."}</p>
            {amount !== null && Number.isFinite(amount) ? <p className="tabular font-display text-head font-bold leading-none">{formatUsd(amount)}</p> : null}
            {code ? <p className="text-body">Boleto {code}</p> : null}
            {!approved && result.message ? <p className="text-body">{result.message}</p> : null}
          </>
        )}
      </div>
      <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
        <Link href={ticket} className={buttonClass("primary", "lg", "w-full sm:w-auto")}>
          {code ? "Ver boleto" : "Buscar reserva"}
        </Link>
        {result.kind === "error" ? (
          <button type="button" onClick={() => { setResult({ kind: "loading" }); setAttempt((n) => n + 1); }} className={buttonClass("quiet", "lg", "w-full sm:w-auto")}>
            Reintentar
          </button>
        ) : null}
      </div>
    </div>
  );
}
