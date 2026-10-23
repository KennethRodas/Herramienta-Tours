import { NextResponse } from "next/server";
import { z } from "zod";
import { integrations, siteUrlFromRequest } from "@/lib/integrations/config";
import { createPaymentLink } from "@/lib/integrations/wompi";
import { TOURS } from "@/content/catalog";

export const dynamic = "force-dynamic";

const schema = z.object({
  code: z.string().regex(/^WIL-[A-Z0-9]{4}$/),
  tourId: z.string(),
  partySize: z.number().int().min(1).max(25),
  // Bookings without an email store "", which is not an error.
  email: z.union([z.literal(""), z.string().email()]).optional(),
});

/**
 * Creates a Wompi payment link for a booking deposit. The amount is computed
 * here from the catalog (never trusted from the browser).
 * Returns 503 while Wompi keys are missing: the UI then uses the simulated payment.
 */
export async function POST(req: Request) {
  if (!integrations.wompi) return NextResponse.json({ ok: false, error: "Wompi pendiente de configurar" }, { status: 503 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Datos inválidos" }, { status: 400 });
  const tour = TOURS.find((t) => t.id === parsed.data.tourId);
  if (!tour) return NextResponse.json({ ok: false, error: "Tour no existe" }, { status: 404 });
  const site = siteUrlFromRequest(req);
  try {
    const link = await createPaymentLink({
      reference: parsed.data.code,
      amountUsd: tour.depositUsd * parsed.data.partySize,
      productName: `Anticipo ${tour.name} · ${parsed.data.code}`,
      redirectUrl: `${site}/reserva/pago/retorno`,
      webhookUrl: `${site}/api/pagos/wompi/webhook`,
      customerEmail: parsed.data.email || undefined,
    });
    return NextResponse.json({ ok: true, url: link.urlEnlace, idEnlace: link.idEnlace, productive: link.estaProductivo ?? false });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
