import { NextResponse } from "next/server";
import { integrations } from "@/lib/integrations/config";
import { currentShared } from "@/lib/shared/server-sim";
import { ADMIN_COOKIE, cookieOptions, token, viewerFrom } from "@/lib/shared/session";

export const dynamic = "force-dynamic";

const fails = new Map<string, { n: number; until: number }>();

/** Shared mode: is this browser signed in to Wilber's panel? */
export async function GET(req: Request) {
  return NextResponse.json({ admin: viewerFrom(req).admin });
}

/** Shared mode: Wilber's PIN (ADMIN_PIN, or the panel's setting) opens the panel for 30 days. */
export async function POST(req: Request) {
  if (integrations.dataMode !== "supabase") return NextResponse.json({ ok: false }, { status: 404 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "?";
  const f = fails.get(ip);
  if (f && f.until > Date.now()) return NextResponse.json({ ok: false, error: "Demasiados intentos. Esperá 30 segundos." }, { status: 429 });
  const body = (await req.json().catch(() => null)) as { pin?: unknown } | null;
  const pin = typeof body?.pin === "string" ? body.pin : "";
  const expected = process.env.ADMIN_PIN || (await currentShared()).state.settings.adminPin;
  if (!pin || pin !== expected) {
    const n = (f?.n ?? 0) + 1;
    fails.set(ip, n >= 5 ? { n: 0, until: Date.now() + 30_000 } : { n, until: 0 });
    return NextResponse.json({ ok: false, error: "PIN incorrecto" }, { status: 401 });
  }
  fails.delete(ip);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, token("admin"), cookieOptions);
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, "", { ...cookieOptions, maxAge: 0 });
  return res;
}
