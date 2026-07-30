// ── Plate calculator + warm-up ladder ───────────────────────────
// Fixed standard bar/plate set (no configuration screen — matches the
// app's "no settings sprawl" principle). Everything here operates on the
// canonical kg weight and only uses `unit` to pick which bar/plate set is
// actually sitting in the user's gym and to round warm-up rungs to
// something loadable in that system.
import type { UnitSystem } from "../types";
import { kgToDisplay } from "./units";

const KG_PER_LB = 0.45359237;

const BAR_KG: Record<UnitSystem, number> = { metric: 20, imperial: 45 * KG_PER_LB };

// Plate sizes in each system's own unit (not kg) — this is what's actually
// stamped on the plate, so the greedy fill works in display units.
const PLATES_DISPLAY: Record<UnitSystem, number[]> = {
  metric: [25, 20, 15, 10, 5, 2.5, 1.25],
  imperial: [45, 35, 25, 10, 5, 2.5],
};

export interface PlateCount {
  plate: number; // in display units (kg or lb)
  count: number; // per side
}

// Per-side plate breakdown to load a target weight, in the user's display
// unit. Greedy-fills from the largest plate down; any unreachable remainder
// (smaller than the smallest plate) is simply left off the bar.
export function plateBreakdown(targetWeightKg: number, unit: UnitSystem): PlateCount[] {
  const bar = kgToDisplay(BAR_KG[unit], unit);
  const target = kgToDisplay(targetWeightKg, unit);
  let perSide = Math.max(0, (target - bar) / 2);

  const plates = PLATES_DISPLAY[unit];
  const out: PlateCount[] = [];
  for (const plate of plates) {
    const count = Math.floor(perSide / plate + 1e-6);
    if (count > 0) {
      out.push({ plate, count });
      perSide -= count * plate;
    }
  }
  return out;
}

// The actual loadable weight (kg) for a target, given what plateBreakdown
// can assemble — used to round warm-up rungs to something real.
function loadableKg(targetWeightKg: number, unit: UnitSystem): number {
  const bar = kgToDisplay(BAR_KG[unit], unit);
  const perSide = plateBreakdown(targetWeightKg, unit).reduce(
    (s, p) => s + p.plate * p.count,
    0,
  );
  const displayWeight = bar + perSide * 2;
  return unit === "imperial" ? displayWeight * KG_PER_LB : displayWeight;
}

export interface WarmupRung {
  label: string; // e.g. "Bar", "60%"
  weightKg: number; // canonical, rounded to a loadable value
  reps: number;
}

// Standard ramp: bar-only, then 40/60/80% of the working weight, ending
// before the working set itself.
export function warmupLadder(targetWeightKg: number, unit: UnitSystem): WarmupRung[] {
  if (targetWeightKg <= 0) return [];
  const barKg = BAR_KG[unit];
  const rungs: WarmupRung[] = [{ label: "Bar", weightKg: loadableKg(barKg, unit), reps: 10 }];
  const steps: [number, number][] = [
    [0.4, 5],
    [0.6, 3],
    [0.8, 2],
  ];
  for (const [pct, reps] of steps) {
    const rungWeight = targetWeightKg * pct;
    if (rungWeight <= barKg) continue; // ramp only makes sense above the bar
    rungs.push({ label: `${Math.round(pct * 100)}%`, weightKg: loadableKg(rungWeight, unit), reps });
  }
  return rungs;
}
