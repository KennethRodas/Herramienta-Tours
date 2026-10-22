import { Text } from "@react-email/components";
import { formatUsd } from "@/lib/domain/format";
import { type BookingCtx, longDay, plain, time } from "./context";
import { Action, CONDENSED, EmailShell, Fields, Gap, INK, Sheet, Title, small } from "./parts";

// Pago recibido: the deposit, its reference and what is left for the day.

export function pagoSubject(c: BookingCtx) {
  return `Pago recibido · ${c.booking.code}`;
}

export function Pago({ c }: { c: BookingCtx }) {
  const paid = c.booking.payment.amountUsd;
  return (
    <EmailShell preview={`${formatUsd(paid)} de anticipo para ${c.tour.name}`} siteUrl={c.siteUrl}>
      <Sheet>
        <Title>Pago recibido</Title>
        <Text style={small}>Anticipo</Text>
        <Text style={{ margin: 0, fontFamily: CONDENSED, fontSize: 56, lineHeight: "54px", fontWeight: 700, color: INK }}>{formatUsd(paid)}</Text>
        <Fields
          items={[
            ["Referencia", c.booking.payment.reference ?? "—"],
            ["Boleto", c.booking.code],
            ["Tour", c.tour.name],
            ["Fecha", `${longDay(c.start)}, ${time(c.start)}`],
            ["Total", formatUsd(c.total)],
            ["Saldo el día de la salida", formatUsd(Math.max(0, c.total - paid))],
          ]}
        />
      </Sheet>
      <Gap h={18} />
      <Action href={c.ticketUrl}>Ver boleto</Action>
    </EmailShell>
  );
}

export function pagoText(c: BookingCtx) {
  const paid = c.booking.payment.amountUsd;
  return plain([
    [`Pago recibido · ${c.booking.code}`, `Anticipo: ${formatUsd(paid)}`, c.booking.payment.reference ? `Referencia: ${c.booking.payment.reference}` : null],
    [`${c.tour.name}`, `${longDay(c.start)}, ${time(c.start)}`, `Total: ${formatUsd(c.total)}`, `Saldo el día de la salida: ${formatUsd(Math.max(0, c.total - paid))}`],
    `Boleto: ${c.ticketUrl}`,
  ]);
}
