import { createHmac, timingSafeEqual } from "node:crypto";
import { normalizePhone } from "@/lib/domain/format";

// Who is asking, from signed cookies set by the server:
// - wilber_admin: Wilber's panel, after his PIN.
// - wilber_cliente: a visitor's phone, after the WhatsApp code.
// Plus the booking codes the browser made or opened (x-wilber-codigos).

export const ADMIN_COOKIE = "wilber_admin";
export const CLIENT_COOKIE = "wilber_cliente";
export const SESSION_DAYS = 30;

export interface Viewer {
  admin: boolean;
  phone?: string;
  codes: string[];
}

function secret() {
  return process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "wilber-dev-secret";
}

export function sign(value: string) {
  const mac = createHmac("sha256", secret()).update(value).digest("base64url");
  return `${value}.${mac}`;
}

function unsign(token: string | undefined): string | null {
  if (!token) return null;
  const i = token.lastIndexOf(".");
  if (i <= 0) return null;
  const value = token.slice(0, i);
  const a = Buffer.from(token.slice(i + 1));
  const b = Buffer.from(createHmac("sha256", secret()).update(value).digest("base64url"));
  return a.length === b.length && timingSafeEqual(a, b) ? value : null;
}

function cookies(req: Request): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (req.headers.get("cookie") ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

/** Signed "<what>:<expiry>" tokens; the expiry is checked here, not trusted from the browser. */
export function token(what: string) {
  return sign(`${what}:${Date.now() + SESSION_DAYS * 86_400_000}`);
}

function valid(raw: string | null, prefix: string) {
  if (!raw?.startsWith(`${prefix}:`)) return null;
  const parts = raw.split(":");
  const exp = Number(parts.at(-1));
  return Number.isFinite(exp) && exp > Date.now() ? parts.slice(1, -1).join(":") : null;
}

export function viewerFrom(req: Request): Viewer {
  const c = cookies(req);
  const admin = valid(unsign(c[ADMIN_COOKIE]), "admin") !== null;
  const phone = valid(unsign(c[CLIENT_COOKIE]), "tel") ?? undefined;
  const codes = (req.headers.get("x-wilber-codigos") ?? "")
    .split(",")
    .map((x) => x.trim().toUpperCase())
    .filter((x) => /^WIL-[A-Z0-9]{4}$/.test(x))
    .slice(0, 30);
  return { admin, phone: phone ? normalizePhone(phone) : undefined, codes };
}

export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_DAYS * 86_400,
};
