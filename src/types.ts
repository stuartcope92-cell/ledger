// ── Data model (BUILD_SPEC §4) ─────────────────────────────────
export type Sex = "male" | "female";
export type ActivityLevel =
  | "Sedentary"
  | "Light"
  | "Moderate"
  | "Active"
  | "Very active";
export type GoalMode = "deficit" | "maintain" | "surplus";

export interface Profile {
  name: string;
  age: number;
  heightCm: number;
  weightKg: number; // current; also the latest weigh-in
  sex: Sex;
  activity: ActivityLevel;
  mode: GoalMode;
}

export interface SetEntry {
  weight: number; // kg
  reps: number;
}

export interface Workout {
  id: string;
  date: string; // ISO yyyy-mm-dd
  name: string; // exercise name (library or custom)
  sets: SetEntry[];
  isPR?: boolean;
}

export interface CardioSession {
  id: string;
  date: string; // ISO yyyy-mm-dd
  type: string; // Running, Walking, Cycling, ...
  duration: number; // minutes
  pace: number; // min per km
  incline: number; // %
  cal: number; // computed at save time
}

export type MealSource = "search" | "photo" | "manual";

export interface Meal {
  id: string;
  date: string; // ISO yyyy-mm-dd
  name: string;
  cal: number;
  p: number;
  c: number;
  f: number; // grams
  source: MealSource;
}

export interface WeighIn {
  id: string;
  date: string; // ISO yyyy-mm-dd
  weightKg: number;
}

export interface DailyMisc {
  date: string; // ISO yyyy-mm-dd (primary key)
  waterGlasses: number;
  steps: number;
}

export interface PRRecord {
  exercise: string;
  estimated1RM: number;
  date: string;
}

// Full export/import payload (BUILD_SPEC §6 "You", §10).
export interface ExportBundle {
  version: number;
  exportedAt: string;
  profile: Profile;
  workouts: Workout[];
  cardio: CardioSession[];
  meals: Meal[];
  weighIns: WeighIn[];
  dailyMisc: DailyMisc[];
}
