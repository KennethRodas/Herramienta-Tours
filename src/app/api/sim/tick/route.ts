import { NextResponse } from "next/server";
import { integrations, siteUrlFromRequest } from "@/lib/integrations/config";
import { tickShared } from "@/lib/shared/server-sim";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

let last = 0;

/**
 * Shared mode: runs the automations that are due (reminders, day-of location,
 * reviews, Wilber's digest, cross alerts) and sends queued messages. Called by
 * open browsers every ~20 s and, optionally, by a cron. Safe to call twice:
 * every automation is keyed in `fired` and every write is a compare-and-swap.
 */
async function tick(req: Request) {
  if (integrations.dataMode !== "supabase") return NextResponse.json({ ok: false }, { status: 404 });
  if (Date.now() - last < 8_000) return NextResponse.json({ ok: true, skipped: true });
  last = Date.now();
  try {
    return NextResponse.json({ ok: true, ...(await tickShared(siteUrlFromRequest(req))) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 503 });
  }
}

export const GET = tick;
export const POST = tick;
