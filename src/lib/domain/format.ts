// Time and formatting helpers. El Salvador keeps UTC-6 all year (no DST),
// so local parts are computed with a fixed offset: deterministic on server and client.

export const SV_TZ = "America/El_Salvador";
export const SV_OFFSET = "-06:00";
const OFFSET_MS = -6 * 60 * 60 * 1000;
export const HOUR = 60 * 60 * 1000;
export const DAY = 24 * HOUR;

type Stamp = Date | string | number;

const ms = (t: Stamp) => (t instanceof Date ? t.getTime() : typeof t === "string" ? Date.parse(t) : t);

/** Local (El Salvador) calendar parts of an instant. */
export function svParts(t: Stamp) {
  const d = new Date(ms(t) + OFFSET_MS);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    weekday: d.getUTCDay(),
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "2026-10-24" in El Salvador. */
export function svDateKey(t: Stamp) {
  const p = svParts(t);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** ISO instant for a local date key and "HH:mm". */
export function svISO(dateKey: string, hhmm: string) {
  return `${dateKey}T${hhmm}:00${SV_OFFSET}`;
}

/** Midnight (El Salvador) of the day containing t, as epoch ms. */
export function svStartOfDay(t: Stamp) {
  return Date.parse(svISO(svDateKey(t), "00:00"));
}

export function addDays(dateKey: string, days: number) {
  const base = Date.parse(`${dateKey}T12:00:00Z`) + days * DAY;
  return new Date(base).toISOString().slice(0, 10);
}

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("es-SV", { timeZone: SV_TZ, ...opts });
const F_DAY_SHORT = fmt({ weekday: "short", day: "numeric", month: "short" });
const F_DAY_LONG = fmt({ weekday: "long", day: "numeric", month: "long" });
const F_DATE_FULL = fmt({ weekday: "long", day: "numeric", month: "long", year: "numeric" });
const F_MONTH = fmt({ month: "long", year: "numeric" });
const F_WEEKDAY = fmt({ weekday: "long" });

const tidy = (s: string) => s.replace(/\./g, "").replace(/\s+/g, " ").trim();

/** "sáb 24 oct" */
export function formatDayShort(t: Stamp) {
  return tidy(F_DAY_SHORT.format(ms(t)).replace(",", ""));
}

/** "sábado 24 de octubre" */
export function formatDayLong(t: Stamp) {
  return F_DAY_LONG.format(ms(t)).replace(",", "");
}

/** "sábado, 24 de octubre de 2026" */
export function formatDateFull(t: Stamp) {
  return F_DATE_FULL.format(ms(t));
}

export function formatMonth(t: Stamp) {
  return F_MONTH.format(ms(t));
}

export function formatWeekday(t: Stamp) {
  return F_WEEKDAY.format(ms(t));
}

/** "5:00 a. m." */
export function formatTime(t: Stamp) {
  const { hour, minute } = svParts(t);
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${pad(minute)} ${hour < 12 ? "a. m." : "p. m."}`;
}

/** "05:00" (24 h, for tables and the itinerary slip). */
export function formatTime24(t: Stamp) {
  const { hour, minute } = svParts(t);
  return `${pad(hour)}:${pad(minute)}`;
}

/** "hoy", "mañana", "pasado mañana", "en 5 días", "hace 2 días". */
export function formatRelativeDay(t: Stamp, now: Stamp) {
  const diff = Math.round((svStartOfDay(t) - svStartOfDay(now)) / DAY);
  if (diff === 0) return "hoy";
  if (diff === 1) return "mañana";
  if (diff === 2) return "pasado mañana";
  if (diff === -1) return "ayer";
  if (diff < 0) return `hace ${-diff} días`;
  return `en ${diff} días`;
}

/** "en 3 h 20 min", "en 12 min", "hace 2 h". */
export function formatCountdown(target: Stamp, now: Stamp) {
  let delta = ms(target) - ms(now);
  const past = delta < 0;
  delta = Math.abs(delta);
  const d = Math.floor(delta / DAY);
  const h = Math.floor((delta % DAY) / HOUR);
  const m = Math.floor((delta % HOUR) / 60000);
  const body = d > 0 ? `${d} d ${h} h` : h > 0 ? `${h} h ${m} min` : `${Math.max(m, 0)} min`;
  return past ? `hace ${body}` : `en ${body}`;
}

/** "$35" or "$35.50". */
export function formatUsd(n: number) {
  const whole = Number.isInteger(n);
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })}`;
}

/** "11 h", "5 h 30 min". */
export function formatDuration(hours: number) {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function formatKm(km: number) {
  return `${km.toLocaleString("es-SV", { maximumFractionDigits: 1 })} km`;
}

export function formatMeters(m: number) {
  return `${m.toLocaleString("en-US")} m`;
}

/** Digits only; 8-digit Salvadoran numbers get the 503 prefix. */
export function normalizePhone(input: string) {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 8) return `503${digits}`;
  return digits;
}

/** "+503 7012 3456" */
export function formatPhone(e164: string) {
  const d = normalizePhone(e164);
  if (d.startsWith("503") && d.length === 11) return `+503 ${d.slice(3, 7)} ${d.slice(7)}`;
  return `+${d}`;
}

/** wa.me deep link with a prefilled message. */
export function waLink(phone: string, text?: string) {
  const base = `https://wa.me/${normalizePhone(phone)}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

export function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}
