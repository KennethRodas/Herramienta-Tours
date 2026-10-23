import { NextResponse } from "next/server";
import { integrations } from "@/lib/integrations/config";
import { sharedRev } from "@/lib/shared/db";
import { redactFor } from "@/lib/shared/redact";
import { currentShared } from "@/lib/shared/server-sim";
import { viewerFrom } from "@/lib/shared/session";

export const dynamic = "force-dynamic";

/**
 * Shared mode: the state as this viewer may see it. Browsers poll with the
 * revision they have; 204 means nothing changed (one cheap query).
 */
export async function GET(req: Request) {
  if (integrations.dataMode !== "supabase") return NextResponse.json({ error: "Modo simulación" }, { status: 404 });
  try {
    const since = Number(new URL(req.url).searchParams.get("rev") ?? "-1");
    if (since >= 0 && (await sharedRev()) === since) return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
    const { state } = await currentShared();
    return NextResponse.json({ state: redactFor(state, viewerFrom(req)) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 503 });
  }
}
