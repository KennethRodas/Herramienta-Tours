import type { Booking } from "@/lib/domain/types";
import type { SimState } from "@/lib/sim/state";
import type { Viewer } from "./session";

/**
 * What each viewer may see of the shared state.
 * - Wilber (admin cookie): everything except login codes and his PIN.
 * - Everyone else: departures, seats and holds (no personal data), plus only
 *   their own bookings (by the phone they signed in with, or a code they made
 *   or opened), their own account and their own messages.
 */
export function redactFor(s: SimState, v: Viewer): SimState {
  const settings = { ...s.settings, adminPin: "", testPhone: "", testEmail: "" };
  if (v.admin) return { ...s, loginCodes: [], settings };
  const codes = new Set(v.codes);
  const mine = (b: Booking) => (v.phone !== undefined && b.phone === v.phone) || codes.has(b.code);
  const bookings = s.bookings.filter(mine);
  const contacts = new Set<string>();
  if (v.phone) contacts.add(v.phone);
  for (const b of bookings) {
    contacts.add(b.phone);
    if (b.email) contacts.add(b.email.toLowerCase());
  }
  return {
    ...s,
    bookings,
    customers: s.customers.filter((c) => v.phone !== undefined && c.phone === v.phone),
    loginCodes: [],
    knownContacts: [],
    messages: s.messages.filter((m) => contacts.has(m.to.toLowerCase()) || contacts.has(m.from.toLowerCase())),
    events: [],
    fired: {},
    settings,
  };
}
