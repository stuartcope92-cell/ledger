// ── Unit conversion (kg/cm are always the canonical storage unit — this
// module only converts at the display/input boundary) ─────────────────
import type { Profile, UnitSystem } from "../types";

const KG_PER_LB = 0.45359237;
const CM_PER_IN = 2.54;

export const unitSystemOf = (p: Profile): UnitSystem => p.unitSystem ?? "metric";

export const weightUnitLabel = (u: UnitSystem): string => (u === "imperial" ? "lb" : "kg");
export const lengthUnitLabel = (u: UnitSystem): string => (u === "imperial" ? "in" : "cm");

const round1 = (n: number): number => Math.round(n * 10) / 10;

export const kgToDisplay = (kg: number, u: UnitSystem): number =>
  u === "imperial" ? round1(kg / KG_PER_LB) : round1(kg);

export const displayToKg = (val: number, u: UnitSystem): number =>
  u === "imperial" ? val * KG_PER_LB : val;

export const cmToDisplay = (cm: number, u: UnitSystem): number =>
  u === "imperial" ? round1(cm / CM_PER_IN) : round1(cm);

export const displayToCm = (val: number, u: UnitSystem): number =>
  u === "imperial" ? val * CM_PER_IN : val;

export const formatWeight = (kg: number, u: UnitSystem): string =>
  `${kgToDisplay(kg, u)} ${weightUnitLabel(u)}`;
