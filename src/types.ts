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
  mode: GoalMode; // manual selection; ignored once targetWeightKg is set (see effectiveMode)
  targetWeightKg?: number; // optional goal weight; when set, auto-derives mode instead of the manual toggle
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
  // linked[i] = true means exercises[i] and exercises[i+1] are a superset
  // pair (back-to-back, minimal rest); consecutive true entries chain into
  // a larger group. Length exercises.length-1; absent/undefined = no
  // supersets (all older routines, and any routine that never used one).
  linked?: boolean[];
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

// A user-saved go-to meal (name + fixed macros, no date) — distinct from
// the Recent shelf's implicit history, for anything logged often enough to
// be worth naming and keeping around past the Recent shelf's 8-item cap.
export interface MealTemplate {
  id: string;
  name: string;
  cal: number;
  p: number;
  c: number;
  f: number;
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

// ── Programmed lifts (optional per-exercise auto-progression + goal) ───
// Opt-in overlay on an existing exercise: plain ad-hoc logging (Workout)
// still works for everything, programmed or not. One row per exercise the
// user has set a goal for.
export type LiftType = "compound" | "assisted";
export type ProgressionPhase = "rep" | "tempo" | "volume" | "weight_jump";

export interface ProgrammedLift {
  id: string;
  exerciseName: string; // matches Workout.name / EXERCISE_LIBRARY
  type: LiftType;
  currentWeight: number; // kg; for assisted, the current assist value
  currentReps: number;
  repRangeMin: number;
  repRangeMax: number;
  sets: number;
  progressionPhase: ProgressionPhase;
  assistLevels?: number[]; // assisted only, descending, must end in 0
  assistLevelIndex?: number; // index into assistLevels — source of truth, not a currentWeight equality match
  consecutiveFailures: number;
  targetWeight: number; // 0 for assisted (fully unassisted is the goal)
  targetReps: number;
  target1RM: number; // computed once at goal-set time; unused for assisted
}

// This week's prescribed weight/reps/sets for a programmed lift — a pure
// function of ProgrammedLift, never persisted on its own.
export interface Prescription {
  weight: number;
  reps: number;
  sets: number;
  phase: ProgressionPhase;
  assistLevelIndex?: number; // assisted only — internal bookkeeping, not shown in UI
}

export interface PerformanceResult {
  success: boolean; // hit every prescribed set's reps
  exceeded: boolean; // beat the prescribed reps on at least one set
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
  mealTemplates: MealTemplate[];
}
