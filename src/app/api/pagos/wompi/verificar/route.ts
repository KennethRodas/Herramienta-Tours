import { after, NextResponse } from "next/server";
import { integrations, siteUrlFromRequest } from "@/lib/integrations/config";
import { getTransaction, verifyRedirectHash } from "@/lib/integrations/wompi";
import { currentShared, dispatchQueued, serverSim } from "@/lib/shared/server-sim";

export const dynamic = "force-dynamic";

/**
 * Called by /reserva/pago/retorno with the query Wompi appended to the redirect.
 * The redirect alone is not proof of payment: the transaction is read back from Wompi.
 */
export async function GET(req: Request) {
  if (!integrations.wompi) return NextResponse.json({ ok: false, error: "Wompi pendiente de configurar" }, { status: 503 });
  const params = new URL(req.url).searchParams;
  const id = params.get("idTransaccion");
  if (!id) return NextResponse.json({ ok: false, error: "Falta idTransaccion" }, { status: 400 });
  try {
    const tx = await getTransaction(id);
    const hashValid = params.has("hash") ? verifyRedirectHash(params) : null;
    const real = tx.esReal === true;
    // Wompi's API is the proof of payment. Real money also needs the redirect hash to
    // match (so a paid transaction cannot be replayed onto another booking); in Wompi's
    // test mode no money moves, so the API's word is enough.
    const approved = tx.esAprobada === true && (hashValid === true || !real);
    if (hashValid === false) {
      // Logged to tune verifyRedirectHash against a real redirect (the hash is a MAC, not a secret).
      // Only the redirect query and the amount: the transaction also carries the payer's ID, phone and email.
      console.warn("wompi: redirect hash mismatch", JSON.stringify({ query: Object.fromEntries(params), monto: tx.monto, esReal: real }));
    }
    const reference = params.get("identificadorEnlaceComercio");
    if (approved && reference && integrations.dataMode === "supabase") {
      const { state } = await currentShared();
      const booking = state.bookings.find((b) => b.code === reference && b.payment.status === "pendiente");
      if (booking) {
        await serverSim.settlePayment(booking.id, "aprobar");
        const site = siteUrlFromRequest(req);
        after(() => dispatchQueued(site).catch((e) => console.warn("dispatch:", (e as Error).message)));
      }
    }
    return NextResponse.json({
      ok: true,
      hashValid,
      approved,
      // Wompi approved it but the redirect could not be verified (real payments only).
      blocked: tx.esAprobada === true && !approved,
      real,
      amount: tx.monto ?? null,
      reference: params.get("identificadorEnlaceComercio"),
      message: tx.mensaje ?? null,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
