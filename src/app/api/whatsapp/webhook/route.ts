import { NextResponse } from "next/server";
import { integrations, wilberAdminPhone } from "@/lib/integrations/config";
import { parseInbound, sendWhatsApp, verifyKapsoSignature } from "@/lib/integrations/kapso";
import { loadBotData } from "@/lib/supabase/bot-data";
import { handleAdminMessage } from "@/lib/whatsapp/admin-bot";
import { handleCustomerMessage } from "@/lib/whatsapp/customer-bot";

export const dynamic = "force-dynamic";

const seen = new Set<string>();

/**
 * Kapso → our app. Configure in Kapso: event `whatsapp.message.received`,
 * URL https://<dominio>/api/whatsapp/webhook, secret = KAPSO_WEBHOOK_SECRET.
 * Wilber's number gets the command bot; everyone else the customer bot.
 * With Supabase the bots answer with live data; in simulation mode the
 * simulator tab answers instead (see /api/whatsapp/inbox), so we only ack.
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

  const data = await loadBotData();
  if (!data) return NextResponse.json({ ok: true, handled: 0 });
  const admin = wilberAdminPhone();
  let handled = 0;
  for (const msg of inbound) {
    if (admin && msg.from === admin) {
      const reply = handleAdminMessage(msg.text, data);
      await sendWhatsApp({ to: msg.from, body: reply.text, buttons: reply.buttons });
      // Mutating commands (cerrar/abrir/llegó/arreglar) are applied by the dashboard
      // in this version; the bot tells Wilber what it would do.
    } else {
      const reply = handleCustomerMessage(msg.text, msg.from, data);
      await sendWhatsApp({ to: msg.from, body: reply.text, buttons: reply.buttons });
      if (reply.forwardToWilber && admin) {
        await sendWhatsApp({ to: admin, body: `*Mensaje de +${msg.from}*${msg.contactName ? ` (${msg.contactName})` : ""}\n«${msg.text}»` });
      }
    }
    handled++;
  }
  return NextResponse.json({ ok: true, handled });
}
