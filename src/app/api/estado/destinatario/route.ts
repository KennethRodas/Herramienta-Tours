import { NextResponse } from "next/server";
import { emailTestAddresses, integrations, whatsappTestNumbers } from "@/lib/integrations/config";

export const dynamic = "force-dynamic";

/**
 * Can the simulation deliver to this contact for real? Only numbers in
 * WHATSAPP_TEST_NUMBERS and emails in EMAIL_TEST_ADDRESSES qualify. Answers
 * yes/no for one contact; the lists themselves are never returned.
 */
export function GET(req: Request) {
  const to = (new URL(req.url).searchParams.get("to") ?? "").trim();
  if (!to) return NextResponse.json({ whatsapp: false, email: false });
  const isEmail = to.includes("@");
  return NextResponse.json({
    whatsapp: !isEmail && integrations.kapso && whatsappTestNumbers().includes(to.replace(/\D/g, "")),
    email: isEmail && integrations.resend && emailTestAddresses().includes(to.toLowerCase()),
  });
}
