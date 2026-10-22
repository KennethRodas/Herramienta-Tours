import { createHmac, timingSafeEqual } from "node:crypto";

// Wompi El Salvador (Banco Agrícola). Server only. Reference: docs/integraciones/wompi.md
// Status: wired but inactive until WOMPI_CLIENT_ID / WOMPI_CLIENT_SECRET exist and the
// redirect/webhook URLs are registered.

const TOKEN_URL = "https://id.wompi.sv/connect/token";
const API = "https://api.wompi.sv";

let cached: { token: string; expires: number } | null = null;

function creds() {
  const id = process.env.WOMPI_CLIENT_ID;
  const secret = process.env.WOMPI_CLIENT_SECRET;
  if (!id || !secret) throw new Error("Wompi no está configurado");
  return { id, secret };
}

export async function wompiToken() {
  if (cached && cached.expires > Date.now() + 60_000) return cached.token;
  const { id, secret } = creds();
  const body = new URLSearchParams({ grant_type: "client_credentials", audience: "wompi_api", client_id: id, client_secret: secret });
  const res = await fetch(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body, cache: "no-store" });
  if (!res.ok) throw new Error(`Wompi token ${res.status}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: json.access_token, expires: Date.now() + json.expires_in * 1000 };
  return cached.token;
}

export interface PaymentLinkInput {
  /** Our booking code: comes back as identificadorEnlaceComercio. */
  reference: string;
  amountUsd: number;
  productName: string;
  redirectUrl: string;
  webhookUrl: string;
  customerEmail?: string;
}

export async function createPaymentLink(input: PaymentLinkInput) {
  const token = await wompiToken();
  const res = await fetch(`${API}/EnlacePago`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      identificadorEnlaceComercio: input.reference,
      monto: Number(input.amountUsd.toFixed(2)),
      nombreProducto: input.productName.slice(0, 100),
      // If formaPago is sent, all five flags are required and at least one must be true.
      formaPago: {
        permitirTarjetaCreditoDebido: true,
        permitirPagoConPuntoAgricola: false,
        permitirPagoEnCuotasAgricola: false,
        permitirPagoEnBitcoin: false,
        permitePagoQuickPay: false,
      },
      configuracion: {
        urlRedirect: input.redirectUrl,
        urlWebhook: input.webhookUrl,
        urlRetorno: input.redirectUrl.replace(/\/pago\/retorno.*$/, ""),
        esMontoEditable: false,
        esCantidadEditable: false,
        notificarTransaccionCliente: Boolean(input.customerEmail),
        emailsNotificacion: input.customerEmail ?? "",
      },
      vigencia: { fechaInicio: new Date().toISOString(), fechaFin: new Date(Date.now() + 30 * 60_000).toISOString() },
      limitesDeUso: { cantidadMaximaPagosExitosos: 1, cantidadMaximaPagosFallidos: 5 },
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Wompi EnlacePago ${res.status}: ${await res.text().catch(() => "")}`);
  return (await res.json()) as { idEnlace: number; urlEnlace: string; urlQrCodeEnlace?: string; estaProductivo?: boolean };
}

export async function getTransaction(idTransaccion: string) {
  const token = await wompiToken();
  const res = await fetch(`${API}/TransaccionCompra/${encodeURIComponent(idTransaccion)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Wompi TransaccionCompra ${res.status}`);
  return (await res.json()) as Record<string, unknown>;
}

const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a.toLowerCase());
  const y = Buffer.from(b.toLowerCase());
  return x.length === y.length && timingSafeEqual(x, y);
};

/** Webhook header `wompi_hash` = HMAC-SHA256(raw body, client secret), hex. */
export function verifyWebhookHash(rawBody: string, hash: string | null) {
  if (!hash) return false;
  const { secret } = creds();
  return safeEqual(createHmac("sha256", secret).update(rawBody, "utf8").digest("hex"), hash);
}

/**
 * Redirect query `hash` = HMAC-SHA256 of the concatenated parameters, keyed with the
 * client secret. Order per Wompi docs: identificadorEnlaceComercio, idTransaccion,
 * idEnlace, monto. (Marked "SIN CONFIRMAR" in the docs: verify with a real payment.)
 */
export function verifyRedirectHash(params: URLSearchParams) {
  const hash = params.get("hash");
  if (!hash) return false;
  const { secret } = creds();
  const message = ["identificadorEnlaceComercio", "idTransaccion", "idEnlace", "monto"].map((k) => params.get(k) ?? "").join("");
  return safeEqual(createHmac("sha256", secret).update(message, "utf8").digest("hex"), hash);
}
