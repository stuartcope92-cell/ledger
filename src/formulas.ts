// ── Core formulas (BUILD_SPEC §5 — implement exactly) ──────────
import type { ActivityLevel, GoalMode, Profile, SetEntry } from "./types";

export const ACTIVITY: Record<ActivityLevel, number> = {
  Sedentary: 1.2,
  Light: 1.375,
  Moderate: 1.55,
  Active: 1.725,
  "Very active": 1.9,
};

export const BASE_MET: Record<string, number> = {
  Running: 9.8,
  Walking: 3.8,
  Cycling: 7.5,
  Rowing: 7.0,
  Elliptical: 5.0,
  "Stair Climber": 8.0,
  Swimming: 8.0,
};

// BMR — Mifflin-St Jeor.
export function bmr({ weightKg, heightCm, age, sex }: Profile): number {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === "male" ? 5 : -161);
}

// TDEE (maintenance) = bmr * activityFactor.
export function tdee(profile: Profile): number {
  return Math.round(bmr(profile) * (ACTIVITY[profile.activity] ?? 1.2));
}

// Daily calorie target.
export function targetCalories(maintenance: number, mode: GoalMode): number {
  if (mode === "deficit") return maintenance - 400;
  if (mode === "surplus") return maintenance + 350;
  return maintenance;
}

// Protein target — 1.8 g per kg bodyweight (rounded).
export const proteinTarget = (weightKg: number): number =>
  Math.round(weightKg * 1.8);

// The protein target actually used app-wide: a manual goal from the You tab
// when set, else the 1.8g/kg calculation.
export const effectiveProteinTarget = (profile: Profile): number =>
  profile.proteinGoalG ?? proteinTarget(profile.weightKg);

// Cardio calories — MET method.
export function cardioCalories({
  type,
  duration,
  incline = 0,
  weightKg = 75,
}: {
  type: string;
  duration: number;
  incline?: number;
  weightKg?: number;
}): number {
  const met = (BASE_MET[type] ?? 5) * (1 + incline * 0.03);
  return Math.round(((met * 3.5 * weightKg) / 200) * duration);
}

// Estimated 1RM — Epley — for PRs.
export const estimated1RM = (weight: number, reps: number): number =>
  Math.round(weight * (1 + reps / 30));

// Best estimated 1RM across a list of sets.
export const bestSet1RM = (sets: SetEntry[]): number =>
  sets.reduce((best, s) => Math.max(best, estimated1RM(s.weight, s.reps)), 0);

// Total lift volume (Σ weight × reps).
export const setsVolume = (sets: SetEntry[]): number =>
  sets.reduce((sum, s) => sum + s.weight * s.reps, 0);

// BMI.
export const bmi = (weightKg: number, heightCm: number): number =>
  weightKg / Math.pow(heightCm / 100, 2);
