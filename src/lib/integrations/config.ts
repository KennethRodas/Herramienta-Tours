// Server-side view of which integrations are configured. Never import from client code.

const list = (v?: string) =>
  (v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export const integrations = {
  dataMode: (process.env.NEXT_PUBLIC_DATA_MODE === "supabase" ? "supabase" : "simulacion") as "supabase" | "simulacion",
  supabase: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
  kapso: Boolean(process.env.KAPSO_API_KEY && process.env.KAPSO_PHONE_NUMBER_ID),
  kapsoWebhookSecret: Boolean(process.env.KAPSO_WEBHOOK_SECRET),
  resend: Boolean(process.env.RESEND_API_KEY),
  wompi: Boolean(process.env.WOMPI_CLIENT_ID && process.env.WOMPI_CLIENT_SECRET),
};

/** Numbers the simulator may message for real (everything else is refused). */
export const whatsappTestNumbers = () => list(process.env.WHATSAPP_TEST_NUMBERS).map((n) => n.replace(/\D/g, ""));

/** Emails the simulator may write to for real. */
export const emailTestAddresses = () => list(process.env.EMAIL_TEST_ADDRESSES).map((e) => e.toLowerCase());

export const wilberAdminPhone = () => (process.env.WILBER_ADMIN_PHONE ?? "").replace(/\D/g, "");

export function siteUrlFromRequest(req: Request) {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}
