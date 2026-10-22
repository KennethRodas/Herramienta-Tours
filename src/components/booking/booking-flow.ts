"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { BookingInput, BookingResult, PaymentMethod, Tour } from "@/lib/domain/types";
import { activeHolds, BOOKING_CUTOFF_MS, HOLD_MS, validateBooking, type BookingFieldErrors } from "@/lib/domain/availability";
import { plural } from "@/lib/domain/format";
import { sim } from "@/lib/sim/store";
import { useNow, useSessionId, useSettings, useSimState, type DepartureView } from "@/lib/sim/hooks";
import { simNow } from "@/lib/sim/state";
import { useCustomer } from "@/lib/sim/customer";
import { formatLocalPhone } from "./fields";

// State of the booking panel on /salidas/[id], kept above the panel so the
// inline (desktop) and bottom-sheet (phone) renderings share one booking.
// Grupo → seats are held for 10 minutes → Datos → Resumen → hold to confirm.

export type Step = "grupo" | "datos" | "resumen";
export type FieldKey = "name" | "phone" | "email" | "notes" | "paymentMethod" | "partySize";
export type Closed = "llena" | "cerrada" | "cancelada" | "pasada" | "tarde";
export type Failure = Extract<BookingResult, { ok: false }>;

export interface FormState {
  name: string;
  phone: string;
  email: string;
  notes: string;
  pay: PaymentMethod;
}

const MAX_GROUP = 25;
const STEP_ORDER: Step[] = ["grupo", "datos", "resumen"];
const pendingRelease = new Map<string, number>();
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export const fieldId = (key: FieldKey) => `bk-${key}`;

/** "Queda 1 cupo" / "Quedan 3 cupos": the verb agrees with the count. */
export const seatsLeftText = (n: number, only = true) =>
  `${only ? "Solo q" : "Q"}${n === 1 ? "ueda" : "uedan"} ${plural(n, "cupo", "cupos")}`;

