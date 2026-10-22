// Generates supabase/seed.sql from src/content/catalog.ts: the full catalog plus
// departures for the next 6 weeks (El Salvador time, UTC-6, no DST).
// Usage: node scripts/generate-seed.mjs   (Node 24 strips the types of the .ts file natively)
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GUIDES, MEETING_POINTS, TOURS, VEHICLES } from "../src/content/catalog.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outFile = path.join(root, "supabase", "seed.sql");

const WEEKS = 6;
const HOUR = 3_600_000;
const SV_OFFSET_MS = -6 * HOUR; // El Salvador: UTC-6 all year
const SV_SUFFIX = "-06:00";
// Months (1 = January) in which each tour runs. No entry = all year.
const SEASON_MONTHS = { "t-montecristo": [11, 12, 1, 2, 3, 4] };

// Same rules as the schema, so bad catalog data fails here instead of when the SQL is applied.
for (const t of TOURS) {
  if (t.summary.length > 90) throw new Error(`${t.id}: summary is longer than 90 characters`);
  if (!MEETING_POINTS.some((m) => m.id === t.meetingPointId)) {
    throw new Error(`${t.id}: unknown meetingPointId (${t.meetingPointId})`);
  }
}

// ---- SQL literals ----------------------------------------------------------
const txt = (v) => (v == null ? "null" : `'${String(v).replace(/'/g, "''")}'`);
const num = (v) => {
  if (!Number.isFinite(v)) throw new Error(`Invalid number in the catalog: ${v}`);
  return String(v);
};
const bool = (v) => (v ? "true" : "false");
const jsonb = (v) => `${txt(JSON.stringify(v))}::jsonb`;
const textArray = (a) => `ARRAY[${a.map(txt).join(", ")}]::text[]`;
const intArray = (a) => `ARRAY[${a.map(num).join(", ")}]::int[]`;
// Instant (ms since epoch) -> '2026-10-24T05:00:00-06:00'::timestamptz
const stamp = (ms) => `'${new Date(ms + SV_OFFSET_MS).toISOString().slice(0, 16)}:00${SV_SUFFIX}'::timestamptz`;

function insert(table, cols, rows, onConflict) {
  if (rows.length === 0) return "";
  return [
    `insert into public.${table} (${cols.join(", ")})`,
    "values",
    rows.map((r) => `  (${r.join(", ")})`).join(",\n"),
    `on conflict ${onConflict};`,
    "",
  ].join("\n");
}
const upsertById = (cols) =>
  `(id) do update set ${cols.filter((c) => c !== "id").map((c) => `${c} = excluded.${c}`).join(", ")}`;

// ---- Catalog (upsert: re-running the seed refreshes prices and copy) --------
const sections = [];

const meetingCols = ["id", "name", "address", "city", "lat", "lng", "instructions", "maps_url"];
sections.push(
  insert(
    "meeting_points",
    meetingCols,
    MEETING_POINTS.map((m) => [
      txt(m.id), txt(m.name), txt(m.address), txt(m.city), num(m.lat), num(m.lng), txt(m.instructions), txt(m.mapsUrl),
    ]),
    upsertById(meetingCols),
  ),
);

const guideCols = ["id", "name", "phone", "senior"];
sections.push(
  insert(
    "guides",
    guideCols,
    GUIDES.map((g) => [txt(g.id), txt(g.name), txt(g.phone), bool(g.senior)]),
    upsertById(guideCols),
  ),
);

const vehicleCols = ["id", "name", "plate", "seats", "driver"];
sections.push(
  insert(
    "vehicles",
    vehicleCols,
    VEHICLES.map((v) => [txt(v.id), txt(v.name), txt(v.plate), num(v.seats), txt(v.driver)]),
    upsertById(vehicleCols),
  ),
);

