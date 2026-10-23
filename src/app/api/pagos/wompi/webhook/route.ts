import { after, NextResponse } from "next/server";
import { integrations, siteUrlFromRequest } from "@/lib/integrations/config";
import { verifyWebhookHash } from "@/lib/integrations/wompi";
import { currentShared, dispatchQueued, serverSim } from "@/lib/shared/server-sim";

export const dynamic = "force-dynamic";

/**
 * Wompi → our app after a payment. Header `wompi_hash` must match
 * HMAC-SHA256(raw body, client secret). In shared mode the booking whose code
 * equals EnlacePago.IdentificadorEnlaceComercio is marked as paid (or as a
 * rejected deposit) and its confirmation goes out.
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
  if (integrations.dataMode === "supabase" && code) {
    const { state } = await currentShared();
    const booking = state.bookings.find((b) => b.code === code && b.payment.status === "pendiente");
    if (booking) {
      await serverSim.settlePayment(booking.id, approved ? "aprobar" : "rechazar");
      const site = siteUrlFromRequest(req);
      after(() => dispatchQueued(site).catch((e) => console.warn("dispatch:", (e as Error).message)));
    }
  }
  return NextResponse.json({ ok: true });
}
