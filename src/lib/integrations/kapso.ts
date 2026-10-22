import { createHmac, timingSafeEqual } from "node:crypto";

// Kapso = WhatsApp Cloud API proxy (https://docs.kapso.ai). Server only.
// Base: https://api.kapso.ai/meta/whatsapp/v24.0 · Platform: https://api.kapso.ai/platform/v1 · Auth: X-API-Key.

const META_BASE = "https://api.kapso.ai/meta/whatsapp/v24.0";
const PLATFORM_BASE = "https://api.kapso.ai/platform/v1";

export interface OutgoingWhatsApp {
  to: string;
  body: string;
  buttons?: string[];
  location?: { lat: number; lng: number; name: string; address: string };
}

export interface KapsoResult {
  ok: boolean;
  status: number;
  ids: string[];
  error?: string;
}

function headers() {
  const key = process.env.KAPSO_API_KEY;
  if (!key) throw new Error("KAPSO_API_KEY no está configurada");
  return { "X-API-Key": key, "Content-Type": "application/json" };
}

function phoneNumberId() {
  const id = process.env.KAPSO_PHONE_NUMBER_ID;
  if (!id) throw new Error("KAPSO_PHONE_NUMBER_ID no está configurado");
  return id;
}

/** WhatsApp limits: reply buttons ≤ 3, titles ≤ 20 chars, body ≤ 1024 chars. */
function payloads(m: OutgoingWhatsApp) {
  const to = m.to.replace(/\D/g, "");
  const base = { messaging_product: "whatsapp", recipient_type: "individual", to };
  const out: Record<string, unknown>[] = [];
  const buttons = (m.buttons ?? []).slice(0, 3);
  if (buttons.length) {
    out.push({
      ...base,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: m.body.slice(0, 1024) },
        action: {
          buttons: buttons.map((title, i) => ({ type: "reply", reply: { id: `b${i + 1}`, title: title.slice(0, 20) } })),
        },
      },
    });
  } else {
    out.push({ ...base, type: "text", text: { preview_url: true, body: m.body.slice(0, 4096) } });
  }
  if (m.location) {
    out.push({
      ...base,
      type: "location",
      location: { latitude: m.location.lat, longitude: m.location.lng, name: m.location.name, address: m.location.address },
    });
  }
  return out;
}

export async function sendWhatsApp(m: OutgoingWhatsApp): Promise<KapsoResult> {
  const ids: string[] = [];
  for (const body of payloads(m)) {
    const res = await fetch(`${META_BASE}/${phoneNumberId()}/messages`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string } };
    if (!res.ok) return { ok: false, status: res.status, ids, error: json.error?.message ?? `HTTP ${res.status}` };
    ids.push(...(json.messages ?? []).map((x) => x.id));
  }
  return { ok: true, status: 200, ids };
}

/** Verifies X-Webhook-Signature: hex HMAC-SHA256 of the raw body with the webhook secret. */
export function verifyKapsoSignature(rawBody: string, signature: string | null) {
  const secret = process.env.KAPSO_WEBHOOK_SECRET;
  if (!secret) return true; // not configured: accept (sandbox / first setup)
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export interface InboundText {
  id: string;
  from: string;
  text: string;
  timestamp: number;
  contactName?: string;
}

/** Normalises a Kapso webhook body (single event or buffered batch) into inbound texts. */
export function parseInbound(body: unknown): InboundText[] {
  const batch = body as { batch?: boolean; data?: unknown[] } | null;
  const items: unknown[] = batch?.batch && Array.isArray(batch.data) ? batch.data : [body];
  const out: InboundText[] = [];
  for (const item of items) {
    const ev = item as {
      message?: {
        id?: string;
        from?: string;
        timestamp?: string;
        type?: string;
        text?: { body?: string };
        interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } };
        button?: { text?: string };
        kapso?: { content?: string };
      };
      conversation?: { contact_name?: string };
    };
    const m = ev?.message;
    if (!m?.from) continue;
    const text =
      m.text?.body ?? m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? m.button?.text ?? m.kapso?.content ?? "";
    if (!text) continue;
    out.push({
      id: m.id ?? `${m.from}-${m.timestamp}`,
      from: m.from.replace(/\D/g, ""),
      text,
      timestamp: Number(m.timestamp ?? Date.now() / 1000) * 1000,
      contactName: ev.conversation?.contact_name,
    });
  }
  return out;
}

export interface KapsoMessageRow {
  id: string;
  from: string;
  text: string;
  direction: "inbound" | "outbound";
  createdAt: string;
}

/**
 * Recent messages stored by Kapso (Platform API). Used by the simulator to
 * answer real WhatsApp messages with simulated data.
 */
export async function listRecentMessages(params: { since?: string; limit?: number } = {}): Promise<KapsoMessageRow[]> {
  // GET /platform/v1/whatsapp/messages — newest first; filters: phone_number_id, direction, limit (1–100).
  const url = new URL(`${PLATFORM_BASE}/whatsapp/messages`);
  url.searchParams.set("phone_number_id", phoneNumberId());
  url.searchParams.set("direction", "inbound");
  url.searchParams.set("limit", String(Math.min(100, params.limit ?? 30)));
  const res = await fetch(url, { headers: headers(), cache: "no-store" });
  if (!res.ok) throw new Error(`Kapso ${res.status}`);
  const json = (await res.json()) as { data?: Record<string, unknown>[] };
  const since = params.since ? Date.parse(params.since) : 0;
  return (json.data ?? [])
    .map((r) => {
      const kapso = (r.kapso ?? {}) as { direction?: string; content?: string };
      const text = ((r.text as { body?: string } | undefined)?.body ?? kapso.content ?? (r.content as string | undefined) ?? "") as string;
      const created = (r.created_at as string | undefined) ?? (r.timestamp ? new Date(Number(r.timestamp) * 1000).toISOString() : new Date().toISOString());
      return {
        id: String(r.id ?? r.message_id ?? created),
        from: String(r.from ?? r.phone_number ?? "").replace(/\D/g, ""),
        text,
        direction: (kapso.direction ?? r.direction) === "outbound" ? ("outbound" as const) : ("inbound" as const),
        createdAt: created,
      };
    })
    .filter((m) => m.direction === "inbound" && m.text && Date.parse(m.createdAt) > since);
}
