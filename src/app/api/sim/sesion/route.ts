import { NextResponse } from "next/server";
import { CLIENT_COOKIE, cookieOptions, viewerFrom } from "@/lib/shared/session";

export const dynamic = "force-dynamic";

/** Shared mode: the visitor's verified phone, if any. */
export async function GET(req: Request) {
  return NextResponse.json({ phone: viewerFrom(req).phone ?? null });
}

/** Shared mode: the visitor signs out. */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(CLIENT_COOKIE, "", { ...cookieOptions, maxAge: 0 });
  return res;
}
