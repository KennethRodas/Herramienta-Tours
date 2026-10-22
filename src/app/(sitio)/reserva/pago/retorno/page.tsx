import type { Metadata } from "next";
import { PaymentReturn, type ReturnQuery } from "@/components/booking/payment-return";

export const metadata: Metadata = {
  title: "Pago en línea",
  robots: { index: false, follow: false },
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const KEYS = ["idTransaccion", "identificadorEnlaceComercio", "monto", "hash"] as const;

export default async function PaymentReturnPage({ searchParams }: Props) {
  const raw = await searchParams;
  const query: ReturnQuery = {};
  for (const k of KEYS) {
    const v = raw[k];
    if (typeof v === "string" && v) query[k] = v;
  }
  return (
    <div className="pb-[calc(7rem+env(safe-area-inset-bottom))] lg:pb-32">
      <PaymentReturn query={query} />
    </div>
  );
}
