"use client";

import { motion, useReducedMotion } from "motion/react";
import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { toast } from "sonner";
import { SwipeableList, type SwipeableListValue } from "@/components/motion/swipeable-list";
import type { Booking, BookingStatus, Departure } from "@/lib/domain/types";
import { formatPhone, plural } from "@/lib/domain/format";
import { sim } from "@/lib/sim/store";
import { cn } from "@/lib/utils";
import { useCoarsePointer } from "./hooks";
import { isLive, paymentLine } from "./lib";
import { Btn, StatusTag } from "./ui";

type Act = "llego" | "novino" | "deshacer";

const buzz = () => {
  try {
    navigator.vibrate?.(12);
  } catch {
    /* no vibration motor */
  }
};

/** Optimistic check-in: the row changes on the tap, the simulation catches up. */
export function useCheckIn() {
  const [pending, setPending] = useState<Record<string, BookingStatus>>({});
  const act = async (b: Booking, kind: Act, quiet = false, haptic = true) => {
    const target: BookingStatus =
      kind === "llego" ? "check_in" : kind === "novino" ? "no_show" : b.payment.status === "aprobado" ? "pagada" : "confirmada";
    setPending((p) => ({ ...p, [b.id]: target }));
    if (kind !== "deshacer" && haptic) buzz();
    try {
      if (kind === "llego") await sim.checkIn(b.id);
      else if (kind === "novino") await sim.markNoShow(b.id);
      else await sim.checkIn(b.id, 0);
      if (!quiet) {
        const text =
          kind === "llego"
            ? `${b.name}: ${b.partySize === 1 ? "llegó" : `llegaron ${b.partySize}`}`
            : kind === "novino"
              ? `${b.name}: no vino`
              : `${b.name}: sin marcar`;
        toast(text, kind === "deshacer" ? undefined : { action: { label: "Deshacer", onClick: () => void act(b, "deshacer", true) } });
      }
    } catch {
      toast.error(`No se pudo marcar a ${b.name}. Probá de nuevo.`);
    } finally {
      setPending((p) => {
        const next = { ...p };
        delete next[b.id];
        return next;
      });
    }
  };
  return { pending, act };
}

