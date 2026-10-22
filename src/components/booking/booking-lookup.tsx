"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type CSSProperties } from "react";
import { ArrowRight } from "lucide-react";
import type { Booking } from "@/lib/domain/types";
import { tourById } from "@/content/catalog";
import { formatDayShort, formatTime, normalizePhone, plural } from "@/lib/domain/format";
import { useSimState } from "@/lib/sim/hooks";
import { StatefulButton } from "@/components/motion/button";
import { CodeInput, type CodeStatus } from "./code-input";
import { Note, PhoneField } from "./fields";
import { PaperStyles } from "./paper";

// /reserva: open a boleto by its code, or list the bookings of a WhatsApp number.

const STATUS: Record<Booking["status"], string> = {
  confirmada: "Confirmada",
  pendiente_pago: "Anticipo pendiente",
  pagada: "Anticipo pagado",
  check_in: "Abordó",
  no_show: "No se presentó",
  cancelada: "Cancelada",
};

export function BookingLookup() {
  const router = useRouter();
  const s = useSimState();
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<CodeStatus>("idle");
  const [phone, setPhone] = useState("");
  const [searched, setSearched] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | undefined>();

  const open = (value: string) => {
    if (value.length < 4) {
      setStatus("error");
      return;
    }
    const full = `WIL-${value}`;
    const found = s?.bookings.find((b) => b.code === full);
    if (!found) {
      setStatus("error");
      return;
    }
    setStatus("success");
    router.push(`/reserva/${full}`);
  };

  const digits = phone.replace(/\D/g, "");
  const results = searched && s ? s.bookings.filter((b) => b.phone === searched) : null;
  const sorted = results
    ? [...results].sort((a, b) => {
        const da = s?.departures.find((d) => d.id === a.departureId)?.startsAt ?? a.createdAt;
        const db = s?.departures.find((d) => d.id === b.departureId)?.startsAt ?? b.createdAt;
        return Date.parse(db) - Date.parse(da);
      })
    : null;

  return (
    <div className="mx-auto grid w-full max-w-[1120px] grid-cols-[minmax(0,1fr)] gap-(--section-gap) px-(--gutter) pt-10 lg:grid-cols-12 lg:gap-12 lg:pt-16">
      <PaperStyles />
      <section aria-labelledby="buscar-codigo" className="flex flex-col gap-6 lg:col-span-6">
        <h1 id="buscar-codigo" className="font-display text-head font-bold uppercase">
          Buscar reserva
        </h1>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            open(code);
          }}
          className="paper edge-zigzag-b flex flex-col gap-6 px-5 pb-12 pt-7 sm:px-9"
        >
          <CodeInput
            id="codigo"
            value={code}
            onChange={(v) => {
              setCode(v);
              if (status !== "idle") setStatus("idle");
            }}
            onComplete={open}
            status={status}
            describedBy="codigo-nota"
          />
          <div className="min-h-5" id="codigo-nota">
            <Note tone={status === "error" ? "stamp" : "ink"}>
              {status === "error" ? (code.length < 4 ? "El código tiene 4 caracteres después de WIL-." : `No hay ninguna reserva con WIL-${code}.`) : null}
            </Note>
          </div>
          <StatefulButton
            type="submit"
            pressScale={0.98}
            state={status === "success" ? "loading" : "idle"}
            loadingText="Abriendo"
            disabled={code.length < 4}
            className="h-14 w-full rounded-full bg-cobalt-800 text-(length:--step-body) font-semibold text-sand-50 hover:bg-cobalt-700"
            icon={<ArrowRight className="size-5" strokeWidth={2.5} />}
          >
            Abrir boleto
          </StatefulButton>
        </form>
      </section>

      <section aria-labelledby="buscar-numero" className="flex flex-col gap-6 lg:col-span-6 lg:pt-[calc(var(--step-head)+1.5rem)]">
        <h2 id="buscar-numero" className="text-lead font-semibold">
          Reservas de un número de WhatsApp
        </h2>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (digits.length !== 8) {
              setPhoneError("Escribí los 8 dígitos del número.");
              setSearched(null);
              return;
            }
            setPhoneError(undefined);
            setSearched(normalizePhone(digits));
          }}
          className="flex flex-col gap-4 sm:flex-row sm:items-start"
        >
          <div className="flex-1">
            <PhoneField id="buscar-telefono" label="WhatsApp" value={phone} onChange={setPhone} error={phoneError} placeholder="7012 3456" />
          </div>
          <button type="submit" className="pressable h-[52px] shrink-0 rounded-full bg-cobalt-800 px-7 text-body font-semibold text-sand-50 transition-colors hover:bg-cobalt-700 sm:mt-[calc(var(--step-small)*1.45+0.5rem)]">
            Buscar
          </button>
        </form>

        {sorted ? (
          sorted.length === 0 ? (
            <p className="bk-rise rounded-field bg-sand-300 px-5 py-4 text-body" role="status">
              No hay reservas con ese número. Revisá los 8 dígitos o buscá por código.
            </p>
          ) : (
            <ol className="flex flex-col gap-2" aria-label={`${plural(sorted.length, "reserva", "reservas")} con ese número`}>
              {sorted.map((b, i) => {
                const dep = s?.departures.find((d) => d.id === b.departureId);
                const tour = tourById(b.tourId);
                return (
                  <li key={b.id} className="bk-rise" style={{ animationDelay: `${i * 50}ms` }}>
                    <Link
                      href={`/reserva/${b.code}`}
                      className="ticket-notch group flex items-center justify-between gap-4 rounded-ticket bg-sand-50 py-4 pl-6 pr-5 transition-[background-color,transform] duration-200 hover:bg-sand-100 active:scale-[0.99]"
                      style={{ "--n": "9px" } as CSSProperties}
                    >
                      <span className="flex min-w-0 flex-col">
                        <span className="tabular font-display text-lead font-bold leading-tight">{b.code}</span>
                        <span className="text-small">
                          {tour?.shortName} · {dep ? `${formatDayShort(dep.startsAt)}, ${formatTime(dep.startsAt)}` : "salida no disponible"} · {plural(b.partySize, "persona", "personas")}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2 text-small font-semibold">
                        {STATUS[b.status]}
                        <ArrowRight aria-hidden className="size-4 transition-transform duration-200 group-hover:translate-x-1" strokeWidth={2.5} />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          )
        ) : null}

        <Link
          href="/entrar?next=/cuenta"
          className="group -mx-3 inline-flex items-center gap-2 self-start rounded-full px-3 py-1.5 text-body font-semibold underline decoration-2 underline-offset-4 transition-colors hover:bg-sand-300"
        >
          Entrá con tu WhatsApp para ver todas tus reservas
          <ArrowRight aria-hidden className="size-4 shrink-0 transition-transform duration-200 group-hover:translate-x-1" strokeWidth={2.5} />
        </Link>
      </section>
    </div>
  );
}
