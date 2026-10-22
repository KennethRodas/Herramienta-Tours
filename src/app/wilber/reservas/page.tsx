import type { Metadata } from "next";
import { ReservasScreen } from "@/components/dashboard/screens/reservas";

export const metadata: Metadata = { title: "Reservas" };

export default async function ReservasPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
  return <ReservasScreen estado={one(sp.estado)} tour={one(sp.tour)} q={one(sp.q)} />;
}
