import { NextResponse } from "next/server";
import { renderEmail, type EmailKind } from "@/emails/render";
import { emailTestAddresses, integrations, siteUrlFromRequest } from "@/lib/integrations/config";
import { sendEmail } from "@/lib/integrations/email";
import type { Booking, Departure } from "@/lib/domain/types";

export const dynamic = "force-dynamic";

/** Real email delivery for the simulator; only EMAIL_TEST_ADDRESSES can receive. */
export async function POST(req: Request) {
  if (!integrations.email) return NextResponse.json({ ok: false, error: "Correo sin configurar" }, { status: 503 });
  const body = (await req.json().catch(() => null)) as { to?: string; kind?: EmailKind; booking?: Booking; departure?: Departure } | null;
  const to = body?.to?.trim().toLowerCase();
  if (!to || !body?.kind) return NextResponse.json({ ok: false, error: "Datos inválidos" }, { status: 400 });
  if (!emailTestAddresses().includes(to)) return NextResponse.json({ ok: false, error: "Ese correo no está en EMAIL_TEST_ADDRESSES" }, { status: 403 });
  const email = await renderEmail(body.kind, { booking: body.booking, departure: body.departure, siteUrl: siteUrlFromRequest(req) });
  const result = await sendEmail({ to, subject: email.subject, html: email.html, text: email.text });
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
