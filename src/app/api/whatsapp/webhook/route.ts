import { after, NextResponse } from "next/server";
import { integrations, siteUrlFromRequest, wilberAdminPhone } from "@/lib/integrations/config";
import { parseInbound, verifyKapsoSignature } from "@/lib/integrations/kapso";
import { dispatchQueued, serverSim } from "@/lib/shared/server-sim";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const seen = new Set<string>();

/**
 * Kapso → our app. Configure in Kapso: event `whatsapp.message.received`,
 * URL https://<dominio>/api/whatsapp/webhook, secret = KAPSO_WEBHOOK_SECRET.
 * Wilber's number gets the command bot; everyone else the customer bot.
 * In shared mode both answer from the shared state (and Wilber's commands,
 * like "cerrar SA24" or "llegó WIL-7K2Q", really apply); the replies go out
 * through Kapso. In simulation mode the simulator tab answers instead (see
 * /api/whatsapp/inbox), so we only acknowledge.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyKapsoSignature(raw, req.headers.get("x-webhook-signature"))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const idem = req.headers.get("x-idempotency-key");
  if (idem) {
    if (seen.has(idem)) return NextResponse.json({ ok: true, duplicate: true });
    seen.add(idem);
    if (seen.size > 500) seen.clear();
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const inbound = parseInbound(body);
  if (!inbound.length || !integrations.kapso || integrations.dataMode !== "supabase") {
    return NextResponse.json({ ok: true, handled: 0 });
  }

  const admin = wilberAdminPhone();
  let handled = 0;
  for (const msg of inbound) {
    if (admin && msg.from === admin) await serverSim.wilberSays(msg.text);
    else await serverSim.customerSays(msg.from, msg.text);
    handled++;
  }
  const site = siteUrlFromRequest(req);
  after(() => dispatchQueued(site).catch((e) => console.warn("dispatch:", (e as Error).message)));
  return NextResponse.json({ ok: true, handled });
}
