import { createClient } from "@supabase/supabase-js";
import type { Booking, Departure } from "@/lib/domain/types";
import { GUIDES, TOURS, VEHICLES } from "@/content/catalog";
import type { BotData } from "@/lib/whatsapp/admin-bot";

// Loads the data the WhatsApp bots need from Supabase (service role, server only).

export function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

type Row = Record<string, unknown>;

export const toDeparture = (r: Row): Departure => ({
  id: String(r.id),
  tourId: String(r.tour_id),
  startsAt: String(r.starts_at),
  endsAt: String(r.ends_at),
  capacity: Number(r.capacity),
  seatsTaken: Number(r.seats_taken),
  priceUsd: Number(r.price_usd),
  status: r.status as Departure["status"],
  guideId: (r.guide_id as string | null) ?? null,
  vehicleId: (r.vehicle_id as string | null) ?? null,
  meetingPointId: String(r.meeting_point_id),
  notes: (r.notes as string | null) ?? undefined,
  prepReady: Boolean(r.prep_ready),
  createdAt: String(r.created_at),
});

export const toBooking = (r: Row): Booking => ({
  id: String(r.id),
  code: String(r.code),
  departureId: String(r.departure_id),
  tourId: String(r.tour_id),
  name: String(r.name),
  phone: String(r.phone),
  email: (r.email as string | null) ?? undefined,
  partySize: Number(r.party_size),
  notes: (r.notes as string | null) ?? undefined,
  status: r.status as Booking["status"],
  payment: {
    method: r.payment_method as Booking["payment"]["method"],
    status: r.payment_status as Booking["payment"]["status"],
    amountUsd: Number(r.payment_amount_usd ?? 0),
    reference: (r.payment_reference as string | null) ?? undefined,
  },
  source: r.source as Booking["source"],
  checkedIn: Number(r.checked_in ?? 0),
  createdAt: String(r.created_at),
  confirmation: (r.confirmation as Booking["confirmation"]) ?? "pendiente",
});

export async function loadBotData(): Promise<BotData | null> {
  const db = serviceClient();
  if (!db) return null;
  const from = new Date(Date.now() - 8 * 86_400_000).toISOString();
  const to = new Date(Date.now() + 30 * 86_400_000).toISOString();
  const { data: deps } = await db.from("departures").select("*").gte("starts_at", from).lte("starts_at", to);
  const ids = (deps ?? []).map((d) => d.id);
  const { data: books } = ids.length ? await db.from("bookings").select("*").in("departure_id", ids) : { data: [] };
  return {
    tours: TOURS,
    departures: (deps ?? []).map(toDeparture),
    bookings: (books ?? []).map(toBooking),
    holds: [],
    guides: GUIDES,
    vehicles: VEHICLES,
    now: Date.now(),
  };
}
