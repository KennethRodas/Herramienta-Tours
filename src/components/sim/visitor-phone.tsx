"use client";

import { useMemo, useState } from "react";
import { WhatsAppPhone } from "@/components/whatsapp/phone";
import { useBookings, useMessages, useNow } from "@/lib/sim/hooks";
import { sim } from "@/lib/sim/store";
import { BUSINESS, tourById } from "@/content/catalog";
import { formatPhone } from "@/lib/domain/format";
import { cn } from "@/lib/utils";

/** The phone of one visitor: pick a booking, read what Wilber's number sent them, answer. */
export function VisitorPhone({ className }: { className?: string }) {
  const bookings = useBookings((b) => b.status !== "cancelada");
  const now = useNow(2000);
  const [picked, setPicked] = useState<string | null>(null);
  const all = useMessages((m) => m.channel === "whatsapp");
  // Bookings whose phone already got messages first: the demo opens on a live conversation.
  const recent = useMemo(() => {
    const texted = new Set((all ?? []).map((m) => m.to));
    const list = bookings ?? [];
    return [...list.filter((b) => texted.has(b.phone)), ...list.filter((b) => !texted.has(b.phone))].slice(0, 30);
  }, [bookings, all]);
  const current = recent.find((b) => b.id === picked) ?? recent[0];
  const phone = current?.phone ?? "";
  const messages = useMemo(() => (all ?? []).filter((m) => m.to === phone || m.from === phone), [all, phone]);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <label className="font-sans">
        <span className="mb-1 block text-[14px] font-semibold text-cobalt-200">Teléfono de</span>
        <select
          value={current?.id ?? ""}
          onChange={(e) => setPicked(e.target.value)}
          className="h-11 w-full rounded-full bg-cobalt-900 px-4 text-[16px] text-sand-50"
        >
          {recent.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} · {b.code} · {tourById(b.tourId)?.shortName}
            </option>
          ))}
        </select>
      </label>
      <WhatsAppPhone
        title={`${BUSINESS.name} · Reservas`}
        subtitle={BUSINESS.whatsappDisplay}
        messages={messages}
        owner={phone}
        now={now}
        onSend={phone ? (t) => void sim.customerSays(phone, t) : undefined}
        suggestions={["Salidas", "Qué llevar", current?.code ?? "WIL-"]}
        placeholder={phone ? `Escribir como ${formatPhone(phone)}` : "Mensaje"}
        emptyText="Las confirmaciones y recordatorios de esta reserva aparecen aquí."
      />
    </div>
  );
}
