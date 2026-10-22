import type { CSSProperties, ReactNode } from "react";
import { Body, Button, Column, Container, Head, Html, Img, Link, Preview, Row, Section, Text } from "@react-email/components";
import { BUSINESS } from "@/content/catalog";

// Building blocks of Wilber's emails: sand page, cobalt ink, the boleto as a
// two-cell table with a dotted tear line. Email clients ignore CSS variables
// and most of CSS, so the brand colours are written out here, once.

export const INK = "#062b8a";
export const INK_SOFT = "#3a5aa8";
export const SAND = "#e6dbc7";
export const PAPER = "#f4eee3";
export const SAND_300 = "#ddd0b9";
export const STAMP = "#c4352a";

export const SANS = "'Barlow', Arial, Helvetica, sans-serif";
export const CONDENSED = "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif";

export const text: CSSProperties = { margin: 0, fontFamily: SANS, fontSize: 16, lineHeight: "24px", color: INK };
export const small: CSSProperties = { margin: 0, fontFamily: SANS, fontSize: 13, lineHeight: "18px", color: INK_SOFT };
export const label: CSSProperties = { ...small, paddingBottom: 2 };
export const value: CSSProperties = { margin: 0, fontFamily: SANS, fontSize: 17, lineHeight: "22px", fontWeight: 600, color: INK };

export function EmailShell({ preview, siteUrl, children }: { preview: string; siteUrl: string; children: ReactNode }) {
  return (
    <Html lang="es">
      <Head>
        <meta name="color-scheme" content="light only" />
        <meta name="supported-color-schemes" content="light" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        {/* An email document, not a Next page: the font link belongs in its own <head>. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;600&family=Barlow+Condensed:wght@600;700&display=swap" rel="stylesheet" />
      </Head>
      <Preview>{preview}</Preview>
      <Body style={{ margin: 0, padding: "24px 0", backgroundColor: SAND, fontFamily: SANS, color: INK }}>
        <Container style={{ width: "100%", maxWidth: 600, margin: "0 auto" }}>
          <Section style={{ padding: "0 20px 18px" }}>
            <Row>
              <Column style={{ width: 44, verticalAlign: "middle" }}>
                <Img src={`${siteUrl}/apple-icon.png`} width={36} height={36} alt="" style={{ display: "block" }} />
              </Column>
              <Column style={{ verticalAlign: "middle" }}>
                <Text style={{ margin: 0, fontFamily: CONDENSED, fontSize: 24, lineHeight: "24px", fontWeight: 700, textTransform: "uppercase", color: INK }}>Wilber</Text>
                <Text style={{ ...small, color: INK }}>Tours de aventura</Text>
              </Column>
            </Row>
          </Section>
          {children}
          <Section style={{ padding: "22px 20px 0" }}>
            <Text style={small}>
              {BUSINESS.legalName} · WhatsApp{" "}
              <Link href={`https://wa.me/${BUSINESS.whatsapp}`} style={{ color: INK_SOFT, textDecoration: "underline" }}>
                {BUSINESS.whatsappDisplay}
              </Link>{" "}
              ·{" "}
              <Link href={`mailto:${BUSINESS.email}`} style={{ color: INK_SOFT, textDecoration: "underline" }}>
                {BUSINESS.email}
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

/** A sheet of paper with the content set inside. */
export function Sheet({ children, padding = "28px 28px 30px" }: { children: ReactNode; padding?: string }) {
  return (
    <Section style={{ backgroundColor: PAPER, padding }}>
      {children}
    </Section>
  );
}

/** Title in the condensed face, capitals, like the site's section labels. */
export function Title({ children }: { children: ReactNode }) {
  return <Text style={{ margin: "0 0 14px", fontFamily: CONDENSED, fontSize: 30, lineHeight: "30px", fontWeight: 700, textTransform: "uppercase", color: INK }}>{children}</Text>;
}

/** Label/value pairs, two per row. */
export function Fields({ items }: { items: [string, ReactNode][] }) {
  const rows: [string, ReactNode][][] = [];
  for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2));
  return (
    <>
      {rows.map((pair) => (
        <Row key={pair.map((p) => p[0]).join("|")} style={{ marginTop: 14 }}>
          {pair.map(([k, v]) => (
            <Column key={k} style={{ width: "50%", verticalAlign: "top", paddingRight: 12 }}>
              <Text style={label}>{k}</Text>
              <Text style={value}>{v}</Text>
            </Column>
          ))}
          {pair.length === 1 ? <Column style={{ width: "50%" }} /> : null}
        </Row>
      ))}
    </>
  );
}

/**
 * The boleto: body on the left, stub on the right behind a dotted tear line.
 * On narrow clients the table keeps its two cells; the stub is narrow on purpose.
 */
export function Boleto({ code, title, items, stubLabel, stubValue }: { code: string; title: string; items: [string, ReactNode][]; stubLabel: string; stubValue: string }) {
  return (
    <Section style={{ backgroundColor: PAPER }}>
      <Row>
        <Column style={{ padding: "26px 22px 26px 26px", verticalAlign: "top" }}>
          <Text style={{ margin: 0, fontFamily: CONDENSED, fontSize: 52, lineHeight: "50px", fontWeight: 700, letterSpacing: "-0.01em", color: INK }}>{code}</Text>
          <Text style={{ margin: "10px 0 0", fontFamily: SANS, fontSize: 19, lineHeight: "24px", fontWeight: 600, color: INK }}>{title}</Text>
          <Fields items={items} />
        </Column>
        <Column style={{ width: 132, padding: "26px 18px", verticalAlign: "top", borderLeft: `3px dotted ${SAND}` }}>
          <Text style={label}>{stubLabel}</Text>
          <Text style={{ margin: 0, fontFamily: CONDENSED, fontSize: 34, lineHeight: "34px", fontWeight: 700, color: INK }}>{stubValue}</Text>
        </Column>
      </Row>
    </Section>
  );
}

export function Action({ href, children, quiet }: { href: string; children: ReactNode; quiet?: boolean }) {
  return (
    <Button
      href={href}
      style={{
        display: "inline-block",
        margin: "0 8px 8px 0",
        backgroundColor: quiet ? SAND_300 : INK,
        color: quiet ? INK : PAPER,
        fontFamily: SANS,
        fontSize: 16,
        fontWeight: 600,
        lineHeight: "20px",
        padding: "15px 24px",
        borderRadius: 0,
        textDecoration: "none",
      }}
    >
      {children}
    </Button>
  );
}

export function Gap({ h = 16 }: { h?: number }) {
  return <Section style={{ height: h, lineHeight: `${h}px`, fontSize: 1 }}>&nbsp;</Section>;
}

/** Sent when a booking email is asked for without its data. */
export function Fallback({ title, line, siteUrl }: { title: string; line: string; siteUrl: string }) {
  return (
    <EmailShell preview={line} siteUrl={siteUrl}>
      <Sheet>
        <Title>{title}</Title>
        <Text style={text}>{line}</Text>
      </Sheet>
    </EmailShell>
  );
}

/** A tone-step band for one line of status ("Anticipo pendiente", a warning). */
export function Band({ children, tone = "sand" }: { children: ReactNode; tone?: "sand" | "ink" | "stamp" }) {
  const bg = tone === "ink" ? INK : tone === "stamp" ? STAMP : SAND_300;
  const fg = tone === "sand" ? INK : PAPER;
  return (
    <Section style={{ backgroundColor: bg, padding: "14px 26px" }}>
      <Text style={{ ...text, color: fg }}>{children}</Text>
    </Section>
  );
}
