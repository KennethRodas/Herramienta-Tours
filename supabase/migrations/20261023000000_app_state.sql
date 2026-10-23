-- Shared mode (NEXT_PUBLIC_DATA_MODE=supabase): the whole booking state as one
-- document, written only by the server with the service role. Every write is a
-- compare-and-swap on `rev` (update ... where rev = <the one read>), which
-- serialises concurrent bookings of the last seat. Browsers never read this
-- table directly: /api/sim/estado returns what each viewer may see.

create table if not exists public.app_state (
  id text primary key,
  rev bigint not null default 0,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

-- No policies: with RLS on, the anon and authenticated roles can neither read
-- nor write it. The service role (server only) bypasses RLS.
alter table public.app_state enable row level security;

comment on table public.app_state is
  'Wilber: shared state for multi-user tests. Written by the Next.js server with compare-and-swap on rev.';
