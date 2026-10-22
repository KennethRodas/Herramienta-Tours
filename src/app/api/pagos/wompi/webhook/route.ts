import { NextResponse } from "next/server";
import { integrations } from "@/lib/integrations/config";
import { verifyWebhookHash } from "@/lib/integrations/wompi";
import { serviceClient } from "@/lib/supabase/bot-data";

export const dynamic = "force-dynamic";

/**
 * Wompi → our app after a successful payment. Header `wompi_hash` must match
 * HMAC-SHA256(raw body, client secret). With Supabase, the booking whose code
 * equals EnlacePago.IdentificadorEnlaceComercio is marked as paid.
 */
export async function POST(req: Request) {
  if (!integrations.wompi) return NextResponse.json({ ok: false }, { status: 503 });
  const raw = await req.text();
  if (!verifyWebhookHash(raw, req.headers.get("wompi_hash"))) return NextResponse.json({ ok: false }, { status: 401 });
  const event = JSON.parse(raw) as {
    IdTransaccion?: string;
    ResultadoTransaccion?: string;
    Monto?: number;
    EsProductiva?: boolean;
    EnlacePago?: { IdentificadorEnlaceComercio?: string };
  };
  const code = event.EnlacePago?.IdentificadorEnlaceComercio;
  const approved = event.ResultadoTransaccion === "ExitosaAprobada";
  const db = serviceClient();
  if (db && code) {
    await db
      .from("bookings")
      .update({
        payment_status: approved ? "aprobado" : "rechazado",
        payment_reference: event.IdTransaccion ?? null,
        status: approved ? "pagada" : "confirmada",
      })
      .eq("code", code);
    await db.from("events").insert({
      type: approved ? "pago.aprobado" : "pago.rechazado",
      actor: "sistema",
      summary: `Wompi ${approved ? "aprobó" : "rechazó"} el pago de ${code} (${event.Monto ?? "?"} USD).`,
      data: event,
    });
  }
  return NextResponse.json({ ok: true });
}
