import { Section, Text } from "@react-email/components";
import { BUSINESS } from "@/content/catalog";
import { formatDayShort, waLink } from "@/lib/domain/format";
import { contactWilberText } from "@/lib/whatsapp/templates";
import { type BookingCtx, longDay, plain, time } from "./context";
import { Action, Band, EmailShell, Fields, Gap, Sheet, Title, text } from "./parts";

// Cambio o cancelación de salida. Cancelled: say so and how to pick another
// date. Changed: the departure as it is now, with Wilber's note.

export interface ChangeInfo {
  kind: "cancelada" | "cambio";
  /** What changed or why, in Wilber's words. */
  detail?: string;
}

export function changeOf(c: BookingCtx, change?: ChangeInfo): ChangeInfo {
  return change ?? { kind: c.departure.status === "cancelada" ? "cancelada" : "cambio", detail: c.departure.notes };
}

export function cambioSubject(c: BookingCtx, change: ChangeInfo) {
  return change.kind === "cancelada"
    ? `Salida cancelada · ${c.tour.shortName} ${formatDayShort(c.start)}`
    : `Cambio en tu reserva ${c.booking.code}`;
}

export function CambioSalida({ c, change }: { c: BookingCtx; change: ChangeInfo }) {
  const wa = waLink(BUSINESS.whatsapp, contactWilberText(c.booking.code));
  if (change.kind === "cancelada") {
    return (
      <EmailShell preview={`${c.tour.name}, ${longDay(c.start)}`} siteUrl={c.siteUrl}>
        <Sheet>
          <Title>Salida cancelada</Title>
          <Text style={text}>
            Wilber canceló {c.tour.name} del {longDay(c.start).toLowerCase()}, {time(c.start)}; tu boleto {c.booking.code} ({c.booking.partySize}{" "}
            {c.booking.partySize === 1 ? "persona" : "personas"}) queda sin efecto.
          </Text>
          {change.detail ? <Text style={{ ...text, marginTop: 12 }}>Motivo: {change.detail}</Text> : null}
        </Sheet>
        <Band>Escribile a Wilber por WhatsApp para elegir otra fecha.</Band>
        <Gap h={18} />
        <Section>
          <Action href={wa}>Escribir a Wilber</Action>

          <Action href={`${c.siteUrl}/aventuras/${c.tour.slug}#salidas`} quiet>
            Ver fechas
          </Action>
        </Section>
      </EmailShell>
    );
  }
  return (
    <EmailShell preview={`${c.tour.name}: ${longDay(c.start)}, ${time(c.start)}`} siteUrl={c.siteUrl}>
      <Sheet>
        <Title>Cambio en tu salida</Title>
        <Text style={{ ...text, fontWeight: 600 }}>{c.tour.name}</Text>
        {change.detail ? <Text style={{ ...text, marginTop: 8 }}>{change.detail}</Text> : null}
        <Fields
          items={[
            ["Fecha", longDay(c.start)],
            ["Salida", time(c.start)],
            ["Llegar a las", time(c.arrive)],
            ["Encuentro", c.point?.name ?? "Por confirmar"],
          ]}
        />
      </Sheet>
      <Gap h={18} />
      <Section>
        <Action href={c.ticketUrl}>Ver boleto</Action>

        <Action href={wa} quiet>
          Escribir a Wilber
        </Action>
      </Section>
    </EmailShell>
  );
}

export function cambioText(c: BookingCtx, change: ChangeInfo) {
  if (change.kind === "cancelada") {
    return plain([
      [`Salida cancelada · ${c.tour.name}`, `${longDay(c.start)}, ${time(c.start)} · boleto ${c.booking.code} sin efecto.`],
      change.detail ? `Motivo: ${change.detail}` : null,
      `Para elegir otra fecha, escribile a Wilber: ${waLink(BUSINESS.whatsapp, contactWilberText(c.booking.code))}`,
    ]);
  }
  return plain([
    [`Cambio en tu reserva ${c.booking.code}`, c.tour.name],
    change.detail ?? null,
    [`Fecha: ${longDay(c.start)}`, `Salida: ${time(c.start)}`, `Llegar a las: ${time(c.arrive)}`, c.point ? `Encuentro: ${c.point.name}, ${c.point.address}` : null],
    `Boleto: ${c.ticketUrl}`,
  ]);
}
