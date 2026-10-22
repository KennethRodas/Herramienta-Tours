-- Tours de Aventura de Wilber: initial schema (PostgreSQL 15 / Supabase).
-- Source of truth: src/lib/domain/types.ts (snake_case names) and src/content/catalog.ts.
-- Notes:
--   * Message.to / Message.from are to_address / from_address (reserved words in SQL).
--   * El Salvador is UTC-6 with no DST; every date is timestamptz.
--   * Bookings and holds are written only by the SECURITY DEFINER functions below.

-- =============================================================================
-- Catalog
-- =============================================================================

create table public.meeting_points (
  id           text primary key,
  name         text not null,
  address      text not null,
  city         text not null,
  lat          double precision not null check (lat between -90 and 90),
  lng          double precision not null check (lng between -180 and 180),
  instructions text not null default '',
  maps_url     text not null default ''
);

create table public.guides (
  id     text primary key,
  name   text not null,
  phone  text not null,
  senior boolean not null default false
);

create table public.vehicles (
  id     text primary key,
  name   text not null,
  plate  text not null,
  seats  int not null check (seats > 0),
  driver text not null
);

create table public.tours (
  id                    text primary key,
  slug                  text not null unique,
  code                  text not null unique check (code ~ '^[A-Z]{2}$'),
  name                  text not null,
  short_name            text not null,
  region                text not null,
  summary               text not null check (char_length(summary) <= 90),
  description           text not null,
  difficulty            text not null
                        check (difficulty in ('suave', 'moderada', 'exigente', 'extrema')),
  tags                  text[] not null default '{}'
                        check (tags <@ array['volcan', 'cascada', 'bosque', 'lago', 'playa', 'pueblo', 'manglar']::text[]),
  duration_hours        numeric(5,2) not null check (duration_hours > 0),
  distance_km           numeric(6,2) not null default 0 check (distance_km >= 0),
  elevation_gain_m      int not null default 0 check (elevation_gain_m >= 0),
  max_altitude_m        int not null default 0 check (max_altitude_m >= 0),
  price_usd             numeric(10,2) not null check (price_usd >= 0),
  deposit_usd           numeric(10,2) not null default 0 check (deposit_usd >= 0),
  capacity              int not null check (capacity > 0),
  min_age               int not null default 0 check (min_age >= 0),
  weekdays              int[] not null default '{}'
                        check (weekdays <@ array[0, 1, 2, 3, 4, 5, 6]),
  departure_time        text not null
                        check (departure_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  meeting_point_id      text not null references public.meeting_points (id),
  includes              text[] not null default '{}',
  bring                 text[] not null default '{}',
  itinerary             jsonb not null default '[]'::jsonb
                        check (jsonb_typeof(itinerary) = 'array'),
  arrive_minutes_before int not null default 0 check (arrive_minutes_before >= 0),
  photo                 text not null default '',
  route                 jsonb not null check (jsonb_typeof(route) = 'object'),
  active                boolean not null default true
);

-- =============================================================================
-- Departures, bookings, holds
-- =============================================================================

create table public.departures (
  id               text primary key,
  tour_id          text not null references public.tours (id),
  starts_at        timestamptz not null,
  ends_at          timestamptz not null,
  capacity         int not null check (capacity > 0),
  seats_taken      int not null default 0,
  price_usd        numeric(10,2) not null check (price_usd >= 0),
  status           text not null default 'abierta'
                   check (status in ('abierta', 'cerrada', 'cancelada', 'realizada')),
  guide_id         text references public.guides (id) on delete set null,
  vehicle_id       text references public.vehicles (id) on delete set null,
  meeting_point_id text not null references public.meeting_points (id),
  notes            text,
  prep_ready       boolean not null default false,
  created_at       timestamptz not null default now(),
  constraint departures_ends_after_start check (ends_at > starts_at),
  constraint departures_seats_range check (seats_taken >= 0 and seats_taken <= capacity)
);

create index departures_tour_starts_idx on public.departures (tour_id, starts_at);

create table public.bookings (
  id                 uuid primary key default gen_random_uuid(),
  -- UNIQUE already creates the index on code, so no separate index is needed.
  code               text not null unique
                     check (code ~ '^WIL-[ACDEFGHJKMNPQRTUVWXY34679]{4}$'),
  departure_id       text not null references public.departures (id),
  tour_id            text not null references public.tours (id),
  name               text not null check (btrim(name) <> ''),
  phone              text not null check (btrim(phone) <> ''),
  email              text,
  party_size         int not null check (party_size >= 1),
  notes              text,
  status             text not null
                     check (status in ('confirmada', 'pendiente_pago', 'pagada', 'check_in', 'no_show', 'cancelada')),
  payment_method     text not null check (payment_method in ('en_sitio', 'wompi')),
  payment_status     text not null
                     check (payment_status in ('no_aplica', 'pendiente', 'aprobado', 'rechazado')),
  payment_amount_usd numeric(10,2) not null default 0 check (payment_amount_usd >= 0),
  payment_reference  text,
  source             text not null check (source in ('web', 'whatsapp', 'manual', 'simulacion')),
  checked_in         int not null default 0,
  confirmation       text not null default 'pendiente'
                     check (confirmation in ('pendiente', 'enviada', 'fallida')),
  created_at         timestamptz not null default now(),
  constraint bookings_checked_in_range check (checked_in >= 0 and checked_in <= party_size)
);

create index bookings_departure_id_idx on public.bookings (departure_id);
create index bookings_phone_idx on public.bookings (phone);

create table public.holds (
  id           uuid primary key default gen_random_uuid(),
  departure_id text not null references public.departures (id) on delete cascade,
  party_size   int not null check (party_size >= 1),
  expires_at   timestamptz not null,
  session_id   text not null
);

create index holds_departure_expires_idx on public.holds (departure_id, expires_at);

-- =============================================================================
-- Messages and events
-- =============================================================================

create table public.messages (
  id            uuid primary key default gen_random_uuid(),
  channel       text not null check (channel in ('whatsapp', 'email')),
  kind          text not null check (kind in (
                  'confirmacion', 'recordatorio_24h', 'recordatorio_salida', 'alerta_clima',
                  'cambio_salida', 'resena', 'pago', 'wilber_nueva_reserva', 'wilber_resumen',
                  'wilber_cruce', 'wilber_bot', 'cliente_bot', 'entrante')),
  direction     text not null check (direction in ('saliente', 'entrante')),
  to_address    text not null,
  from_address  text not null,
  body          text not null default '',
  buttons       text[] not null default '{}',
  location      jsonb check (location is null or jsonb_typeof(location) = 'object'),
  booking_id    uuid references public.bookings (id) on delete set null,
  departure_id  text references public.departures (id) on delete set null,
  status        text not null
                check (status in ('en_cola', 'simulado', 'enviado', 'entregado', 'leido', 'fallido')),
  "real"        boolean not null default false,
  created_at    timestamptz not null default now(),
  scheduled_for timestamptz
);

create index messages_booking_id_idx on public.messages (booking_id);

create table public.events (
  id      uuid primary key default gen_random_uuid(),
  "at"    timestamptz not null default now(),
  type    text not null check (type in (
            'reserva.creada', 'reserva.rechazada', 'reserva.cancelada', 'reserva.check_in',
            'pago.aprobado', 'pago.rechazado', 'salida.creada', 'salida.actualizada',
            'salida.cerrada', 'salida.llena', 'cruce.detectado', 'cruce.resuelto',
            'mensaje.enviado', 'mensaje.recibido', 'reloj.avanzado', 'escenario.iniciado',
            'sistema')),
  actor   text not null check (actor in ('visitante', 'wilber', 'bot', 'sistema')),
  summary text not null,
  data    jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object')
);

create index events_at_idx on public.events ("at");

-- =============================================================================
-- Functions. SECURITY DEFINER: the only write path for anon.
-- =============================================================================

-- Books seats. SELECT ... FOR UPDATE locks the departure row, so two concurrent
-- calls on the same departure run one after the other: the second sees the seats
-- already sold and returns sin_cupos. Rejections are logged and returned (not
-- raised), so the event row is kept.
create or replace function public.create_booking(
  p_departure_id   text,
  p_name           text,
  p_phone          text,
  p_email          text,
  p_party_size     int,
  p_notes          text,
  p_payment_method text,
  p_source         text default 'web',
  p_hold_id        uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dep        public.departures%rowtype;
  v_tour       public.tours%rowtype;
  v_booking    public.bookings%rowtype;
  v_held       int := 0;
  v_seats_left int := 0;
  v_reason     text;
  v_message    text;
  v_actor      text;
  v_name       text := btrim(coalesce(p_name, ''));
  v_phone      text := btrim(coalesce(p_phone, ''));
  v_email      text := nullif(btrim(coalesce(p_email, '')), '');
  v_notes      text := nullif(btrim(coalesce(p_notes, '')), '');
  v_status     text;
  v_pay_status text;
  v_amount     numeric(10,2) := 0;
  v_code       text;
  v_alphabet   constant text := 'ACDEFGHJKMNPQRTUVWXY34679';
  v_tries      int := 0;
begin
  v_actor := case p_source
    when 'manual' then 'wilber'
    when 'whatsapp' then 'bot'
    when 'simulacion' then 'sistema'
    else 'visitante'
  end;

  -- 1. Lock the departure row.
  select d.* into v_dep
    from public.departures d
   where d.id = p_departure_id
     for update;

  if not found then
    v_reason := 'no_existe';
  else
    -- Free seats = capacity - sold - live holds (excluding this caller's own hold).
    select coalesce(sum(h.party_size), 0) into v_held
      from public.holds h
     where h.departure_id = v_dep.id
       and h.expires_at > now()
       and h.id is distinct from p_hold_id;

    v_seats_left := v_dep.capacity - v_dep.seats_taken - v_held;

    -- NULL-safe: a NULL payment method or source counts as invalid data.
    if v_dep.status <> 'abierta' then
      v_reason := 'salida_cerrada';
    elsif v_dep.starts_at - interval '2 hours' <= now() then
      v_reason := 'salida_pasada';
    elsif p_party_size is null or p_party_size < 1
          or v_name = '' or v_phone = ''
          or p_payment_method is null or p_payment_method not in ('en_sitio', 'wompi')
          or p_source is null or p_source not in ('web', 'whatsapp', 'manual', 'simulacion') then
      v_reason := 'datos_invalidos';
    elsif p_party_size > v_seats_left then
      v_reason := 'sin_cupos';
    end if;
  end if;

  -- 2. Rejected: log the attempt and return the reason.
  if v_reason is not null then
    v_message := case v_reason
      when 'no_existe' then 'Esa salida no existe.'
      when 'salida_cerrada' then 'Esta salida ya no acepta reservas.'
      when 'salida_pasada' then 'Esta salida ya salió o sale en menos de 2 horas.'
      when 'datos_invalidos' then 'Revisa el nombre, el teléfono, el número de personas y el método de pago.'
      else case when v_seats_left > 0
                then format('Solo quedan %s cupos para esta salida.', v_seats_left)
                else 'Esta salida ya está llena.'
           end
    end;

    insert into public.events (type, actor, summary, data)
    values (
      'reserva.rechazada',
      v_actor,
      format('Reserva rechazada (%s) en la salida %s', v_reason, coalesce(v_dep.id, p_departure_id, '(sin id)')),
      jsonb_build_object(
        'reason', v_reason,
        'departure_id', p_departure_id,
        'party_size', p_party_size,
        'source', p_source,
        'seats_left', greatest(v_seats_left, 0)
      )
    );

    return jsonb_build_object(
      'ok', false,
      'reason', v_reason,
      'seats_left', greatest(v_seats_left, 0),
      'message', v_message
    );
  end if;

  -- 3. Accepted: status and payment depend on the payment method.
  select t.* into v_tour from public.tours t where t.id = v_dep.tour_id;

  if p_payment_method = 'wompi' then
    v_status := 'pendiente_pago';
    v_pay_status := 'pendiente';
    v_amount := v_tour.deposit_usd * p_party_size;
  else
    v_status := 'confirmada';
    v_pay_status := 'no_aplica';
    v_amount := 0;
  end if;

  -- 4. Public code: 'WIL-' + 4 characters from an alphabet without look-alikes; retry until unique.
  loop
    v_tries := v_tries + 1;
    if v_tries > 50 then
      raise exception 'No se pudo generar un código de reserva único';
    end if;

    v_code := 'WIL-';
    for i in 1..4 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;

    exit when not exists (select 1 from public.bookings b where b.code = v_code);
  end loop;

  -- 5. Insert the booking, add to seats_taken, consume the caller's hold.
  insert into public.bookings (
    code, departure_id, tour_id, name, phone, email, party_size, notes,
    status, payment_method, payment_status, payment_amount_usd, source, confirmation
  ) values (
    v_code, v_dep.id, v_dep.tour_id, v_name, v_phone, v_email, p_party_size, v_notes,
    v_status, p_payment_method, v_pay_status, v_amount, p_source, 'pendiente'
  )
  returning * into v_booking;

  update public.departures d
     set seats_taken = d.seats_taken + p_party_size
   where d.id = v_dep.id;

  if p_hold_id is not null then
    delete from public.holds h
     where h.id = p_hold_id
       and h.departure_id = v_dep.id;
  end if;

  insert into public.events (type, actor, summary, data)
  values (
    'reserva.creada',
    v_actor,
    format('Reserva %s creada: %s persona(s) en %s', v_code, p_party_size, v_tour.short_name),
    jsonb_build_object(
      'booking_id', v_booking.id,
      'code', v_code,
      'departure_id', v_dep.id,
      'party_size', p_party_size,
      'payment_method', p_payment_method,
      'source', p_source
    )
  );

  return jsonb_build_object('ok', true, 'booking', to_jsonb(v_booking));
end;
$$;

-- Holds seats for 10 minutes, under the same row lock as create_booking.
-- If p_previous_hold belongs to the same session and departure, it is replaced
-- (its seats are not counted twice).
create or replace function public.hold_seats(
  p_departure_id  text,
  p_party_size    int,
  p_session_id    text,
  p_previous_hold uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dep        public.departures%rowtype;
  v_hold       public.holds%rowtype;
  v_held       int := 0;
  v_seats_left int := 0;
  v_reason     text;
  v_message    text;
  v_session    text := btrim(coalesce(p_session_id, ''));
begin
  select d.* into v_dep
    from public.departures d
   where d.id = p_departure_id
     for update;

  if not found then
    v_reason := 'no_existe';
  else
    -- Purge expired holds for this departure, under the same lock.
    delete from public.holds h
     where h.departure_id = v_dep.id
       and h.expires_at <= now();

    -- Skip only the caller's own previous hold (the one being replaced).
    select coalesce(sum(h.party_size), 0) into v_held
      from public.holds h
     where h.departure_id = v_dep.id
       and h.expires_at > now()
       and (h.id is distinct from p_previous_hold or h.session_id is distinct from v_session);

    v_seats_left := v_dep.capacity - v_dep.seats_taken - v_held;

    if v_dep.status <> 'abierta' then
      v_reason := 'salida_cerrada';
    elsif v_dep.starts_at - interval '2 hours' <= now() then
      v_reason := 'salida_pasada';
    elsif p_party_size is null or p_party_size < 1 or v_session = '' then
      v_reason := 'datos_invalidos';
    elsif p_party_size > v_seats_left then
      v_reason := 'sin_cupos';
    end if;
  end if;

  if v_reason is not null then
    v_message := case v_reason
      when 'no_existe' then 'Esa salida no existe.'
      when 'salida_cerrada' then 'Esta salida ya no acepta reservas.'
      when 'salida_pasada' then 'Esta salida ya salió o sale en menos de 2 horas.'
      when 'datos_invalidos' then 'Faltan datos para apartar cupos.'
      else case when v_seats_left > 0
                then format('Solo quedan %s cupos para esta salida.', v_seats_left)
                else 'Esta salida ya está llena.'
           end
    end;

    return jsonb_build_object(
      'ok', false,
      'reason', v_reason,
      'seats_left', greatest(v_seats_left, 0),
      'message', v_message
    );
  end if;

  delete from public.holds h
   where h.id = p_previous_hold
     and h.departure_id = v_dep.id
     and h.session_id = v_session;

  insert into public.holds (departure_id, party_size, expires_at, session_id)
  values (v_dep.id, p_party_size, now() + interval '10 minutes', v_session)
  returning * into v_hold;

  return jsonb_build_object(
    'ok', true,
    'hold', to_jsonb(v_hold),
    'seats_left', v_seats_left - p_party_size
  );
end;
$$;

-- Looks up a booking by its public code. Returns null when there is no match.
-- Warning: the code has 4 characters and this RPC is public with no rate limit,
-- so anyone can enumerate codes and read name, phone and email. Rate-limit it
-- at the edge or lengthen the code before launch.
create or replace function public.get_booking_by_code(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  -- Public lookup by a 4-character code: codes can be guessed, so contact data
  -- is masked (last 4 digits of the phone, no email). Full rows are admin-only.
  select jsonb_build_object(
    'booking', (to_jsonb(b) - 'email' - 'phone' - 'notes')
      || jsonb_build_object('phone_masked', '••••' || right(b.phone, 4)),
    'departure', to_jsonb(d),
    'tour_id', d.tour_id
  )
  from public.bookings b
  join public.departures d on d.id = b.departure_id
  where b.code = upper(btrim(p_code));
$$;

revoke all on function public.create_booking(text, text, text, text, int, text, text, text, uuid) from public;
revoke all on function public.hold_seats(text, int, text, uuid) from public;
revoke all on function public.get_booking_by_code(text) from public;

grant execute on function public.create_booking(text, text, text, text, int, text, text, text, uuid)
  to anon, authenticated, service_role;
grant execute on function public.hold_seats(text, int, text, uuid) to anon, authenticated, service_role;
grant execute on function public.get_booking_by_code(text) to anon, authenticated, service_role;

-- =============================================================================
-- Privileges and RLS
-- =============================================================================

-- anon: read-only access to the catalog, meeting points and departures.
revoke all on public.meeting_points, public.guides, public.vehicles, public.tours,
  public.departures, public.bookings, public.holds, public.messages, public.events
  from anon;
grant select on public.meeting_points, public.tours, public.departures to anon;

-- TRUNCATE bypasses RLS, so it is revoked from anon and authenticated.
revoke truncate on public.meeting_points, public.guides, public.vehicles, public.tours,
  public.departures, public.bookings, public.holds, public.messages, public.events
  from anon, authenticated;

alter table public.meeting_points enable row level security;
alter table public.guides        enable row level security;
alter table public.vehicles      enable row level security;
alter table public.tours         enable row level security;
alter table public.departures    enable row level security;
alter table public.bookings      enable row level security;
alter table public.holds         enable row level security;
alter table public.messages      enable row level security;
alter table public.events        enable row level security;

-- Public read policies. Guides (they have phone numbers), vehicles, bookings,
-- holds, messages and events have no public policy.
create policy meeting_points_public_read on public.meeting_points
  for select to anon, authenticated using (true);

create policy tours_public_read on public.tours
  for select to anon, authenticated using (active);

create policy departures_public_read on public.departures
  for select to anon, authenticated using (true);

-- Admin: a JWT with app_metadata.role = 'admin' gets full access (one policy per table).
create policy meeting_points_admin on public.meeting_points
  for all to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

create policy guides_admin on public.guides
  for all to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

create policy vehicles_admin on public.vehicles
  for all to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

create policy tours_admin on public.tours
  for all to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

create policy departures_admin on public.departures
  for all to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

create policy bookings_admin on public.bookings
  for all to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

create policy holds_admin on public.holds
  for all to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

create policy messages_admin on public.messages
  for all to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

create policy events_admin on public.events
  for all to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

-- =============================================================================
-- Realtime (idempotent: safe to re-run)
-- =============================================================================

do $$
declare
  v_table text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  foreach v_table in array array['departures', 'bookings', 'messages', 'events'] loop
    if not exists (
      select 1
        from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = v_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', v_table);
    end if;
  end loop;
end
$$;
