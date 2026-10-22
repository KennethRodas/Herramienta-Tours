import { NextResponse } from "next/server";
import { renderEmail, type EmailData, type EmailKind } from "@/emails/render";
import { siteUrlFromRequest } from "@/lib/integrations/config";

export const dynamic = "force-dynamic";

const KINDS: EmailKind[] = ["confirmacion", "recordatorio_24h", "wilber_resumen", "pago", "cambio_salida"];

/** Renders a branded email to HTML for the simulator inbox and previews. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { kind?: EmailKind; data?: Omit<EmailData, "siteUrl"> } | null;
  if (!body?.kind || !KINDS.includes(body.kind)) return NextResponse.json({ error: "Tipo de correo inválido" }, { status: 400 });
  const rendered = await renderEmail(body.kind, { ...(body.data ?? {}), siteUrl: siteUrlFromRequest(req) });
  return NextResponse.json(rendered);
}
