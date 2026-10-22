import { NextResponse } from "next/server";
import { z } from "zod";
import { integrations, whatsappTestNumbers } from "@/lib/integrations/config";
import { sendWhatsApp } from "@/lib/integrations/kapso";

export const dynamic = "force-dynamic";

const schema = z.object({
  to: z.string().min(8),
  originalTo: z.string().optional(),
  body: z.string().min(1).max(4000),
  buttons: z.array(z.string().max(40)).max(3).optional(),
  location: z.object({ lat: z.number(), lng: z.number(), name: z.string(), address: z.string() }).optional(),
});

/**
 * Real WhatsApp delivery for the simulator. Only numbers listed in
 * WHATSAPP_TEST_NUMBERS can receive messages, so this endpoint cannot be used
 * to message anyone else.
 */
export async function POST(req: Request) {
  if (!integrations.kapso) return NextResponse.json({ ok: false, error: "Kapso no está configurado" }, { status: 503 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Datos inválidos" }, { status: 400 });
  const to = parsed.data.to.replace(/\D/g, "");
  if (!whatsappTestNumbers().includes(to)) {
    return NextResponse.json({ ok: false, error: "Ese número no está en WHATSAPP_TEST_NUMBERS" }, { status: 403 });
  }
  const prefix = parsed.data.originalTo && parsed.data.originalTo.replace(/\D/g, "") !== to ? `[Simulación · para +${parsed.data.originalTo.replace(/\D/g, "")}]\n` : "";
  const result = await sendWhatsApp({ to, body: `${prefix}${parsed.data.body}`, buttons: parsed.data.buttons, location: parsed.data.location });
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
