"use client";

import { formatUsd, plural } from "@/lib/domain/format";
import { useTours } from "@/lib/sim/hooks";

/** "12 aventuras de $20 a $60", following Wilber's live catalog. */
export function CatalogSummary() {
  const tours = useTours();
  if (tours.length === 0) return <>Sin aventuras por ahora</>;
  const prices = tours.map((t) => t.priceUsd);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return (
    <>
      {plural(tours.length, "aventura", "aventuras")} {min === max ? `a ${formatUsd(min)}` : `de ${formatUsd(min)} a ${formatUsd(max)}`}
    </>
  );
}
