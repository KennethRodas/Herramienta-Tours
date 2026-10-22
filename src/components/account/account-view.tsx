"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { TextField } from "@/components/booking/fields";
import { Button, ButtonLink } from "@/components/ui/button";
import { tourById } from "@/content/catalog";
import { formatDayShort, formatPhone, formatTime, formatUsd, plural } from "@/lib/domain/format";
import type { Booking } from "@/lib/domain/types";
import { useCustomer } from "@/lib/sim/customer";
import { useNow, useSimState } from "@/lib/sim/hooks";
import { sim } from "@/lib/sim/store";
import { cn } from "@/lib/utils";

const STATUS: Record<Booking["status"], string> = {
  confirmada: "Confirmada",
  pendiente_pago: "Pago pendiente",
  pagada: "Anticipo pagado",
  check_in: "Fuiste",
  no_show: "No asististe",
  cancelada: "Cancelada",
};

function Row({ b, startsAt, price }: { b: Booking; startsAt?: string; price?: number }) {
  const tour = tourById(b.tourId);
  return (
    <li>
      <Link
        href={`/reserva/${b.code}`}
        className="pressable grid grid-cols-[1fr_auto] items-center gap-x-6 gap-y-1 bg-sand-50 px-5 py-4 hover:bg-sand-100 sm:grid-cols-[9rem_1fr_auto]"
      >
        <span className="font-display text-2xl font-bold uppercase leading-none tabular">{b.code}</span>
        <span className="col-span-2 row-start-2 min-w-0 sm:col-span-1 sm:row-start-1">
          <span className="block truncate text-body font-semibold">{tour?.name}</span>
          <span className="block text-small text-ink-soft tabular">
            {startsAt ? `${formatDayShort(startsAt)}, ${formatTime(startsAt)}` : ""} · {plural(b.partySize, "persona", "personas")}
            {price ? ` · ${formatUsd(price * b.partySize)}` : ""}
          </span>
        </span>
        <span className={cn("text-small font-semibold", b.status === "cancelada" ? "text-stamp" : "text-ink")}>{STATUS[b.status]}</span>
      </Link>
    </li>
  );
}

export function AccountView() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const { customer, ready, logout } = useCustomer();
  const state = useSimState();
  const now = useNow(30_000);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<{ name?: string; email?: string }>({});

  useEffect(() => {
    if (ready && !customer) router.replace("/entrar?next=/cuenta");
  }, [ready, customer, router]);

  const { upcoming, past } = useMemo(() => {
    if (!state || !customer || now === null) return { upcoming: [], past: [] };
    const mine = state.bookings
      .filter((b) => b.phone === customer.phone)
      .map((b) => ({ b, d: state.departures.find((x) => x.id === b.departureId) }))
      .sort((a, z) => Date.parse(a.d?.startsAt ?? a.b.createdAt) - Date.parse(z.d?.startsAt ?? z.b.createdAt));
    return {
      upcoming: mine.filter(({ d, b }) => d && Date.parse(d.endsAt) > now && b.status !== "cancelada"),
      past: mine.filter(({ d, b }) => !d || Date.parse(d.endsAt) <= now || b.status === "cancelada").reverse(),
    };
  }, [state, customer, now]);

  if (!ready || !customer) {
    return (
      <main className="mx-auto max-w-4xl px-[var(--gutter)] pb-32 pt-12">
        <div className="h-48 animate-pulse bg-sand-300" />
      </main>
    );
  }

  const startEdit = () => {
    setName(customer.name);
    setEmail(customer.email ?? "");
    setError({});
    setEditing(true);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const errs: { name?: string; email?: string } = {};
    if (name.trim().split(/\s+/).length < 2) errs.name = "Escribí nombre y apellido.";
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errs.email = "Ese correo no parece válido.";
    setError(errs);
    if (errs.name || errs.email) return;
    await sim.saveCustomer({ phone: customer.phone, name, email });
    setEditing(false);
    toast("Datos guardados");
  };

  return (
    <main className="mx-auto max-w-4xl px-[var(--gutter)] pb-32 pt-12">
      <section className="field-ink edge-zigzag-b px-6 pb-12 pt-8 sm:px-10">
        <AnimatePresence mode="wait" initial={false}>
          {editing ? (
            <motion.form
              key="edit"
              onSubmit={save}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
              className="paper grid gap-5 p-6 sm:grid-cols-2"
            >
              <TextField id="acc-name" label="Nombre y apellido" value={name} onChange={setName} error={error.name} autoComplete="name" />
              <TextField id="acc-email" label="Correo" value={email} onChange={setEmail} error={error.email} type="email" inputMode="email" autoComplete="email" />
              <div className="flex gap-3 sm:col-span-2">
                <Button type="submit">Guardar</Button>
                <Button variant="quiet" onClick={() => setEditing(false)}>
                  Cancelar
                </Button>
              </div>
            </motion.form>
          ) : (
            <motion.div key="view" initial={false} animate={{ opacity: 1 }} className="flex flex-wrap items-end justify-between gap-6">
              <div className="min-w-0">
                <h1 className="font-display text-[clamp(2.5rem,7vw,4.5rem)] font-bold uppercase leading-[0.9]">{customer.name || "Tu cuenta"}</h1>
                <p className="mt-3 text-body tabular">
                  {formatPhone(customer.phone)}
                  {customer.email ? ` · ${customer.email}` : " · sin correo"}
                </p>
              </div>
              <div className="flex gap-3">
                <Button variant="inverse" onClick={startEdit}>
                  Editar datos
                </Button>
                <Button
                  variant="inverse"
                  onClick={() => {
                    logout();
                    router.replace("/");
                  }}
                >
                  Salir
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      <section className="mt-14">
        <h2 className="mb-4 font-display text-head font-semibold uppercase">Próximas salidas</h2>
        {upcoming.length ? (
          <ul className="space-y-1.5">
            {upcoming.map(({ b, d }) => (
              <Row key={b.id} b={b} startsAt={d?.startsAt} price={d?.priceUsd} />
            ))}
          </ul>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-4 bg-sand-300 px-5 py-5">
            <p className="text-body">No tenés reservas próximas con este número.</p>
            <ButtonLink href="/aventuras">Ver aventuras</ButtonLink>
          </div>
        )}
      </section>

      {past.length > 0 && (
        <section className="mt-14">
          <h2 className="mb-4 font-display text-head font-semibold uppercase">Anteriores</h2>
          <ul className="space-y-1.5">
            {past.map(({ b, d }) => (
              <Row key={b.id} b={b} startsAt={d?.startsAt} price={d?.priceUsd} />
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