export function useBookingFlow(dep: DepartureView, tour: Tour, prefill?: FormState) {
  const router = useRouter();
  const s = useSimState();
  const settings = useSettings();
  const now = useNow(500) ?? 0;
  const sessionId = useSessionId();

  // A reload in the same tab finds its own hold again instead of locking the
  // visitor out of their seats: a release on "pagehide" rarely finishes before
  // the page is gone. Only a hold that still exists is taken back.
  const holdKey = `wilber.hold.${dep.id}`;
  const [restored] = useState(() => {
    try {
      const id = window.sessionStorage.getItem(holdKey);
      const h = id ? s?.holds.find((x) => x.id === id) : undefined;
      return h && s && Date.parse(h.expiresAt) > simNow(s.clock) ? h : null;
    } catch {
      return null;
    }
  });

  const [step, setStepRaw] = useState<Step>("grupo");
  // +1 forward, -1 back: the panel slides the next step in from the side it
  // sits on in the tabs, so "Editar" visibly goes back.
  const [dir, setDir] = useState<1 | -1>(1);
  const setStep = (next: Step) => {
    setDir(STEP_ORDER.indexOf(next) >= STEP_ORDER.indexOf(step) ? 1 : -1);
    setStepRaw(next);
  };
  const [reviewTries, setReviewTries] = useState(0);
  // A prefill (break-ui worst case, development only) also asks for every seat.
  const [party, setParty] = useState<number | null>(prefill ? MAX_GROUP : (restored?.partySize ?? null));
  const [holdId, setHoldId] = useState<string | null>(restored?.id ?? null);
  // What the visitor typed. Anything not typed falls back to their account
  // (signed in with WhatsApp) until they choose "Cambiar".
  const [edits, setEdits] = useState<Partial<FormState>>(prefill ?? {});
  const { customer } = useCustomer();
  const [accountOff, setAccountOff] = useState(false);
  const account = !accountOff && !prefill && customer ? customer : null;
  const form: FormState = {
    name: edits.name ?? account?.name ?? "",
    phone: edits.phone ?? (account?.phone ? formatLocalPhone(account.phone) : ""),
    email: edits.email ?? account?.email ?? "",
    notes: edits.notes ?? "",
    pay: edits.pay ?? "en_sitio",
  };
  const fromAccount = account !== null && (edits.name === undefined || edits.phone === undefined || edits.email === undefined);
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [busy, setBusy] = useState<null | "hold" | "book">(null);
  const [booked, setBooked] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [holdError, setHoldError] = useState<string | null>(null);
  const focusRef = useRef<FieldKey | null>(null);

  // Seats are released when the visitor leaves (tab closed, back, another page).
  const holdRef = useRef<string | null>(null);
  useEffect(() => {
    holdRef.current = holdId;
    try {
      if (holdId) window.sessionStorage.setItem(holdKey, holdId);
      else window.sessionStorage.removeItem(holdKey);
    } catch {
      /* private mode: the hold simply expires */
    }
  }, [holdId, holdKey]);
  useEffect(() => {
    // A remount right after an unmount (React's strict mode, a fast refresh)
    // must not lose the hold it is about to show: the release waits one tick
    // and a remount of the same hold cancels it.
    const mine = holdRef.current;
    if (mine && pendingRelease.has(mine)) {
      window.clearTimeout(pendingRelease.get(mine));
      pendingRelease.delete(mine);
    }
    const releaseNow = () => {
      if (holdRef.current) void sim.releaseHold(holdRef.current);
    };
    window.addEventListener("pagehide", releaseNow);
    return () => {
      window.removeEventListener("pagehide", releaseNow);
      const id = holdRef.current;
      if (!id) return;
      pendingRelease.set(
        id,
        window.setTimeout(() => {
          pendingRelease.delete(id);
          void sim.releaseHold(id);
        }, 0),
      );
    };
  }, []);

  const holds = s?.holds ?? [];
  const hold = holdId ? (holds.find((h) => h.id === holdId) ?? null) : null;
  const holdLive = hold !== null && Date.parse(hold.expiresAt) > now;
  const holdMsLeft = hold ? Math.max(0, Date.parse(hold.expiresAt) - now) : 0;
  const holdExpired = holdId !== null && !holdLive && !booked;

  // What this visitor can still take: capacity − sold − other people's holds.
  // Holds are told apart by session, not by id: between the store committing
  // a new hold and `holdId` being set there is one render where the id is
  // still unknown, and the visitor's own seats must never read as someone else's.
  const othersHeld = activeHolds(holds, dep.id, now)
    .filter((h) => h.sessionId !== sessionId && h.id !== holdId)
    .reduce((n, h) => n + h.partySize, 0);
  const available = s ? Math.max(0, dep.capacity - dep.seatsTaken - othersHeld) : dep.left;
  const maxParty = Math.min(available, MAX_GROUP);
  const size = clamp(party ?? Math.min(2, maxParty), 1, Math.max(1, maxParty));
  const trimmed = party !== null && maxParty > 0 && party > maxParty;

  const start = Date.parse(dep.startsAt);
  const closed: Closed | null =
    dep.status === "cancelada"
      ? "cancelada"
      : dep.state === "pasada"
        ? "pasada"
        : dep.status === "cerrada"
          ? "cerrada"
          : start - BOOKING_CUTOFF_MS <= now
            ? "tarde"
            : available <= 0 && !holdLive
              ? "llena"
              : null;

  const online = Boolean(settings?.onlineDeposit) && tour.depositUsd > 0;
  const payment: PaymentMethod = online ? form.pay : "en_sitio";
  const total = size * dep.priceUsd;
  const deposit = tour.depositUsd * size;

  const input: BookingInput = {
    departureId: dep.id,
    name: form.name,
    phone: form.phone.replace(/\D/g, ""),
    email: form.email,
    partySize: size,
    notes: form.notes,
    paymentMethod: payment,
    source: "web",
    holdId: holdId ?? undefined,
  };
  const validation = validateBooking(input);
  const errors: BookingFieldErrors = validation.ok ? {} : validation.errors;
  const missing = (Object.keys(errors) as FieldKey[]).filter((k) => k !== "partySize");
  const errorFor = (key: FieldKey) => (touched[key] || submitted ? errors[key] : undefined);

  const pick = (n: number) => {
    setParty(clamp(n, 1, Math.max(1, maxParty)));
    setHoldError(null);
  };

  const holdSeats = async (n: number) => {
    setBusy("hold");
    setHoldError(null);
    const r = await sim.hold(dep.id, n, sessionId, holdId ?? undefined);
    setBusy(null);
    if (r.ok) {
      setHoldId(r.hold.id);
      return true;
    }
    setHoldError(r.seatsLeft > 0 ? `${seatsLeftText(r.seatsLeft)}.` : "Se acaban de llenar los cupos.");
    if (r.seatsLeft > 0) setParty(r.seatsLeft);
    return false;
  };

  /** Grupo → Datos: holds the seats (or keeps the current hold if it still fits). */
  const apartar = async () => {
    if (holdLive && hold?.partySize === size) {
      setStep("datos");
      return;
    }
    if (await holdSeats(size)) setStep("datos");
  };

  const rehold = () => holdSeats(size);

  const toResumen = () => {
    if (!validation.ok && missing.length) {
      setSubmitted(true);
      setReviewTries((n) => n + 1);
      const first = (["name", "phone", "email", "notes", "paymentMethod"] as FieldKey[]).find((k) => errors[k]);
      if (first) document.getElementById(fieldId(first))?.focus();
      return;
    }
    setStep("resumen");
  };

  const confirm = async () => {
    setAttempts((n) => n + 1);
    if (!validation.ok) {
      // PRD: the missing field is marked and nothing is sent.
      setSubmitted(true);
      return;
    }
    setBusy("book");
    setFailure(null);
    const r = await sim.book(validation.data);
    if (r.ok) {
      setBooked(true);
      holdRef.current = null;
      router.push(r.booking.payment.method === "wompi" ? `/reserva/pago?reserva=${r.booking.id}` : `/reserva/${r.booking.code}?nueva=1`);
      return;
    }
    setBusy(null);
    setFailure(r);
  };

  /** After "sin cupos": take the seats that are left and go back to the summary. */
  const reduceTo = async (n: number) => {
    setFailure(null);
    setParty(n);
    if (await holdSeats(n)) setStep("resumen");
    else setStep("grupo");
  };

  const edit = (key: FieldKey) => {
    focusRef.current = key;
    setFailure(null);
    setStep(key === "partySize" ? "grupo" : "datos");
  };

  /** Read once by the view that mounts after "Editar". */
  const takeFocus = () => {
    const key = focusRef.current;
    focusRef.current = null;
    return key;
  };

  const canEnter = (target: Step) => target === "grupo" || holdId !== null;

  return {
    dep,
    tour,
    now,
    step,
    dir,
    reviewTries,
    go: (target: Step) => {
      if (!canEnter(target)) return;
      setFailure(null);
      setStep(target);
    },
    canEnter,
    size,
    maxParty,
    available,
    othersHeld,
    trimmed,
    pick,
    hold,
    holdLive,
    holdExpired,
    holdMsLeft,
    holdTotalMs: HOLD_MS,
    holdError,
    apartar,
    rehold,
    form,
    setField: <K extends keyof FormState>(key: K, value: FormState[K]) => setEdits((f) => ({ ...f, [key]: value })),
    /** True while name, WhatsApp or email still come from the visitor's account. */
    fromAccount,
    /** "Cambiar": forget the account data; what was typed stays. */
    clearAccount: () => setAccountOff(true),
    touch: (key: FieldKey) => setTouched((t) => (t[key] ? t : { ...t, [key]: true })),
    errors,
    errorFor,
    missing,
    submitted,
    attempts,
    online,
    payment,
    total,
    deposit,
    closed,
    busy,
    booked,
    failure,
    toResumen,
    confirm,
    reduceTo,
    edit,
    takeFocus,
    dismissFailure: () => setFailure(null),
  };
}

export type BookingFlow = ReturnType<typeof useBookingFlow>;
