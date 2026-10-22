import type { Metadata } from "next";
import { TOURS } from "@/content/catalog";
import { formatDayShort, svISO } from "@/lib/domain/format";
import { DepartureBooking } from "@/components/booking/departure-booking";
import { DevDataToggle } from "@/components/booking/dev-data-toggle";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// Departures live in the simulation (client). The id carries tour code and
// date ("d-sa-2026-10-24"), enough for a useful title before data loads.
function describe(id: string) {
  const m = /^d-([a-z]{2})-(\d{4}-\d{2}-\d{2})/.exec(id);
  if (!m) return null;
  const tour = TOURS.find((t) => t.code.toLowerCase() === m[1]);
  if (!tour) return null;
  return { tour, day: formatDayShort(svISO(m[2], tour.departureTime)) };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const d = describe(id);
  return {
    title: d ? `${d.tour.name}, ${d.day}` : "Salida",
    description: d ? `Reservá cupos para ${d.tour.name} el ${d.day}.` : undefined,
    robots: { index: false, follow: true },
  };
}

export default async function DeparturePage({ params, searchParams }: Props) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const dev = process.env.NODE_ENV !== "production";
  const worst = dev && query.data === "peor";
  return (
    <div className="pb-[calc(7rem+env(safe-area-inset-bottom))] lg:pb-32">
      {dev ? <DevDataToggle worst={worst} /> : null}
      <DepartureBooking id={id} worst={worst} />
    </div>
  );
}
