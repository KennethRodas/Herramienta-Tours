import { Column, Row, Section, Text } from "@react-email/components";
import type { Booking, Departure } from "@/lib/domain/types";
import { guideById, meetingPointById, tourById, vehicleById } from "@/content/catalog";
import { formatDayLong, formatPhone, formatUsd, plural } from "@/lib/domain/format";
import { plain, time } from "./context";
import { CONDENSED, EmailShell, Gap, INK, INK_SOFT, PAPER, SAND, SAND_300, Sheet, Title, label, small, text } from "./parts";

// Resumen diario para Wilber: tomorrow's departures, who comes, how many.

export type Digest = { departure: Departure; bookings: Booking[] }[];

const live = (b: Booking) => b.status !== "cancelada" && b.status !== "no_show";

const payLabel = (b: Booking) =>
  b.payment.method === "wompi" ? (b.payment.status === "aprobado" ? `Anticipo ${formatUsd(b.payment.amountUsd)}` : "Anticipo pendiente") : "En la salida";

function totals(digest: Digest) {
  const deps = digest.filter((d) => d.departure.status !== "cancelada");
  const people = deps.reduce((n, d) => n + d.bookings.filter(live).reduce((m, b) => m + b.partySize, 0), 0);
  return { deps, people };
}

export function resumenSubject(digest: Digest) {
  const { deps, people } = totals(digest);
  return deps.length ? `Mañana: ${plural(deps.length, "salida", "salidas")}, ${plural(people, "persona", "personas")}` : "Mañana no hay salidas";
}

export function ResumenWilber({ digest, siteUrl }: { digest: Digest; siteUrl: string }) {
  const { deps, people } = totals(digest);
  const sorted = [...deps].sort((a, b) => Date.parse(a.departure.startsAt) - Date.parse(b.departure.startsAt));
  const day = sorted[0] ? formatDayLong(sorted[0].departure.startsAt) : null;
  return (
    <EmailShell preview={resumenSubject(digest)} siteUrl={siteUrl}>
      <Sheet>
        <Title>Mañana{day ? `, ${day}` : ""}</Title>
        <Text style={text}>{deps.length ? `${plural(deps.length, "salida", "salidas")} · ${plural(people, "persona", "personas")}` : "No hay salidas programadas."}</Text>
      </Sheet>
      {sorted.map(({ departure, bookings }) => {
        const tour = tourById(departure.tourId);
        const point = meetingPointById(departure.meetingPointId);
        const guide = guideById(departure.guideId);
        const vehicle = vehicleById(departure.vehicleId);
        const list = bookings.filter(live);
        const seats = list.reduce((n, b) => n + b.partySize, 0);
        return (
          <Section key={departure.id}>
            <Gap h={12} />
            <Section style={{ backgroundColor: INK, padding: "16px 24px" }}>
              <Row>
                <Column style={{ verticalAlign: "bottom" }}>
                  <Text style={{ margin: 0, fontFamily: CONDENSED, fontSize: 26, lineHeight: "26px", fontWeight: 700, textTransform: "uppercase", color: PAPER }}>
                    {time(departure.startsAt)} · {tour?.shortName ?? "Salida"}
                  </Text>
                  <Text style={{ ...small, color: SAND, marginTop: 4 }}>
                    {point?.name ?? "Encuentro por confirmar"} · {guide ? `Guía ${guide.name}` : "Sin guía"} · {vehicle ? vehicle.name : "Sin microbús"}
                  </Text>
                </Column>
                <Column style={{ width: 92, verticalAlign: "bottom", textAlign: "right" }}>
                  <Text style={{ margin: 0, fontFamily: CONDENSED, fontSize: 26, lineHeight: "26px", fontWeight: 700, color: PAPER }}>
                    {seats}/{departure.capacity}
                  </Text>
                </Column>
              </Row>
            </Section>
            <Section style={{ backgroundColor: PAPER, padding: "6px 24px 14px" }}>
              {list.length === 0 ? (
                <Text style={{ ...text, paddingTop: 10 }}>Sin reservas.</Text>
              ) : (
                list.map((b) => (
                  <Row key={b.id} style={{ borderBottom: `1px solid ${SAND_300}` }}>
                    <Column style={{ padding: "10px 8px 10px 0", verticalAlign: "top" }}>
                      <Text style={{ ...text, fontWeight: 600 }}>{b.name}</Text>
                      <Text style={small}>
                        {b.code} · {formatPhone(b.phone)}
                      </Text>
                    </Column>
                    <Column style={{ width: 70, padding: "10px 8px", verticalAlign: "top", textAlign: "right" }}>
                      <Text style={label}>Personas</Text>
                      <Text style={{ ...text, fontWeight: 600 }}>{b.partySize}</Text>
                    </Column>
                    <Column style={{ width: 130, padding: "10px 0 10px 8px", verticalAlign: "top", textAlign: "right" }}>
                      <Text style={label}>Pago</Text>
                      <Text style={{ ...small, color: INK }}>{payLabel(b)}</Text>
                    </Column>
                  </Row>
                ))
              )}
            </Section>
          </Section>
        );
      })}
      <Gap h={18} />
      <Text style={{ ...small, color: INK_SOFT }}>Panel: {siteUrl}/wilber/salidas</Text>
    </EmailShell>
  );
}

export function resumenText(digest: Digest, siteUrl: string) {
  const { deps, people } = totals(digest);
  if (!deps.length) return plain(["Mañana no hay salidas programadas.", `Panel: ${siteUrl}/wilber/salidas`]);
  const sorted = [...deps].sort((a, b) => Date.parse(a.departure.startsAt) - Date.parse(b.departure.startsAt));
  return plain([
    `Mañana, ${formatDayLong(sorted[0].departure.startsAt)}: ${plural(deps.length, "salida", "salidas")}, ${plural(people, "persona", "personas")}.`,
    ...sorted.map(({ departure, bookings }) => {
      const tour = tourById(departure.tourId);
      const point = meetingPointById(departure.meetingPointId);
      const list = bookings.filter(live);
      const seats = list.reduce((n, b) => n + b.partySize, 0);
      return [
        `${time(departure.startsAt)} · ${tour?.shortName ?? "Salida"} · ${seats}/${departure.capacity} · ${point?.name ?? ""}`,
        ...(list.length ? list.map((b) => `- ${b.name} (${b.partySize}) ${formatPhone(b.phone)} · ${payLabel(b)} · ${b.code}`) : ["- Sin reservas."]),
      ];
    }),
    `Panel: ${siteUrl}/wilber/salidas`,
  ]);
}
