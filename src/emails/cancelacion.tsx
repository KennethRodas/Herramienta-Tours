import { Section, Text } from "@react-email/components";
import { BUSINESS } from "@/content/catalog";
import { formatUsd, waLink } from "@/lib/domain/format";
import { contactWilberText } from "@/lib/whatsapp/templates";
import { type BookingCtx, longDay, plain, time } from "./context";
import { Action, Band, EmailShell, Fields, Gap, Sheet, Title, text } from "./parts";

// The visitor cancelled from the ticket: what was cancelled, that the seats are
// free again, and how to book another date (or get a paid deposit back).

const people = (n: number) => `${n} ${n === 1 ? "persona" : "personas"}`;

export const cancelacionSubject = (c: BookingCtx) => `Reserva cancelada · ${c.booking.code}`;

export function Cancelacion({ c }: { c: BookingCtx }) {
  const wa = waLink(BUSINESS.whatsapp, contactWilberText(c.booking.code));
  const paid = c.booking.payment.status === "aprobado";
  return (
    <EmailShell preview={`${c.tour.name}, ${longDay(c.start)}`} siteUrl={c.siteUrl}>
      <Sheet>
        <Title>Reserva cancelada</Title>
        <Text style={text}>
          Cancelaste el boleto {c.booking.code}. Los cupos quedaron libres para otras personas.
        </Text>
        <Fields
          items={[
            ["Aventura", c.tour.name],
            ["Fecha", `${longDay(c.start)}, ${time(c.start)}`],
            ["Personas", people(c.booking.partySize)],
          ]}
        />
      </Sheet>
      <Gap h={8} />
      <Band>
        {paid
          ? `Pagaste ${formatUsd(c.booking.payment.amountUsd)} de anticipo: escribile a Wilber por WhatsApp para coordinar la devolución.`
          : "Para elegir otra fecha, mirá las salidas o escribile a Wilber por WhatsApp."}
      </Band>
      <Gap h={18} />
      <Section>
        <Action href={`${c.siteUrl}/aventuras/${c.tour.slug}#salidas`}>Ver fechas</Action>

        <Action href={wa} quiet>
          Escribir a Wilber
        </Action>
      </Section>
    </EmailShell>
  );
}

export function cancelacionText(c: BookingCtx) {
  const paid = c.booking.payment.status === "aprobado";
  return plain([
    [`Reserva cancelada · ${c.booking.code}`, `${c.tour.name}, ${longDay(c.start)}, ${time(c.start)} · ${people(c.booking.partySize)}.`],
    "Los cupos quedaron libres para otras personas.",
    paid ? `Pagaste ${formatUsd(c.booking.payment.amountUsd)} de anticipo: escribile a Wilber para coordinar la devolución.` : null,
    [`Otras fechas: ${c.siteUrl}/aventuras/${c.tour.slug}#salidas`, `Wilber por WhatsApp: ${waLink(BUSINESS.whatsapp, contactWilberText(c.booking.code))}`],
  ]);
}
