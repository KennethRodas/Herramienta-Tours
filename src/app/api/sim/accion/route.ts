import { after, NextResponse } from "next/server";
import { integrations, siteUrlFromRequest } from "@/lib/integrations/config";
import { redactFor } from "@/lib/shared/redact";
import { currentShared, dispatchQueued, HttpError, runAction } from "@/lib/shared/server-sim";
import { CLIENT_COOKIE, cookieOptions, token, viewerFrom } from "@/lib/shared/session";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Shared mode: runs one action (book, hold, cancel, sign in, Wilber's panel…)
 * on the shared state and answers with the state as this viewer may see it.
 * Messages the action queued go out right after the response.
 */
export async function POST(req: Request) {
  if (integrations.dataMode !== "supabase") return NextResponse.json({ ok: false, error: "Modo simulación" }, { status: 404 });
  const body = (await req.json().catch(() => null)) as { name?: unknown; args?: unknown } | null;
  if (typeof body?.name !== "string" || !Array.isArray(body.args ?? [])) {
    return NextResponse.json({ ok: false, error: "Datos inválidos" }, { status: 400 });
  }
  const viewer = viewerFrom(req);
  const site = siteUrlFromRequest(req);
  try {
    const outcome = await runAction(body.name, (body.args as unknown[] | undefined) ?? [], viewer);
    after(() => dispatchQueued(site).catch((e) => console.warn("dispatch:", (e as Error).message)));
    const { state } = await currentShared();
    const seen = {
      ...viewer,
      phone: outcome.signedInPhone ?? viewer.phone,
      codes: outcome.code ? [...viewer.codes, outcome.code] : viewer.codes,
    };
    const res = NextResponse.json({ ok: true, result: outcome.result, state: redactFor(state, seen) });
    if (outcome.signedInPhone) res.cookies.set(CLIENT_COOKIE, token(`tel:${outcome.signedInPhone}`), cookieOptions);
    return res;
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    if (status === 500) console.warn("accion:", body.name, (e as Error).message);
    return NextResponse.json({ ok: false, error: status === 500 ? "No se pudo completar. Intentá de nuevo." : (e as Error).message }, { status });
  }
}