const tourCols = [
  "id", "slug", "code", "name", "short_name", "region", "summary", "description", "difficulty", "tags",
  "duration_hours", "distance_km", "elevation_gain_m", "max_altitude_m", "price_usd", "deposit_usd",
  "capacity", "min_age", "weekdays", "departure_time", "meeting_point_id", "includes", "bring",
  "itinerary", "arrive_minutes_before", "photo", "route", "active",
];
sections.push(
  insert(
    "tours",
    tourCols,
    TOURS.map((t) => [
      txt(t.id), txt(t.slug), txt(t.code), txt(t.name), txt(t.shortName), txt(t.region),
      txt(t.summary), txt(t.description), txt(t.difficulty), textArray(t.tags),
      num(t.durationHours), num(t.distanceKm), num(t.elevationGainM), num(t.maxAltitudeM),
      num(t.priceUsd), num(t.depositUsd), num(t.capacity), num(t.minAge), intArray(t.weekdays),
      txt(t.departureTime), txt(t.meetingPointId), textArray(t.includes), textArray(t.bring),
      jsonb(t.itinerary), num(t.arriveMinutesBefore), txt(t.photo), jsonb(t.route), bool(t.active),
    ]),
    upsertById(tourCols),
  ),
);

// ---- Departures (future only; existing rows are never touched) --------------
const now = Date.now();
const svToday = new Date(now + SV_OFFSET_MS);
const firstDay = Date.UTC(svToday.getUTCFullYear(), svToday.getUTCMonth(), svToday.getUTCDate());
const days = Array.from({ length: WEEKS * 7 }, (_, i) => new Date(firstDay + i * 24 * HOUR));

const departureCols = [
  "id", "tour_id", "starts_at", "ends_at", "capacity", "seats_taken", "price_usd", "status",
  "guide_id", "vehicle_id", "meeting_point_id", "notes", "prep_ready",
];
const departureRows = [];
for (const tour of TOURS) {
  const [hh, mm] = tour.departureTime.split(":").map(Number);
  const months = SEASON_MONTHS[tour.id];
  for (const day of days) {
    if (!tour.weekdays.includes(day.getUTCDay())) continue; // 0 = Sunday
    if (months && !months.includes(day.getUTCMonth() + 1)) continue;
    // Local time -> instant: El Salvador is UTC-6, so UTC = local + 6 h.
    const startMs = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hh, mm) - SV_OFFSET_MS;
    if (startMs <= now) continue; // skip departures that already started
    const endMs = startMs + tour.durationHours * HOUR;
    const ymd = day.toISOString().slice(0, 10);
    departureRows.push([
      txt(`d-${tour.code.toLowerCase()}-${ymd}`),
      txt(tour.id),
      stamp(startMs),
      stamp(endMs),
      num(tour.capacity),
      "0",
      num(tour.priceUsd),
      txt("abierta"),
      "null",
      "null",
      txt(tour.meetingPointId),
      "null",
      "false",
    ]);
  }
}
sections.push(insert("departures", departureCols, departureRows, "(id) do nothing"));

// ---- Output -----------------------------------------------------------------
const first = days[0].toISOString().slice(0, 10);
const last = days[days.length - 1].toISOString().slice(0, 10);
const sql = [
  "-- Generated by scripts/generate-seed.mjs from src/content/catalog.ts. Do not edit by hand.",
  `-- Departures from ${first} to ${last} (El Salvador time, UTC-6). Future departures only, as of generation.`,
  "-- Re-runnable: catalog rows are upserted; existing departures are left alone.",
  "",
  "begin;",
  "",
  ...sections.filter(Boolean),
  "commit;",
  "",
].join("\n");

mkdirSync(path.dirname(outFile), { recursive: true });
writeFileSync(outFile, sql, "utf8");
console.log(
  `supabase/seed.sql written: ${MEETING_POINTS.length} meeting points, ${GUIDES.length} guides, ` +
    `${VEHICLES.length} vehicles, ${TOURS.length} tours, ${departureRows.length} departures (${first} to ${last})`,
);
