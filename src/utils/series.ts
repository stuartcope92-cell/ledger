// ── Trend series aggregation (BUILD_SPEC §6 Progress) ──────────
import { format, parseISO, subDays } from "date-fns";
import { toISO } from "./date";
import { bestSet1RM, setsVolume } from "../formulas";
import type { CardioSession, Meal, WeighIn, Workout } from "../types";

export type TrendMetric = "weight" | "calories" | "protein" | "cardio";
export type ExerciseMetric = "e1rm" | "volume" | "topset";

export interface Point {
  x: string; // axis label
  iso: string; // underlying ISO date
  v: number;
}

// Ascending list of ISO dates for the window ending today.
export function windowDates(days: number, now: Date = new Date()): string[] {
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) out.push(toISO(subDays(now, i)));
  return out;
}

// Sum a numeric field of dated rows into a per-date map.
function sumByDate<T extends { date: string }>(
  rows: T[],
  pick: (r: T) => number,
): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.date, (m.get(r.date) ?? 0) + pick(r));
  return m;
}

// Axis label for a date given the window size (keeps 30-day axes readable).
const axisLabel = (iso: string, days: number): string =>
  format(parseISO(iso), days > 7 ? "d/M" : "EEE");

// Build the daily trend series for the chosen metric over a window.
// Gap policy (§6): weight carries forward last known; the calorie/protein/
// cardio metrics default to 0 on days with no logs.
export function buildTrendSeries(
  metric: TrendMetric,
  days: number,
  data: {
    weighIns: WeighIn[];
    meals: Meal[];
    cardio: CardioSession[];
    fallbackWeight: number;
  },
): Point[] {
  const dates = windowDates(days);

  if (metric === "weight") {
    // Latest weigh-in per day.
    const byDay = new Map<string, number>();
    for (const wi of data.weighIns) byDay.set(wi.date, wi.weightKg);
    // Seed carry-forward with the most recent weigh-in before the window,
    // else the profile's current weight.
    const before = data.weighIns
      .filter((wi) => wi.date < dates[0])
      .sort((a, b) => a.date.localeCompare(b.date));
    let last = before.at(-1)?.weightKg ?? data.fallbackWeight;
    const anyInWindow = data.weighIns.some((wi) => wi.date >= dates[0]);
    if (!before.length && !anyInWindow) return []; // nothing to show yet
    return dates.map((iso) => {
      if (byDay.has(iso)) last = byDay.get(iso)!;
      return { x: axisLabel(iso, days), iso, v: Math.round(last * 10) / 10 };
    });
  }

  const source =
    metric === "calories"
      ? sumByDate(data.meals, (m) => m.cal)
      : metric === "protein"
        ? sumByDate(data.meals, (m) => m.p)
        : sumByDate(data.cardio, (c) => c.cal);

  return dates.map((iso) => ({
    x: axisLabel(iso, days),
    iso,
    v: Math.round(source.get(iso) ?? 0),
  }));
}

// One point per session date for a single exercise, for the chosen metric.
export function buildExerciseSeries(
  workouts: Workout[],
  exercise: string,
  metric: ExerciseMetric,
): Point[] {
  const rows = workouts
    .filter((w) => w.name === exercise)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!rows.length) return [];

  // Combine all sets logged for the exercise on the same day.
  const byDate = new Map<string, Workout["sets"]>();
  for (const w of rows) {
    byDate.set(w.date, [...(byDate.get(w.date) ?? []), ...w.sets]);
  }

  return [...byDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([iso, sets]) => {
      const v =
        metric === "e1rm"
          ? bestSet1RM(sets)
          : metric === "volume"
            ? Math.round(setsVolume(sets))
            : Math.max(...sets.map((s) => s.weight));
      return { x: format(parseISO(iso), "d/M"), iso, v };
    });
}

export const average = (pts: Point[]): number =>
  pts.length ? Math.round(pts.reduce((s, p) => s + p.v, 0) / pts.length) : 0;
