import type { Metadata } from "next";
import { normalizeCode } from "@/lib/domain/availability";
import { DevDataToggle } from "@/components/booking/dev-data-toggle";
import { TicketView } from "@/components/booking/ticket-view";

type Props = {
  params: Promise<{ codigo: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { codigo } = await params;
  return {
    title: `Boleto ${normalizeCode(decodeURIComponent(codigo))}`,
    robots: { index: false, follow: false },
  };
}

export default async function TicketPage({ params, searchParams }: Props) {
  const [{ codigo }, query] = await Promise.all([params, searchParams]);
  const pago = typeof query.pago === "string" ? query.pago : undefined;
  const dev = process.env.NODE_ENV !== "production";
  const worst = dev && query.data === "peor";
  return (
    <div className="pb-[calc(7rem+env(safe-area-inset-bottom))] lg:pb-32">
      {dev ? <DevDataToggle worst={worst} /> : null}
      <TicketView code={codigo} fresh={query.nueva === "1"} payment={pago} worst={worst} cancel={query.cancelar === "1"} />
    </div>
  );
}
