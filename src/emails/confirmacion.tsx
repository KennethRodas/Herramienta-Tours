import { Link, Section, Text } from "@react-email/components";
import { formatDayShort } from "@/lib/domain/format";
import { type BookingCtx, longDay, paymentText, plain, time } from "./context";
import { Action, Band, Boleto, EmailShell, Gap, INK, Sheet, Title, text } from "./parts";

// Confirmación: the boleto itself, the meeting point and the link to the ticket.

export function confirmacionSubject(c: BookingCtx) {
  return `Tu boleto ${c.booking.code} · ${c.tour.name}, ${formatDayShort(c.start)}`;
}

export function Confirmacion({ c }: { c: BookingCtx }) {
  const pending = c.booking.payment.method === "wompi" && c.booking.payment.status === "pendiente";
  return (
    <EmailShell preview={`${longDay(c.start)}, ${time(c.start)} · ${c.point?.name ?? c.tour.name}`} siteUrl={c.siteUrl}>
      <Boleto
        code={c.booking.code}
        title={c.tour.name}
        stubLabel="Personas"
        stubValue={String(c.booking.partySize)}
        items={[
          ["Fecha", longDay(c.start)],
          ["Salida", time(c.start)],
          ["Llegar a las", time(c.arrive)],
          ["Encuentro", c.point?.name ?? "Por confirmar"],
        ]}
      />
      <Band tone={pending ? "sand" : "ink"}>{paymentText(c)}</Band>
      <Gap h={14} />
      {c.point ? (
        <Sheet>
          <Title>Punto de encuentro</Title>
          <Text style={{ ...text, fontWeight: 600 }}>{c.point.name}</Text>
          <Text style={text}>
            {c.point.address}, {c.point.city}
          </Text>
          <Text style={{ ...text, marginTop: 8 }}>{c.point.instructions}</Text>
          <Text style={{ ...text, marginTop: 12 }}>
            <Link href={c.point.mapsUrl} style={{ color: INK, fontWeight: 600, textDecoration: "underline" }}>
              Cómo llegar
            </Link>
          </Text>
        </Sheet>
      ) : null}
      <Gap h={18} />
      <Section style={{ padding: "0 0" }}>
        <Action href={c.ticketUrl}>Ver boleto</Action>
        {pending ? (
          <Action href={`${c.siteUrl}/reserva/pago?reserva=${c.booking.id}`} quiet>
            Pagar anticipo
          </Action>
        ) : null}
      </Section>
    </EmailShell>
  );
}

export function confirmacionText(c: BookingCtx) {
  return plain([
    [`Boleto ${c.booking.code}`, c.tour.name],
    [
      `Fecha: ${longDay(c.start)}`,
      `Salida: ${time(c.start)}`,
      `Llegar a las: ${time(c.arrive)}`,
      `Personas: ${c.booking.partySize}`,
      paymentText(c),
    ],
    c.point ? [`Punto de encuentro: ${c.point.name}`, `${c.point.address}, ${c.point.city}`, c.point.instructions, `Cómo llegar: ${c.point.mapsUrl}`] : null,
    `Boleto: ${c.ticketUrl}`,
  ]);
}