/** One block per person: arrived in ink, missing in stamp, waiting faint. */
export function ArrivalMeter({ bookings, pending, className }: { bookings: Booking[]; pending?: Record<string, BookingStatus>; className?: string }) {
  const live = bookings.filter(isLive);
  const total = live.reduce((n, b) => n + b.partySize, 0);
  const cells: ("in" | "out" | "wait")[] = [];
  let arrived = 0;
  for (const b of live) {
    const status = pending?.[b.id] ?? b.status;
    const came = status === "check_in" ? (b.status === "check_in" ? b.checkedIn : b.partySize) : 0;
    arrived += came;
    for (let i = 0; i < b.partySize; i++) cells.push(status === "no_show" ? "out" : i < came ? "in" : "wait");
  }
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <p className="flex items-baseline gap-2 text-ink">
        <span className="font-display text-[30px] font-bold leading-none">
          {arrived} <span className="text-ink-soft">de</span> {total}
        </span>
        <span className="text-[14px] font-medium text-ink-soft">{arrived === 1 ? "llegó" : "llegaron"}</span>
      </p>
      {total > 0 ? (
        <div className="flex flex-wrap gap-[3px]" aria-hidden>
          {cells.map((c, i) => (
            <span
              key={i}
              className={cn(
                "ticket-notch block h-[22px] w-[14px] transition-colors duration-200 [--n:3px]",
                c === "in" ? "bg-ink" : c === "out" ? "bg-destructive/60" : "bg-ink/15",
              )}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function RowBody({ b, status, price, onOpen }: { b: Booking; status: BookingStatus; price: number; onOpen: (id: string) => void }) {
  // A swipe that ends on the row must not also open it.
  const down = useRef<{ x: number; y: number } | null>(null);
  const reduce = useReducedMotion();
  const arrived = status === "check_in";
  return (
    <button
      type="button"
      onPointerDown={(e: ReactPointerEvent) => {
        down.current = { x: e.clientX, y: e.clientY };
      }}
      onClick={(e) => {
        const d = down.current;
        if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8) return;
        onOpen(b.id);
      }}
      className="flex w-full min-w-0 items-stretch gap-3 text-left"
    >
      <motion.span
        initial={false}
        animate={{ scale: arrived && !reduce ? [1, 1.08, 1] : 1 }}
        transition={{ duration: 0.3 }}
        className={cn(
          "grid w-12 shrink-0 place-items-center font-display text-[26px] font-bold leading-none transition-colors duration-200",
          arrived ? "bg-ink text-paper" : status === "no_show" ? "bg-destructive/15 text-destructive" : "bg-ink/8 text-ink",
          status === "cancelada" && "opacity-50",
        )}
        aria-label={plural(b.partySize, "persona", "personas")}
      >
        {b.partySize}
      </motion.span>
      <span className="flex min-w-0 flex-1 flex-col justify-center gap-1 py-1">
        <span className="flex min-w-0 items-center justify-between gap-2">
          <span className={cn("truncate text-[17px] font-semibold leading-tight text-ink", status === "cancelada" && "line-through opacity-60")}>{b.name}</span>
          <StatusTag status={status} className="shrink-0" />
        </span>
        <span className="truncate text-[14px] leading-tight text-ink-soft">
          {paymentLine(b, price)} · {formatPhone(b.phone)}
        </span>
        {b.notes ? <span className="line-clamp-2 text-[13px] leading-snug text-ink">{b.notes}</span> : null}
      </span>
    </button>
  );
}

/**
 * Check-in manifest. On a phone each group is a row you swipe: right = llegó,
 * left = no vino. With a mouse the same two actions are buttons on the row.
 */
export function Manifest({
  departure,
  bookings,
  onOpen,
  checkIn,
  readOnly = false,
  className,
}: {
  departure: Departure;
  bookings: Booking[];
  onOpen: (bookingId: string) => void;
  checkIn: ReturnType<typeof useCheckIn>;
  /** A cancelled departure: the list without arrival actions. */
  readOnly?: boolean;
  className?: string;
}) {
  const coarse = useCoarsePointer();
  const [openRow, setOpenRow] = useState<SwipeableListValue | null>(null);
  const { pending, act } = checkIn;
  const list = [...bookings].sort((a, b) => Number(a.status === "cancelada") - Number(b.status === "cancelada") || a.name.localeCompare(b.name, "es"));
  const byId = new Map(list.map((b) => [b.id, b]));

  if (!list.length) return null;

  if (readOnly) {
    return (
      <ul className={cn("flex flex-col gap-1.5", className)}>
        {list.map((b) => (
          <li key={b.id} className="bg-paper">
            <RowBody b={b} status={pending[b.id] ?? b.status} price={departure.priceUsd} onOpen={onOpen} />
          </li>
        ))}
      </ul>
    );
  }

  if (coarse) {
    return (
      <SwipeableList
        className={cn("gap-1.5", className)}
        actionWidth={104}
        revealThreshold={40}
        value={openRow}
        onValueChange={(v) => {
          setOpenRow(v);
          if (!v) return;
          // The swipe is the action: the revealed label confirms it, the motor
          // ticks on release, and the row slides home as the status changes.
          // (Changing the row's actions while it is open would strand it open.)
          buzz();
          const b = byId.get(v.id);
          window.setTimeout(() => {
            setOpenRow(null);
            if (b) void act(b, v.side === "left" ? "llego" : "novino", false, false);
          }, 380);
        }}
        items={list.map((b) => {
          const status = pending[b.id] ?? b.status;
          return {
            id: b.id,
            title: b.name,
            disabled: b.status === "cancelada",
            leftActions: status === "check_in" ? [] : [{ id: "llego", label: "Llegó", icon: <span aria-hidden>Llegó</span> }],
            rightActions: status === "no_show" ? [] : [{ id: "novino", label: "No vino", icon: <span aria-hidden>No vino</span> }],
          };
        })}
        renderItem={(item) => {
          const b = byId.get(item.id)!;
          return <RowBody b={b} status={pending[b.id] ?? b.status} price={departure.priceUsd} onOpen={onOpen} />;
        }}
        classNames={{
          item: "rounded-none bg-transparent",
          // Inset by a pixel so the coloured rails never bleed through the row's antialiased edges at rest.
          rail: "inset-px rounded-none [&>[data-side=left]]:rounded-none [&>[data-side=left]]:bg-ink [&>[data-side=right]]:rounded-none [&>[data-side=right]]:bg-destructive",
          action:
            "text-paper [&>span:first-child]:h-auto [&>span:first-child]:w-auto [&>span:first-child]:rounded-none [&>span:first-child]:bg-transparent [&>span:first-child]:px-2 [&>span:first-child]:text-[15px] [&>span:first-child]:font-semibold [&>span:first-child]:text-paper",
          surface: "min-h-[68px] rounded-none border-0 bg-paper px-0 py-0 shadow-none",
        }}
      />
    );
  }

  return (
    <ul className={cn("flex flex-col gap-1.5", className)}>
      {list.map((b) => {
        const status = pending[b.id] ?? b.status;
        const marked = status === "check_in" || status === "no_show";
        return (
          <li key={b.id} className="flex items-stretch gap-2 bg-paper pr-2">
            <div className="min-w-0 flex-1">
              <RowBody b={b} status={status} price={departure.priceUsd} onOpen={onOpen} />
            </div>
            {b.status === "cancelada" ? null : (
              <div className="flex shrink-0 items-center gap-1.5">
                {marked ? (
                  <Btn variant="ghost" size="sm" onClick={() => void act(b, "deshacer")}>
                    Deshacer
                  </Btn>
                ) : (
                  <>
                    <Btn variant="primary" size="sm" onClick={() => void act(b, "llego")}>
                      Llegó
                    </Btn>
                    <Btn variant="quiet" size="sm" className="hover:bg-destructive/15 hover:text-destructive" onClick={() => void act(b, "novino")}>
                      No vino
                    </Btn>
                  </>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
