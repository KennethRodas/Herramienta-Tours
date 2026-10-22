import { Column, Link, Row, Text } from "@react-email/components";
import { simForecast } from "@/lib/domain/weather";
import { type BookingCtx, longDay, plain, time } from "./context";
import { Action, Band, EmailShell, Fields, Gap, INK, Sheet, Title, small, text } from "./parts";

// Recordatorio 24 h: when and where, what to bring, the weather line.

export function recordatorioSubject(c: BookingCtx) {
  return `Mañana: ${c.tour.name} · qué llevar`;
}

export function Recordatorio({ c }: { c: BookingCtx }) {
  const weather = simForecast(c.tour, c.departure.startsAt);
  return (
    <EmailShell preview={`Salida ${time(c.start)}, llegar a las ${time(c.arrive)}`} siteUrl={c.siteUrl}>
      <Sheet>
        <Title>Mañana, {time(c.start)}</Title>
        <Text style={{ ...text, fontWeight: 600 }}>{c.tour.name}</Text>
        <Fields
          items={[
            ["Llegar a las", time(c.arrive)],
            ["Encuentro", c.point?.name ?? "Por confirmar"],
            ["Boleto", c.booking.code],
            ["Personas", String(c.booking.partySize)],
          ]}
        />
        {c.point ? (
          <Text style={{ ...text, marginTop: 14 }}>
            {c.point.address}, {c.point.city}. {c.point.instructions}{" "}
            <Link href={c.point.mapsUrl} style={{ color: INK, fontWeight: 600, textDecoration: "underline" }}>
              Cómo llegar
            </Link>
          </Text>
        ) : null}
      </Sheet>
      <Band tone="ink">Clima: {weather.summary}</Band>
      <Gap h={14} />
      <Sheet>
        <Title>Qué llevar</Title>
        {c.tour.bring.map((item) => (
          <Row key={item} style={{ marginTop: 6 }}>
            <Column style={{ width: 22, verticalAlign: "top", paddingTop: 7 }}>
              <div style={{ width: 9, height: 9, backgroundColor: INK }} />
            </Column>
            <Column>
              <Text style={text}>{item}</Text>
            </Column>
          </Row>
        ))}
        {c.departure.notes ? <Text style={{ ...small, marginTop: 16, color: INK }}>Nota de Wilber: {c.departure.notes}</Text> : null}
      </Sheet>
      <Gap h={18} />
      <Action href={c.ticketUrl}>Ver boleto</Action>
    </EmailShell>
  );
}

export function recordatorioText(c: BookingCtx) {
  const weather = simForecast(c.tour, c.departure.startsAt);
  return plain([
    [`Mañana: ${c.tour.name}`, `${longDay(c.start)} · salida ${time(c.start)} · llegar a las ${time(c.arrive)}`],
    c.point ? [`Encuentro: ${c.point.name}`, `${c.point.address}, ${c.point.city}`, c.point.instructions, `Cómo llegar: ${c.point.mapsUrl}`] : null,
    `Clima: ${weather.summary}`,
    ["Qué llevar:", ...c.tour.bring.map((b) => `- ${b}`)],
    c.departure.notes ? `Nota de Wilber: ${c.departure.notes}` : null,
    `Boleto ${c.booking.code}: ${c.ticketUrl}`,
  ]);
}
