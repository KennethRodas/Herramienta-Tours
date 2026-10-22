"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CalendarPlus, Check, CreditCard, MapPin, MessageCircle, Share2 } from "lucide-react";
import type { Booking, Departure, MeetingPoint, Tour } from "@/lib/domain/types";
import { BUSINESS, meetingPointById, tourById } from "@/content/catalog";
import { normalizeCode } from "@/lib/domain/availability";
import { DAY, formatCountdown, formatDayLong, formatTime, formatUsd, waLink } from "@/lib/domain/format";
import { contactWilberText, ticketUrl } from "@/lib/whatsapp/templates";
import { useBookingByCode, useNow, useSimState, useTours } from "@/lib/sim/hooks";
import { MeetingPointMap } from "@/components/map";
import { TextScramble } from "@/components/motion/text-scramble";
import { buttonClass } from "@/components/ui/button";
import { buildIcs, downloadIcs } from "./ics";
import { Field, PaperStyles, SplitTicket, Stamp } from "./paper";
import { PhotoPlate } from "./photo-plate";
import { PrepChecklist } from "./prep-checklist";
import { Reveal } from "./reveal";
import { TearOff } from "./tear-off";
import { TicketQr } from "./ticket-qr";
import { WeatherLine } from "./weather-line";
import { devWorstCase, WORST_BOOKING, WORST_DEPARTURE } from "./worst-case";

// /reserva/[codigo]: the visitor's own boleto. PRD: confirmation with code,
// date, time and meeting point; what to bring and when to arrive; a clear
// way to reach Wilber when the confirmation could not be sent or the
// preparation notes are not published yet.

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Hours and minutes while they matter; whole days once the trip is two or more days away. */
function countdown(start: number, now: number) {
  const days = Math.floor((start - now) / DAY);
  return days >= 2 ? `en ${days} días` : formatCountdown(start, now);
}

export function TicketView({ code: rawCode, fresh, payment, worst = false }: { code: string; fresh: boolean; payment?: string; worst?: boolean }) {
  const code = normalizeCode(decodeURIComponent(rawCode));
  const live = useBookingByCode(code);
  const s = useSimState();
  const tours = useTours({ includeInactive: true });
  // break-ui fixture (development only), swapped in where the data enters.
  const fixture = devWorstCase && worst && live !== undefined;
  const booking = fixture ? WORST_BOOKING : live;

  if (booking === undefined) return <TicketSkeleton />;
  if (booking === null) return <UnknownCode code={code} />;
  const departure = fixture ? WORST_DEPARTURE : s?.departures.find((d) => d.id === booking.departureId);
  const tour = tours.find((t) => t.id === booking.tourId) ?? tourById(booking.tourId);
  if (!departure || !tour) return <UnknownCode code={code} />;
  return <Ticket key={booking.id} booking={booking} departure={departure} tour={tour} fresh={fresh} payment={payment} />;
}

