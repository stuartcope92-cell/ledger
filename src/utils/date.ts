// ── Date helpers ───────────────────────────────────────────────
import { format, parseISO, subDays } from "date-fns";

export type RangeKey = "day" | "week" | "month";

// ISO yyyy-mm-dd for a given date (defaults to today), used as the storage key.
export const toISO = (d: Date = new Date()): string => format(d, "yyyy-MM-dd");

export const todayISO = (): string => toISO();

export const yesterdayISO = (): string => toISO(subDays(new Date(), 1));

// Human label ("28 Jul") for a stored ISO date.
export const shortLabel = (iso: string): string => format(parseISO(iso), "d MMM");

// Inclusive start date (ISO) for a range ending today.
export function rangeStartISO(range: RangeKey, now: Date = new Date()): string {
  if (range === "day") return toISO(now);
  if (range === "week") return toISO(subDays(now, 6));
  return toISO(subDays(now, 29)); // month ≈ last 30 days
}

// Keep only records whose ISO `date` falls within [start, today].
export function inRange<T extends { date: string }>(
  rows: T[],
  range: RangeKey,
): T[] {
  const start = rangeStartISO(range);
  const end = todayISO();
  return rows.filter((r) => r.date >= start && r.date <= end);
}
