// ── Data model (BUILD_SPEC §4) ─────────────────────────────────
export type Sex = "male" | "female";
export type ActivityLevel =
  | "Sedentary"
  | "Light"
  | "Moderate"
  | "Active"
  | "Very active";
export type GoalMode = "deficit" | "maintain" | "surplus";
export type UnitSystem = "metric" | "imperial";

export interface Profile {
  name: string;
  age: number;
  heightCm: number;
  weightKg: number; // current; also the latest weigh-in
  sex: Sex;
  activity: ActivityLevel;
  mode: GoalMode;
  proteinGoalG?: number; // manual override; falls back to 1.8g/kg when unset
  unitSystem?: UnitSystem; // display only — undefined = metric; storage always kg/cm
}

export type SetType = "warmup" | "working" | "drop" | "failure";

export interface SetEntry {
  weight: number; // kg
  reps: number;
  type?: SetType; // undefined = "working" (the default for new sets too)
  rpe?: number; // 1–10, optional
}

export interface Workout {
  id: string;
  date: string; // ISO yyyy-mm-dd
  name: string; // exercise name (library or custom)
  sets: SetEntry[];
  isPR?: boolean;
}

// A named, reusable list of exercises — no weight/reps/sets. Those are
// entered per exercise during a logging session, not stored on the routine.
export interface Routine {
  id: string;
  name: string;
  exercises: string[];
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

// Waist/chest/arms/hips — logged the same way as weigh-ins, all optional
// since a given entry might only cover one or two of them. Canonical cm.
export interface Measurement {
  id: string;
  date: string; // ISO yyyy-mm-dd
  waistCm?: number;
  chestCm?: number;
  armsCm?: number;
  hipsCm?: number;
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

export interface ProgressPhoto {
  id: string;
  date: string; // ISO yyyy-mm-dd — editable at save time, defaults to today
  storagePath: string; // Supabase Storage path: "{user_id}/{id}.jpg"
  weightKg?: number; // snapshot from the profile at capture time
  note?: string;
}

// Same shape as ProgressPhoto but with the blob base64-encoded, since JSON
// can't carry binary data (BUILD_SPEC §10 export/import).
export interface ExportedPhoto {
  id: string;
  date: string;
  dataUrl: string;
  weightKg?: number;
  note?: string;
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
  progressPhotos: ExportedPhoto[];
  routines: Routine[];
  measurements: Measurement[];
}