function Ticket({ booking, departure, tour, fresh, payment }: { booking: Booking; departure: Departure; tour: Tour; fresh: boolean; payment?: string }) {
  const now = useNow(1000) ?? Date.parse(booking.createdAt);
  const point = meetingPointById(departure.meetingPointId);
  const url = ticketUrl(booking.code);
  const flagKey = `wilber.festejo.${booking.code}`;

  // Celebrate once per code on this device, only when arriving from the booking.
  const [phase, setPhase] = useState<"idle" | "playing" | "done">(() => {
    if (!fresh || typeof window === "undefined") return "done";
    try {
      return window.localStorage.getItem(flagKey) ? "done" : "playing";
    } catch {
      return "playing";
    }
  });
  const [revealed, setRevealed] = useState(phase !== "playing");

  useEffect(() => {
    if (!fresh) return;
    try {
      window.localStorage.setItem(flagKey, "1");
    } catch {
      /* private mode */
    }
    // Drop ?nueva=1 so a reload shows the ticket without the ceremony.
    window.history.replaceState(window.history.state, "", `/reserva/${booking.code}`);
  }, [fresh, flagKey, booking.code]);

  const start = Date.parse(departure.startsAt);
  const arrive = start - tour.arriveMinutesBefore * 60_000;
  const total = booking.partySize * departure.priceUsd;
  const cancelled = booking.status === "cancelada";
  const depCancelled = departure.status === "cancelada";
  const past = start <= now;
  const live = !cancelled && !depCancelled;
  const failedConfirmation = booking.confirmation === "fallida" && live;
  const rejected = (payment === "rechazado" || booking.payment.status === "rechazado") && live;

  return (
    <div className="mx-auto w-full max-w-[1120px] px-(--gutter) pt-10 lg:pt-14">
      <PaperStyles />
      <div className="flex flex-col gap-3">
        {failedConfirmation ? (
          <Notice
            title="La reserva quedó registrada."
            text={`No pudimos enviarte la confirmación por WhatsApp. Escribile a Wilber con el código ${booking.code} para confirmarla.`}
            action={<WilberLink code={booking.code} label="Escribir a Wilber" primary />}
          />
        ) : null}
        {rejected ? (
          <Notice title="El pago fue rechazado." text={`La reserva sigue en pie: pagás ${formatUsd(total)} el día de la salida.`} />
        ) : null}
      </div>

      <div className={failedConfirmation || rejected ? "mt-16" : "mt-6"}>
        <TearOff
          play={phase === "playing"}
          capacity={departure.capacity}
          othersTaken={Math.max(0, departure.seatsTaken - booking.partySize)}
          mine={booking.partySize}
          onReveal={() => setRevealed(true)}
          onDone={() => setPhase("done")}
        >
          <div className="relative">
            <SplitTicket
              as="article"
              stubWidth="17.5rem"
              bodyClassName="px-5 pb-8 pt-7 sm:px-9 sm:pb-10 sm:pt-9"
              stubClassName="px-5 pb-7 pt-8 sm:px-8 lg:py-9"
              body={
                <>
                  {/* The code never wraps (it is one token), so its size follows the
                      phone's width: WIL-WMWM, the widest code, fits at 320px. */}
                  <h1 className="font-display text-[min(var(--step-display),8rem,calc((100vw-5.5rem)/4.1))] font-bold uppercase leading-[0.8] tracking-[-0.02em]">
                    <span className="sr-only">Boleto </span>
                    <TextScramble text={revealed ? booking.code : "WIL-····"} duration={720} glyphs="ACDEFGHJKMNPQRTUVWXY34679" className="tabular" />
                  </h1>
                  <p className="mt-5 text-lead font-semibold leading-tight">{tour.name}</p>
                  <dl className="mt-7 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
                    <Field label="Fecha" className="col-span-2 sm:col-span-1">
                      {capital(formatDayLong(departure.startsAt))}
                    </Field>
                    <Field label="Salida">
                      <span className="tabular">{formatTime(start)}</span>
                    </Field>
                    <Field label="Llegar a las">
                      <span className="tabular">{formatTime(arrive)}</span>
                    </Field>
                    <Field label="Encuentro" className="col-span-2 sm:col-span-1">
                      {point?.name ?? "Por confirmar"}
                    </Field>
                    <Field label="Personas">
                      <span className="tabular">{booking.partySize}</span>
                    </Field>
                    <Field label="Total">
                      <span className="tabular">{formatUsd(total)}</span>
                    </Field>
                  </dl>
                  <p className="mt-6 text-body leading-snug">{paymentLine(booking, total)}</p>
                </>
              }
              stub={
                <div className="flex items-center gap-5 lg:h-full lg:flex-col lg:items-start lg:justify-between">
                  <TicketQr value={url} label={`Código QR del boleto ${booking.code}`} className="size-28 shrink-0 sm:size-36 lg:size-44" />
                  <div className="flex min-w-0 flex-col gap-3">
                    <Field label="Boleto">
                      <span className="tabular">{booking.code}</span>
                    </Field>
                    {live ? (
                      <Field label={past ? "Estado" : "Sale"}>
                        <span className="tabular whitespace-nowrap">{past ? "Ya salió" : countdown(start, now)}</span>
                      </Field>
                    ) : null}
                  </div>
                </div>
              }
            />
            {cancelled || depCancelled ? (
              <Stamp className="pointer-events-none absolute right-6 top-6 text-head lg:right-[20rem]">{depCancelled ? "Salida cancelada" : "Cancelada"}</Stamp>
            ) : null}
          </div>
        </TearOff>
      </div>

      <TicketActions booking={booking} departure={departure} tour={tour} point={point} url={url} now={now} />

      {live ? <Indicaciones booking={booking} departure={departure} tour={tour} point={point} arrive={arrive} /> : <CancelledNote code={booking.code} />}
    </div>
  );
}

