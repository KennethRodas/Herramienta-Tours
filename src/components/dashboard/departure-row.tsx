"use client";

import { ChevronRight, Lock } from "lucide-react";
import { GUIDES, VEHICLES } from "@/content/catalog";
import { needsTransport } from "@/lib/domain/conflicts";
import type { DepartureView } from "@/lib/sim/hooks";
import type { Tour } from "@/lib/domain/types";
import { formatTime24 } from "@/lib/domain/format";
import { cn } from "@/lib/utils";
import { guideShort, vehicleShort } from "./lib";
import { DepartureTag, SeatMeter } from "./ui";

/** One departure as a line of the day sheet: time, ref, people, who drives and who guides. */
export function DepartureRow({
  dep,
  tour,
  refCode,
  crossed,
  onOpen,
  showDay,
  className,
}: {
  dep: DepartureView;
  tour: Tour | undefined;
  refCode: string;
  crossed?: boolean;
  onOpen: () => void;
  showDay?: string;
  className?: string;
}) {
  const guide = GUIDES.find((g) => g.id === dep.guideId);
  const vehicle = VEHICLES.find((v) => v.id === dep.vehicleId);
  const cancelled = dep.status === "cancelada";
  const full = dep.state === "llena";
  // Tours that meet on location (Juayúa, Suchitoto, El Tunco) do not take the microbus.
  const onSiteMissing = tour ? needsTransport(tour) : true;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "pressable group relative flex w-full items-stretch gap-3 bg-paper py-3 pr-2 pl-3 text-left text-paper-ink hover:bg-surface-2",
        cancelled && "opacity-60",
        className,
      )}
    >
      {crossed ? <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-destructive" /> : null}
      <span className="flex w-[58px] shrink-0 flex-col justify-center">
        {showDay ? <span className="text-[12px] font-semibold uppercase text-ink-soft">{showDay}</span> : null}
        <span className={cn("font-display text-[24px] font-bold leading-none tabular", cancelled && "line-through")}>{formatTime24(dep.startsAt)}</span>
      </span>
      <span className="flex min-w-0 flex-1 flex-col justify-center gap-1">
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="font-display text-[19px] font-bold uppercase leading-none">{refCode}</span>
          <span className="truncate text-[16px] font-semibold leading-tight">{tour?.shortName}</span>
          {dep.status === "cerrada" ? <Lock className="size-3.5 shrink-0 text-ink-soft" aria-label="Venta cerrada" /> : null}
        </span>
        <span className="flex min-w-0 items-center gap-1.5 text-[14px] leading-tight text-ink-soft">
          <span className={cn("truncate", !guide && !cancelled && "font-semibold text-destructive")}>{guide ? guideShort(guide.name) : "Sin guía"}</span>
          <span aria-hidden>·</span>
          <span className={cn("truncate", !vehicle && onSiteMissing && !cancelled && "font-semibold text-destructive")}>
            {vehicle ? vehicleShort(vehicle.name) : onSiteMissing ? "Sin vehículo" : "En el lugar"}
          </span>
        </span>
      </span>
      <span className="flex w-[84px] shrink-0 flex-col items-end justify-center gap-1.5">
        {cancelled || full ? (
          <DepartureTag state={dep.state} className="text-[12px]" />
        ) : (
          <span className="text-[15px] font-semibold tabular">
            {dep.seatsTaken}/{dep.capacity}
          </span>
        )}
        {!cancelled ? <SeatMeter taken={dep.seatsTaken} capacity={dep.capacity} tone={full ? "stamp" : "ink"} className="w-full" /> : null}
      </span>
      <ChevronRight className="size-5 shrink-0 self-center text-ink-soft transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
    </button>
  );
}
