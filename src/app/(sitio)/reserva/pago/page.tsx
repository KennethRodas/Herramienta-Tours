import type { Metadata } from "next";
import { PaymentSim } from "@/components/booking/payment-sim";

export const metadata: Metadata = {
  title: "Anticipo",
  robots: { index: false, follow: false },
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function PaymentPage({ searchParams }: Props) {
  const query = await searchParams;
  const reserva = typeof query.reserva === "string" ? query.reserva : undefined;
  return (
    <div className="pb-[calc(7rem+env(safe-area-inset-bottom))] lg:pb-32">
      <PaymentSim bookingId={reserva} />
    </div>
  );
}