function paymentLine(b: Booking, total: number) {
  if (b.payment.method === "wompi" && b.payment.status === "aprobado") {
    return `Anticipo pagado: ${formatUsd(b.payment.amountUsd)}. Saldo: ${formatUsd(total - b.payment.amountUsd)} el día de la salida.`;
  }
  if (b.payment.method === "wompi" && b.payment.status === "pendiente") {
    return `Anticipo pendiente: ${formatUsd(b.payment.amountUsd)}. El resto, el día de la salida.`;
  }
  return `Pago: ${formatUsd(total)} el día de la salida.`;
}

function TicketActions({ booking, departure, tour, point, url, now }: { booking: Booking; departure: Departure; tour: Tour; point?: MeetingPoint; url: string; now: number }) {
  const [saved, setSaved] = useState(false);
  const share = `Boleto ${booking.code} · ${tour.name}, ${formatDayLong(departure.startsAt)}, ${formatTime(departure.startsAt)} · ${url}`;
  const icon = "size-5 shrink-0";
  const owes = booking.status === "pendiente_pago" && departure.status !== "cancelada";
  return (
    <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      {owes ? (
        <Link href={`/reserva/pago?reserva=${booking.id}`} className={buttonClass("primary", "md", "justify-start sm:justify-center")}>
          <CreditCard aria-hidden className={icon} strokeWidth={2.25} />
          Pagar anticipo · {formatUsd(booking.payment.amountUsd)}
        </Link>
      ) : null}
      <button
        type="button"
        onClick={() => {
          downloadIcs(`${booking.code}.ics`, buildIcs({ booking, departure, tour, point, url, now }));
          setSaved(true);
          window.setTimeout(() => setSaved(false), 2200);
        }}
        className={buttonClass(owes ? "quiet" : "primary", "md", "justify-start sm:justify-center")}
        aria-live="polite"
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={saved ? "ok" : "idle"}
            initial={{ opacity: 0, filter: "blur(3px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, filter: "blur(3px)" }}
            transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
            className="inline-flex items-center gap-2"
          >
            {saved ? <Check aria-hidden className={icon} strokeWidth={2.5} /> : <CalendarPlus aria-hidden className={icon} strokeWidth={2.25} />}
            {saved ? "Archivo descargado" : "Agregar al calendario"}
          </motion.span>
        </AnimatePresence>
      </button>
      <a href={waLink("", share)} target="_blank" rel="noreferrer" className={buttonClass("quiet", "md", "justify-start sm:justify-center")}>
        <Share2 aria-hidden className={icon} strokeWidth={2.25} />
        Compartir por WhatsApp
      </a>
      <WilberLink code={booking.code} label="Escribir a Wilber" />
    </div>
  );
}

function WilberLink({ code, label, primary }: { code: string; label: string; primary?: boolean }) {
  return (
    <a
      href={waLink(BUSINESS.whatsapp, contactWilberText(code))}
      target="_blank"
      rel="noreferrer"
      className={buttonClass(primary ? "primary" : "quiet", "md", "justify-start sm:justify-center")}
    >
      <MessageCircle aria-hidden className="size-5 shrink-0" strokeWidth={2.25} />
      {label}
    </a>
  );
}

function Indicaciones({ booking, departure, tour, point, arrive }: { booking: Booking; departure: Departure; tour: Tour; point?: MeetingPoint; arrive: number }) {
  return (
    <section aria-labelledby="indicaciones" className="mt-(--section-gap) flex flex-col gap-6">
      <h2 id="indicaciones" className="font-display text-head font-bold uppercase">
        Indicaciones
      </h2>
      {!departure.prepReady ? (
        <Notice
          title="Las indicaciones de esta salida aún no están listas."
          text={`Wilber las publica antes de la salida. Para cualquier duda, escribile con tu código ${booking.code}.`}
          action={<WilberLink code={booking.code} label="Escribir a Wilber" primary />}
        />
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-12">
          <div className="paper bk-tag px-6 pb-7 pt-14 sm:px-8 lg:col-span-5">
            <PrepChecklist code={booking.code} items={tour.bring} />
          </div>
          <Reveal className="flex flex-col gap-6 lg:col-span-7">
            <PhotoPlate photo={tour.photo} className="aspect-[16/9] w-full" />
            <div className="field-ink flex flex-col gap-4 rounded-ticket px-6 py-6 sm:px-8">
              <p className="flex items-baseline justify-between gap-4">
                <span className="text-body font-semibold">Llegar a las</span>
                <span className="tabular font-display text-head font-bold leading-none">{formatTime(arrive)}</span>
              </p>
              <p className="text-body leading-snug">
                {point ? `${point.name}, ${point.address}. ${point.instructions}` : "Punto de encuentro por confirmar."}
              </p>
            </div>
            <div className="paper px-6 py-5 sm:px-8">
              <WeatherLine tour={tour} startsAt={departure.startsAt} />
            </div>
            {departure.notes ? (
              <p className="rounded-field bg-sand-300 px-6 py-4 text-body leading-snug sm:px-8">
                <span className="font-semibold">Nota de Wilber:</span> {departure.notes}
              </p>
            ) : null}
          </Reveal>
        </div>
      )}
      {point ? (
        <div className="paper print-corners flex flex-col overflow-hidden">
          <MeetingPointMap point={point} className="h-72 w-full sm:h-96" />
          <div className="flex flex-col gap-4 px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <p className="text-body leading-snug">
              <span className="block text-lead font-semibold leading-tight">{point.name}</span>
              {point.address}, {point.city}
            </p>
            <a href={point.mapsUrl} target="_blank" rel="noreferrer" className={buttonClass("primary", "md", "shrink-0")}>
              <MapPin aria-hidden className="size-5" strokeWidth={2.25} />
              Cómo llegar
            </a>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function CancelledNote({ code }: { code: string }) {
  return (
    <div className="mt-10">
      <Notice title="Esta reserva no está activa." text={`Para elegir otra fecha, escribile a Wilber con el código ${code}.`} action={<WilberLink code={code} label="Escribir a Wilber" primary />} />
    </div>
  );
}

function Notice({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <div role="status" className="bk-rise flex flex-col gap-4 rounded-ticket bg-sand-300 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
      <p className="text-body leading-snug">
        <span className="block font-semibold">{title}</span>
        {text}
      </p>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function TicketSkeleton() {
  return (
    <div aria-busy="true" aria-label="Cargando boleto" className="mx-auto w-full max-w-[1120px] px-(--gutter) pt-10 lg:pt-14">
      <PaperStyles />
      <div className="bk-skeleton mt-6 h-[420px] rounded-ticket bg-sand-50" />
      <div className="mt-6 flex gap-2">
        <div className="bk-skeleton h-12 w-56 rounded-full bg-sand-300" />
        <div className="bk-skeleton h-12 w-56 rounded-full bg-sand-300" style={{ animationDelay: "120ms" }} />
      </div>
    </div>
  );
}

function UnknownCode({ code }: { code: string }) {
  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col items-start gap-6 px-(--gutter) pt-16">
      <h1 className="font-display text-head font-bold uppercase">Boleto no encontrado</h1>
      <p className="text-lead">No hay ninguna reserva con el código {code}.</p>
      <Link href="/reserva" className={buttonClass("primary", "lg")}>
        Buscar otra reserva
      </Link>
    </div>
  );
}
