import { NextResponse } from "next/server";
import { integrations, whatsappTestNumbers, emailTestAddresses } from "@/lib/integrations/config";

export const dynamic = "force-dynamic";

/** Which integrations are configured on this deployment (no secrets). */
export function GET() {
  return NextResponse.json({
    mode: integrations.dataMode,
    supabase: integrations.supabase,
    kapso: integrations.kapso,
    kapsoWebhookSecret: integrations.kapsoWebhookSecret,
    resend: integrations.resend,
    wompi: integrations.wompi,
    whatsappTestNumbers: whatsappTestNumbers().map((n) => `+${n.slice(0, 3)} ••••${n.slice(-4)}`),
    emailTestAddresses: emailTestAddresses().length,
  });
}
