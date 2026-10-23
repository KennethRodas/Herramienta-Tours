import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Client } from "pg";
import type { SimState } from "@/lib/sim/state";

// The shared state is one row in Supabase (public.app_state, see
// supabase/migrations/20261023000000_app_state.sql). Only the server touches
// it, with the service role; every write is a compare-and-swap on `rev`.
// Local development without Supabase keys uses a JSON file instead (same
// compare-and-swap), and never sends real messages (see localOnly()).
// SHARED_ROW lets a preview deployment use its own row of the same table.

const ROW = process.env.SHARED_ROW || "main";
let client: SupabaseClient | null = null;

const supabaseUrl = () => process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const hasSupabase = () => Boolean(supabaseUrl() && process.env.SUPABASE_SERVICE_ROLE_KEY);

/** Development without Supabase: state in a local file, messages stay simulated. */
export const localOnly = () => !hasSupabase() && process.env.NODE_ENV !== "production";

function db() {
  if (!hasSupabase()) throw new Error("Supabase no está configurado (NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY).");
  client ??= createClient(supabaseUrl()!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

export interface StoredState {
  rev: number;
  state: SimState;
}

// --- Local file (development only) ---------------------------------------------

const FILE = join(process.cwd(), ".next", "cache", "wilber-compartido.json");

function readFile(): StoredState | null {
  try {
    const row = JSON.parse(readFileSync(FILE, "utf8")) as StoredState;
    return row?.state ? row : null;
  } catch {
    return null;
  }
}

function writeFile(row: StoredState) {
  mkdirSync(join(FILE, ".."), { recursive: true });
  const tmp = `${FILE}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, JSON.stringify(row));
  renameSync(tmp, FILE);
}

// --- Shared store ---------------------------------------------------------------

// --- Table bootstrap ---------------------------------------------------------------

const DDL = `
create table if not exists public.app_state (
  id text primary key,
  rev bigint not null default 0,
  state jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.app_state enable row level security;
notify pgrst, 'reload schema';`;

let ensured: Promise<void> | null = null;

const missingTable = (message: string) => /app_state/.test(message) && /(does not exist|schema cache|not find)/i.test(message);

/**
 * Creates public.app_state the first time (same SQL as the migration), through the
 * Postgres URL the Supabase integration adds to Vercel, then waits for the API to see it.
 */
function ensureTable(): Promise<void> {
  ensured ??= (async () => {
    const url = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
    if (!url) throw new Error("Falta la tabla app_state y no hay POSTGRES_URL para crearla: corré supabase/migrations/20261023000000_app_state.sql.");
    const pg = new Client({ connectionString: url.replace(/[?&]sslmode=[^&]*/g, ""), ssl: { rejectUnauthorized: false } });
    await pg.connect();
    try {
      await pg.query(DDL);
    } finally {
      await pg.end().catch(() => undefined);
    }
    for (let i = 0; i < 20; i++) {
      const { error } = await db().from("app_state").select("id").limit(1);
      if (!error) return;
      await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error("La tabla app_state se creó pero la API de Supabase todavía no la ve. Intentá de nuevo en un minuto.");
  })().catch((e) => {
    ensured = null;
    throw e;
  });
  return ensured;
}

export async function loadShared(): Promise<StoredState | null> {
  if (localOnly()) return readFile();
  let { data, error } = await db().from("app_state").select("rev, state").eq("id", ROW).maybeSingle();
  if (error && missingTable(error.message)) {
    await ensureTable();
    ({ data, error } = await db().from("app_state").select("rev, state").eq("id", ROW).maybeSingle());
  }
  if (error) throw new Error(`Supabase: ${error.message}`);
  return data ? { rev: Number(data.rev), state: data.state as SimState } : null;
}

/** Only the revision: what polling browsers ask for most of the time. */
export async function sharedRev(): Promise<number | null> {
  if (localOnly()) return readFile()?.rev ?? null;
  const { data, error } = await db().from("app_state").select("rev").eq("id", ROW).maybeSingle();
  if (error && missingTable(error.message)) return null;
  if (error) throw new Error(`Supabase: ${error.message}`);
  return data ? Number(data.rev) : null;
}

/** First write of the shared state. False when another request created it first. */
export async function insertShared(state: SimState): Promise<boolean> {
  if (localOnly()) {
    if (readFile()) return false;
    writeFile({ rev: state.rev, state });
    return true;
  }
  const { error } = await db().from("app_state").insert({ id: ROW, rev: state.rev, state });
  return !error;
}

/** Writes `next` only if nobody committed since `prevRev`. */
export async function casShared(prevRev: number, next: SimState): Promise<boolean> {
  if (localOnly()) {
    if (readFile()?.rev !== prevRev) return false;
    writeFile({ rev: next.rev, state: next });
    return true;
  }
  const { data, error } = await db()
    .from("app_state")
    .update({ rev: next.rev, state: next, updated_at: new Date().toISOString() })
    .eq("id", ROW)
    .eq("rev", prevRev)
    .select("rev");
  if (error) throw new Error(`Supabase: ${error.message}`);
  return (data?.length ?? 0) === 1;
}
