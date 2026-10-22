import { NextResponse } from "next/server";
import { integrations } from "@/lib/integrations/config";
import { getTransaction, verifyRedirectHash } from "@/lib/integrations/wompi";

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
    return NextResponse.json({
      ok: true,
      hashValid: params.has("hash") ? verifyRedirectHash(params) : null,
      approved: tx.esAprobada === true,
      real: tx.esReal === true,
      amount: tx.monto ?? null,
      reference: params.get("identificadorEnlaceComercio"),
      message: tx.mensaje ?? null,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
