# Supabase: Tours de Wilber

Esquema, funciones y datos de semilla para el modo `supabase`.

- `migrations/20261022000000_init.sql`: tablas, índices, funciones, RLS y realtime.
- `seed.sql`: catálogo (puntos de encuentro, guías, vehículos, tours) y salidas de las próximas 6 semanas. Lo genera `node scripts/generate-seed.mjs` desde `src/content/catalog.ts`.

## Aplicar

**Opción A: SQL Editor del dashboard.** Ejecuta `migrations/20261022000000_init.sql` y luego `seed.sql`.

**Opción B: Supabase CLI.**

```bash
supabase link --project-ref <ref>
supabase db push
psql "<cadena de conexión de Settings > Database>" -f supabase/seed.sql
```

Si el CLI pide `supabase/config.toml`, corre `supabase init` antes.

Re-ejecutar el seed actualiza el catálogo y no toca las salidas que ya existen. Para regenerarlo (`node scripts/generate-seed.mjs`, Node 24): las salidas empiezan hoy, hora de El Salvador, y cubren 6 semanas, así que regenera si pasaron días. Node imprime un aviso `MODULE_TYPELESS_PACKAGE_JSON` al leer `catalog.ts`; es inofensivo.

## Variables de entorno

```bash
NEXT_PUBLIC_DATA_MODE=supabase
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>   # solo servidor; nunca con NEXT_PUBLIC_
```

## Hacer admin a Wilber

```sql
update auth.users
set raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}'
where email = 'correo-de-wilber@ejemplo.com';
```

Wilber debe cerrar sesión y volver a entrar para que el JWT incluya el rol.

## Acceso

`anon` solo lee tours activos, puntos de encuentro y salidas. Reservas y retenciones van por RPC: `create_booking`, `hold_seats` y `get_booking_by_code`. Guías (tienen teléfono), vehículos, reservas, retenciones, mensajes y eventos son solo para admin.

## Prueba de no sobreventa

Crea reservas, así que úsala solo en una base de prueba. `DB` es la cadena de conexión de la base (Settings > Database), no la anon key.

```bash
S=$(psql "$DB" -Atc "select id from departures where status='abierta' and starts_at > now() + interval '3 hours' order by starts_at limit 1")
psql "$DB" -qc "update departures set seats_taken = capacity - 1 where id = '$S'"
psql "$DB" -Atc "select public.create_booking('$S','Ana','50370000010',null,1,null,'en_sitio')" &
psql "$DB" -Atc "select public.create_booking('$S','Beto','50370000011',null,1,null,'en_sitio')" &
wait
psql "$DB" -Atc "select seats_taken = capacity from departures where id = '$S'"
```

Esperado: una respuesta con `"ok": true`, la otra con `"reason": "sin_cupos"`, y la última línea `t`.
