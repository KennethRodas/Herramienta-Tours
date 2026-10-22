import { NextResponse } from "next/server";
import { integrations, whatsappTestNumbers } from "@/lib/integrations/config";
import { listRecentMessages } from "@/lib/integrations/kapso";

export const dynamic = "force-dynamic";

/**
 * Bridge for the simulator: recent messages that test numbers sent to the
 * business number. The browser answers them with simulated data.
 */
export async function GET(req: Request) {
  if (!integrations.kapso) return NextResponse.json({ ok: false, messages: [], error: "Kapso no está configurado" }, { status: 503 });
  const since = new URL(req.url).searchParams.get("since") ?? undefined;
  try {
    const allowed = new Set(whatsappTestNumbers());
    const messages = (await listRecentMessages({ since, limit: 40 })).filter((m) => allowed.has(m.from));
    return NextResponse.json({ ok: true, messages });
  } catch (e) {
    return NextResponse.json({ ok: false, messages: [], error: (e as Error).message }, { status: 502 });
  }
}
