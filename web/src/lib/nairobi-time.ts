/** Kenya is UTC+3 all year (no daylight saving). Admins enter and read times in Nairobi time. */

/** "2026-10-15T10:00" (from <input type="datetime-local">, Nairobi time) → Date (UTC instant). */
export function nairobiLocalToDate(local: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null;
  const d = new Date(`${local}:00+03:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Date → "2026-10-15T10:00" for a datetime-local input, in Nairobi time. */
export function dateToNairobiLocal(d: Date): string {
  const n = new Date(d.getTime() + 3 * 3_600_000);
  return n.toISOString().slice(0, 16);
}

/** Human format for emails and lists, e.g. "Thu 15 Oct 2026, 10:00 (Nairobi time)". Built from parts so it
 *  reads the same on every Node/ICU version (Intl's own punctuation differs between versions). */
export function formatNairobi(d: Date, withZone = true): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZone: "Africa/Nairobi",
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );
  const s = `${parts.weekday} ${parts.day} ${parts.month} ${parts.year}, ${parts.hour}:${parts.minute}`;
  return withZone ? `${s} (Nairobi time)` : s;
}
