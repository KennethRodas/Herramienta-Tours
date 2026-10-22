import type { Metadata } from "next";
import { BookingLookup } from "@/components/booking/booking-lookup";

export const metadata: Metadata = {
  title: "Buscar reserva",
  description: "Abrí tu boleto con el código WIL- o buscá las reservas de tu número de WhatsApp.",
  robots: { index: false, follow: true },
};

export default function LookupPage() {
  return (
    <div className="pb-[calc(7rem+env(safe-area-inset-bottom))] lg:pb-32">
      <BookingLookup />
    </div>
  );
}
