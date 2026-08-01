// ── Store: reactive reads + mutations over Supabase ─────────────
// Every table is scoped to the signed-in user via Postgres RLS (see
// supabase/schema.sql) — user_id defaults to auth.uid() at insert time, so
// none of this code ever threads a user id through by hand except for
// Storage paths (progress photos), which aren't RLS-scoped columns.
//
// Reactivity: Dexie's useLiveQuery made every hook reactive to any writer.
// React Query reproduces that with a shared cache keyed by queryKey — every
// mutation below calls invalidateQueries() on the relevant key(s) after a
// successful write, so all mounted instances of e.g. useWorkouts() refetch
// together, matching the old cross-component behaviour (this was always
// reactive only within one open tab, never cross-device — that hasn't
// changed).
import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "./queryClient";
import { supabase } from "./services/supabase";
import { DEFAULT_PROFILE, TEMPLATES } from "./seed";
import { bestSet1RM, estimated1RM } from "./formulas";
import { evaluatePerformance, prescribeNext, updateAfterPerformance } from "./progression";
import { todayISO } from "./utils/date";
import { blobToDataUrl, dataUrlToBlob } from "./utils/image";
import type {
  CardioSession,
  DailyMisc,
  ExportBundle,
  ExportedPhoto,
  LiftType,
  Meal,
  MealTemplate,
  Measurement,
  PRRecord,
  Profile,
  ProgrammedLift,
  ProgressionPhase,
  ProgressPhoto,
  Routine,
  SetEntry,
  WeighIn,
  Workout,
} from "./types";

export const uid = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

async function currentUserId(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Not signed in.");
  return session.user.id;
}

// ── Profile (one row per user; camelCase <-> snake_case mapping) ───────
interface ProfileRow {
  name: string;
  age: number;
  height_cm: number;
  weight_kg: number;
  sex: string;
  activity: string;
  mode: string;
  target_weight_kg: number | null;
  protein_goal_g: number | null;
  unit_system: string | null;
}

const rowToProfile = (r: ProfileRow): Profile => ({
  name: r.name,
  age: r.age,
  heightCm: r.height_cm,
  weightKg: r.weight_kg,
  sex: r.sex as Profile["sex"],
  activity: r.activity as Profile["activity"],
  mode: r.mode as Profile["mode"],
  targetWeightKg: r.target_weight_kg ?? undefined,
  proteinGoalG: r.protein_goal_g ?? undefined,
  unitSystem: (r.unit_system ?? undefined) as Profile["unitSystem"],
});

const profileToRow = (p: Profile) => ({
  name: p.name,
  age: p.age,
  height_cm: p.heightCm,
  weight_kg: p.weightKg,
  sex: p.sex,
  activity: p.activity,
  mode: p.mode,
  target_weight_kg: p.targetWeightKg ?? null,
  protein_goal_g: p.proteinGoalG ?? null,
  unit_system: p.unitSystem ?? null,
});

async function fetchProfile(): Promise<Profile> {
  const { data, error } = await supabase.from("profiles").select("*").maybeSingle();
  if (error) throw error;
  return data ? rowToProfile(data) : DEFAULT_PROFILE;
}

async function saveProfile(profile: Profile): Promise<void> {
  const { error } = await supabase.from("profiles").upsert(profileToRow(profile));
  if (error) throw error;
}

export function useProfile(): [Profile, (patch: Partial<Profile>) => void] {
  const { data } = useQuery({ queryKey: ["profile"], queryFn: fetchProfile });
  const profile = data ?? DEFAULT_PROFILE;

  // Optimistic: profile fields are typed/toggled live (age, weight, units,
  // ...), so the UI updates the shared cache immediately rather than
  // waiting on a round trip per keystroke — the network save happens after.
  const update = useCallback((patch: Partial<Profile>) => {
    const current = queryClient.getQueryData<Profile>(["profile"]) ?? DEFAULT_PROFILE;
    const next = { ...current, ...patch };
    queryClient.setQueryData(["profile"], next);
    void saveProfile(next).then(() => queryClient.invalidateQueries({ queryKey: ["profile"] }));
  }, []);

  return [profile, update];
}

// ── Workouts ─────────────────────────────────────────────────────────
interface WorkoutRow {
  id: string;
  date: string;
  name: string;
  sets: SetEntry[];
  is_pr: boolean | null;
}
const rowToWorkout = (r: WorkoutRow): Workout => ({
  id: r.id,
  date: r.date,
  name: r.name,
  sets: r.sets,
  isPR: r.is_pr ?? undefined,
});

async function fetchWorkouts(): Promise<Workout[]> {
  const { data, error } = await supabase.from("workouts").select("*").order("date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToWorkout);
}

export const useWorkouts = (): Workout[] =>
  useQuery({ queryKey: ["workouts"], queryFn: fetchWorkouts }).data ?? [];

// Save a workout. Detects a PR by comparing this session's best est. 1RM
// against the best previously recorded for the same exercise name.
export async function addWorkout(
  name: string,
  sets: SetEntry[],
  date: string = todayISO(),
): Promise<boolean> {
  const { data: prior, error: fetchErr } = await supabase.from("workouts").select("sets").eq("name", name);
  if (fetchErr) throw fetchErr;
  const priorBest = (prior ?? []).reduce((b, w) => Math.max(b, bestSet1RM(w.sets as SetEntry[])), 0);
  const isPR = bestSet1RM(sets) > priorBest;
  const { error } = await supabase.from("workouts").insert({ id: uid(), name, sets, date, is_pr: isPR });
  if (error) throw error;
  queryClient.invalidateQueries({ queryKey: ["workouts"] });
  await advanceProgrammedLift(name, sets);
  return isPR;
}

// Edit an existing workout's exercise/sets/date. Re-derives isPR the same
// way addWorkout does, comparing against every OTHER workout of that name
// so editing a set doesn't just keep whatever PR flag it happened to save
// with originally.
export async function updateWorkout(
  id: string,
  name: string,
  sets: SetEntry[],
  date: string,
): Promise<boolean> {
  const { data: prior, error: fetchErr } = await supabase.from("workouts").select("id, sets").eq("name", name);
  if (fetchErr) throw fetchErr;
  const priorBest = (prior ?? [])
    .filter((w) => w.id !== id)
    .reduce((b, w) => Math.max(b, bestSet1RM(w.sets as SetEntry[])), 0);
  const isPR = bestSet1RM(sets) > priorBest;
  const { error } = await supabase.from("workouts").update({ name, sets, date, is_pr: isPR }).eq("id", id);
  if (error) throw error;
  queryClient.invalidateQueries({ queryKey: ["workouts"] });
  return isPR;
}

export async function deleteWorkout(id: string): Promise<void> {
  const { error } = await supabase.from("workouts").delete().eq("id", id);
  if (error) throw error;
  queryClient.invalidateQueries({ queryKey: ["workouts"] });
}

// ── Routines ─────────────────────────────────────────────────────────
// Hold exercise names only — weight/reps/sets are logged per exercise
// during a session, never pre-filled.
async function fetchRoutines(): Promise<Routine[]> {
  const { data, error } = await supabase.from("routines").select("*").order("name");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    exercises: r.exercises as string[],
    linked: (r.linked as boolean[] | null) ?? undefined,
  }));
}

export const useRoutines = (): Routine[] =>
  useQuery({ queryKey: ["routines"], queryFn: fetchRoutines }).data ?? [];

export async function addRoutine(name: string, exercises: string[], linked?: boolean[]): Promise<void> {
  const { error } = await supabase.from("routines").insert({ id: uid(), name, exercises, linked: linked ?? null });
  if (error) throw error;
  queryClient.invalidateQueries({ queryKey: ["routines"] });
}

export async function deleteRoutine(id: string): Promise<void> {
  const { error } = await supabase.from("routines").delete().eq("id", id);
  if (error) throw error;
  queryClient.invalidateQueries({ queryKey: ["routines"] });
}

// Seed the built-in Push/Pull/Leg Day routines once per user, only if they
// have none yet (fresh account, or upgrading from before routines existed).
export async function ensureDefaultRoutines(): Promise<void> {
  const { count, error } = await supabase.from("routines").select("*", { count: "exact", head: true });
  if (error) throw error;
  if ((count ?? 0) > 0) return;
  const seeds = Object.entries(TEMPLATES).map(([name, exercises]) => ({
    id: `seed-${name.toLowerCase().replace(/\s+/g, "-")}`,
    name,
    exercises,
  }));
  const { error: insertErr } = await supabase.from("routines").insert(seeds);
  if (insertErr) throw insertErr;
  queryClient.invalidateQueries({ queryKey: ["routines"] });
}

// ── Programmed lifts (optional per-exercise auto-progression + goal) ───
interface ProgrammedLiftRow {
  id: string;
  exercise_name: string;
  type: string;
  current_weight: number;
  current_reps: number;
  rep_range_min: number;
  rep_range_max: number;
  sets: number;
  progression_phase: string;
  assist_levels: number[] | null;
  assist_level_index: number | null;
  consecutive_failures: number;
  target_weight: number;
  target_reps: number;
  target_1rm: number;
}

const rowToProgrammedLift = (r: ProgrammedLiftRow): ProgrammedLift => ({
  id: r.id,
  exerciseName: r.exercise_name,
  type: r.type as LiftType,
  currentWeight: r.current_weight,
  currentReps: r.current_reps,
  repRangeMin: r.rep_range_min,
  repRangeMax: r.rep_range_max,
  sets: r.sets,
  progressionPhase: r.progression_phase as ProgressionPhase,
  assistLevels: r.assist_levels ?? undefined,
  assistLevelIndex: r.assist_level_index ?? undefined,
  consecutiveFailures: r.consecutive_failures,
  targetWeight: r.target_weight,
  targetReps: r.target_reps,
  target1RM: r.target_1rm,
});

const programmedLiftToRow = (l: ProgrammedLift) => ({
  id: l.id,
  exercise_name: l.exerciseName,
  type: l.type,
  current_weight: l.currentWeight,
  current_reps: l.currentReps,
  rep_range_min: l.repRangeMin,
  rep_range_max: l.repRangeMax,
  sets: l.sets,
  progression_phase: l.progressionPhase,
  assist_levels: l.assistLevels ?? null,
  assist_level_index: l.assistLevelIndex ?? null,
  consecutive_failures: l.consecutiveFailures,
  target_weight: l.targetWeight,
  target_reps: l.targetReps,
  target_1rm: l.target1RM,
});

async function fetchProgrammedLifts(): Promise<ProgrammedLift[]> {
  const { data, error } = await supabase.from("programmed_lifts").select("*");
  if (error) throw error;
  return (data ?? []).map(rowToProgrammedLift);
}

export const useProgrammedLifts = (): ProgrammedLift[] =>
  useQuery({ queryKey: ["programmedLifts"], queryFn: fetchProgrammedLifts }).data ?? [];

export async function saveProgrammedLift(lift: ProgrammedLift): Promise<void> {
  const { error } = await supabase.from("programmed_lifts").upsert(programmedLiftToRow(lift));
  if (error) throw error;
  queryClient.invalidateQueries({ queryKey: ["programmedLifts"] });
}

export async function deleteProgrammedLift(id: string): Promise<void> {
  const { error } = await supabase.from("programmed_lifts").delete().eq("id", id);
  if (error) throw error;
  queryClient.invalidateQueries({ queryKey: ["programmedLifts"] });
}

// If this exercise has an active goal, evaluate the just-logged session
// against its current prescription and advance its progression state —
// derived automatically from the sets just saved, no separate "did you hit
// it?" step for the user.
async function advanceProgrammedLift(exerciseName: string, sets: SetEntry[]): Promise<void> {
  const { data, error } = await supabase
    .from("programmed_lifts")
    .select("*")
    .eq("exercise_name", exerciseName)
    .maybeSingle();
  if (error) throw error;
  if (!data) return;
  const lift = rowToProgrammedLift(data as ProgrammedLiftRow);
  const prescription = prescribeNext(lift);
  const performance = evaluatePerformance(sets, prescription);
  await saveProgrammedLift(updateAfterPerformance(lift, prescription, performance));
}

// ── Cardio ───────────────────────────────────────────────────────────
async function fetchCardio(): Promise<CardioSession[]> {
  const { data, error } = await supabase
    .from("cardio_sessions")
    .select("id, date, type, duration, pace, incline, cal")
    .order("date", { ascending: false });
  if (error) throw error;
  // Named columns (not select("*")) so no stray user_id rides along into
  // exports — bundle.cardio gets inserted as-is on import, which would
  // otherwise carry a user_id that could mismatch the importing account.
  return (data ?? []) as CardioSession[];
}

export const useCardio = (): CardioSession[] =>
  useQuery({ queryKey: ["cardio"], queryFn: fetchCardio }).data ?? [];

export async function addCardio(session: Omit<CardioSession, "id">): Promise<void> {
  const { error } = await supabase.from("cardio_sessions").insert({ id: uid(), ...session });
  if (error) throw error;
  queryClient.invalidateQueries({ queryKey: ["cardio"] });
}

export async function updateCardio(id: string, session: Omit<CardioSession, "id">): Promise<void> {
  const { error } = await supabase.from("cardio_sessions").update(session).eq("id", id);
  if (error) throw error;
  queryClient.invalidateQueries({ queryKey: ["cardio"] });
}

export async function deleteCardio(id: string): Promise<void> {
  const { error } = await supabase.from("cardio_sessions").delete().eq("id", id);
  if (error) throw error;
  queryClient.invalidateQueries({ queryKey: ["cardio"] });
}

// ── Meals ────────────────────────────────────────────────────────────
async function fetchMeals(): Promise<Meal[]> {
  const { data, error } = await supabase
    .from("meals")
    .select("id, date, name, cal, p, c, f, source")
    .order("date", { ascending: false });
  if (error) throw error;
  // Named columns (not select("*")) — same reason as fetchCardio: no stray
  // user_id riding along into exports/imports.
  return (data ?? []) as Meal[];
}

export const useMeals = (): Meal[] => useQuery({ queryKey: ["meals"], queryFn: fetchMeals }).data ?? [];

export async function addMeal(meal: Omit<Meal, "id">): Promise<void> {
  const { error } = await supabase.from("meals").insert({ id: uid(), ...meal });
  if (error) throw error;
  queryClient.invalidateQueries({ queryKey: ["meals"] });
}

export async function updateMeal(id: string, meal: Omit<Meal, "id">): Promise<void> {
  const { error } = await supabase.from("meals").update(meal).eq("id", id);
  if (error) throw error;
  queryClient.invalidateQueries({ queryKey: ["meals"] });
}

export async function deleteMeal(id: string): Promise<void> {
  const { error } = await supabase.from("meals").delete().eq("id", id);
  if (error) throw error;
  queryClient.invalidateQueries({ queryKey: ["meals"] });
}

// ── Meal templates ───────────────────────────────────────────────────
async function fetchMealTemplates(): Promise<MealTemplate[]> {
  const { data, error } = await supabase
    .from("meal_templates")
    .select("id, name, cal, p, c, f")
    .order("name");
  if (error) throw error;
  return (data ?? []) as MealTemplate[];
}

export const useMealTemplates = (): MealTemplate[] =>
  useQuery({ queryKey: ["mealTemplates"], queryFn: fetchMealTemplates }).data ?? [];

export async function addMealTemplate(template: Omit<MealTemplate, "id">): Promise<void> {
  const { error } = await supabase.from("meal_templates").insert({ id: uid(), ...template });
  if (error) throw error;
  queryClient.invalidateQueries({ queryKey: ["mealTemplates"] });
}

export async function deleteMealTemplate(id: string): Promise<void> {
  const { error } = await supabase.from("meal_templates").delete().eq("id", id);
  if (error) throw error;
  queryClient.invalidateQueries({ queryKey: ["mealTemplates"] });
}

// ── Weigh-ins ────────────────────────────────────────────────────────
async function fetchWeighIns(): Promise<WeighIn[]> {
  const { data, error } = await supabase.from("weigh_ins").select("*").order("date", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({ id: r.id, date: r.date, weightKg: r.weight_kg }));
}

export const useWeighIns = (): WeighIn[] =>
  useQuery({ queryKey: ["weighIns"], queryFn: fetchWeighIns }).data ?? [];

// Record a weigh-in and keep the profile's current weight in sync.
export async function logWeight(weightKg: number, date: string = todayISO()): Promise<void> {
  const { error } = await supabase.from("weigh_ins").insert({ id: uid(), date, weight_kg: weightKg });
  if (error) throw error;
  const profile = await fetchProfile();
  await saveProfile({ ...profile, weightKg });
  queryClient.invalidateQueries({ queryKey: ["weighIns"] });
  queryClient.invalidateQueries({ queryKey: ["profile"] });
}

// ── Measurements ─────────────────────────────────────────────────────
interface MeasurementRow {
  id: string;
  date: string;
  waist_cm: number | null;
  chest_cm: number | null;
  arms_cm: number | null;
  hips_cm: number | null;
}
const rowToMeasurement = (r: MeasurementRow): Measurement => ({
  id: r.id,
  date: r.date,
  waistCm: r.waist_cm ?? undefined,
  chestCm: r.chest_cm ?? undefined,
  armsCm: r.arms_cm ?? undefined,
  hipsCm: r.hips_cm ?? undefined,
});
const measurementToRow = (m: Omit<Measurement, "id">) => ({
  date: m.date,
  waist_cm: m.waistCm ?? null,
  chest_cm: m.chestCm ?? null,
  arms_cm: m.armsCm ?? null,
  hips_cm: m.hipsCm ?? null,
});

async function fetchMeasurements(): Promise<Measurement[]> {
  const { data, error } = await supabase.from("measurements").select("*").order("date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToMeasurement);
}

export const useMeasurements = (): Measurement[] =>
  useQuery({ queryKey: ["measurements"], queryFn: fetchMeasurements }).data ?? [];

export async function addMeasurement(m: Omit<Measurement, "id">): Promise<void> {
  const { error } = await supabase.from("measurements").insert({ id: uid(), ...measurementToRow(m) });
  if (error) throw error;
  queryClient.invalidateQueries({ queryKey: ["measurements"] });
}

export async function updateMeasurement(id: string, m: Omit<Measurement, "id">): Promise<void> {
  const { error } = await supabase.from("measurements").update(measurementToRow(m)).eq("id", id);
  if (error) throw error;
  queryClient.invalidateQueries({ queryKey: ["measurements"] });
}

export async function deleteMeasurement(id: string): Promise<void> {
  const { error } = await supabase.from("measurements").delete().eq("id", id);
  if (error) throw error;
  queryClient.invalidateQueries({ queryKey: ["measurements"] });
}

// ── Daily misc (water/steps) ─────────────────────────────────────────
interface DailyMiscRow {
  date: string;
  water_glasses: number;
  steps: number;
}
const rowToDailyMisc = (r: DailyMiscRow): DailyMisc => ({
  date: r.date,
  waterGlasses: r.water_glasses,
  steps: r.steps,
});

async function fetchDailyMisc(date: string): Promise<DailyMisc> {
  const { data, error } = await supabase.from("daily_misc").select("*").eq("date", date).maybeSingle();
  if (error) throw error;
  return data ? rowToDailyMisc(data) : { date, waterGlasses: 0, steps: 0 };
}

async function fetchAllDailyMisc(): Promise<DailyMisc[]> {
  const { data, error } = await supabase.from("daily_misc").select("*");
  if (error) throw error;
  return (data ?? []).map(rowToDailyMisc);
}

async function saveDailyMisc(row: DailyMisc): Promise<void> {
  const { error } = await supabase
    .from("daily_misc")
    .upsert({ date: row.date, water_glasses: row.waterGlasses, steps: row.steps });
  if (error) throw error;
}

export function useDailyMisc(date: string = todayISO()): DailyMisc {
  const { data } = useQuery({ queryKey: ["dailyMisc", date], queryFn: () => fetchDailyMisc(date) });
  return data ?? { date, waterGlasses: 0, steps: 0 };
}

// Water/steps are tapped/typed frequently — optimistic update from the
// cache (not a network re-fetch) so the UI reflects the change instantly.
export async function setWater(glasses: number, date: string = todayISO()): Promise<void> {
  const current = queryClient.getQueryData<DailyMisc>(["dailyMisc", date]) ?? { date, waterGlasses: 0, steps: 0 };
  const next = { ...current, waterGlasses: Math.max(0, glasses) };
  queryClient.setQueryData(["dailyMisc", date], next);
  await saveDailyMisc(next);
  queryClient.invalidateQueries({ queryKey: ["dailyMisc", date] });
}
export async function setSteps(steps: number, date: string = todayISO()): Promise<void> {
  const current = queryClient.getQueryData<DailyMisc>(["dailyMisc", date]) ?? { date, waterGlasses: 0, steps: 0 };
  const next = { ...current, steps: Math.max(0, steps) };
  queryClient.setQueryData(["dailyMisc", date], next);
  await saveDailyMisc(next);
  queryClient.invalidateQueries({ queryKey: ["dailyMisc", date] });
}

// ── Progress photos ──────────────────────────────────────────────────
// Metadata lives in Postgres; image bytes live in the "progress-photos"
// Storage bucket at "{user_id}/{id}.jpg", scoped by a Storage RLS policy —
// see supabase/schema.sql. Display goes through useSignedPhotoUrl
// (src/utils/useSignedPhotoUrl.ts), not a direct blob URL, since the
// bucket is private.
interface ProgressPhotoRow {
  id: string;
  date: string;
  weight_kg: number | null;
  note: string | null;
  storage_path: string;
}
const rowToProgressPhoto = (r: ProgressPhotoRow): ProgressPhoto => ({
  id: r.id,
  date: r.date,
  storagePath: r.storage_path,
  weightKg: r.weight_kg ?? undefined,
  note: r.note ?? undefined,
});

async function fetchProgressPhotos(): Promise<ProgressPhoto[]> {
  const { data, error } = await supabase.from("progress_photos").select("*").order("date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToProgressPhoto);
}

// Newest first, matching the other log lists.
export const useProgressPhotos = (): ProgressPhoto[] =>
  useQuery({ queryKey: ["progressPhotos"], queryFn: fetchProgressPhotos }).data ?? [];

export async function addProgressPhoto(photo: {
  date: string;
  blob: Blob;
  weightKg?: number;
  note?: string;
}): Promise<void> {
  const id = uid();
  const userId = await currentUserId();
  const path = `${userId}/${id}.jpg`;
  const { error: uploadErr } = await supabase.storage
    .from("progress-photos")
    .upload(path, photo.blob, { contentType: "image/jpeg" });
  if (uploadErr) throw uploadErr;
  const { error } = await supabase.from("progress_photos").insert({
    id,
    date: photo.date,
    weight_kg: photo.weightKg ?? null,
    note: photo.note ?? null,
    storage_path: path,
  });
  if (error) throw error;
  queryClient.invalidateQueries({ queryKey: ["progressPhotos"] });
}

export async function deleteProgressPhoto(id: string): Promise<void> {
  const { data, error: fetchErr } = await supabase
    .from("progress_photos")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (data) {
    await supabase.storage.from("progress-photos").remove([data.storage_path]);
  }
  const { error } = await supabase.from("progress_photos").delete().eq("id", id);
  if (error) throw error;
  queryClient.invalidateQueries({ queryKey: ["progressPhotos"] });
}

// ── Derived: personal records across all workouts ──────────────
// Pure function over whatever useWorkouts() returns — unaffected by the
// move from Dexie to Supabase.
export function personalRecords(workouts: Workout[]): PRRecord[] {
  const best = new Map<string, PRRecord>();
  for (const w of workouts) {
    for (const s of w.sets) {
      const e1rm = estimated1RM(s.weight, s.reps);
      const existing = best.get(w.name);
      if (!existing || e1rm > existing.estimated1RM) {
        best.set(w.name, {
          exercise: w.name,
          estimated1RM: e1rm,
          date: w.date,
        });
      }
    }
  }
  return [...best.values()].sort((a, b) => b.estimated1RM - a.estimated1RM);
}

// ── Export / Import (BUILD_SPEC §10) ────────────────────────────────
export async function buildExport(): Promise<ExportBundle> {
  const [profile, workouts, cardio, meals, weighIns, dailyMisc, photos, routines, measurements, mealTemplates] =
    await Promise.all([
      fetchProfile(),
      fetchWorkouts(),
      fetchCardio(),
      fetchMeals(),
      fetchWeighIns(),
      fetchAllDailyMisc(),
      fetchProgressPhotos(),
      fetchRoutines(),
      fetchMeasurements(),
      fetchMealTemplates(),
    ]);
  const progressPhotos: ExportedPhoto[] = await Promise.all(
    photos.map(async (p) => {
      const { data: blob, error } = await supabase.storage.from("progress-photos").download(p.storagePath);
      if (error || !blob) throw error ?? new Error(`Could not download photo ${p.id}`);
      return {
        id: p.id,
        date: p.date,
        weightKg: p.weightKg,
        note: p.note,
        dataUrl: await blobToDataUrl(blob),
      };
    }),
  );
  return {
    version: 4,
    exportedAt: new Date().toISOString(),
    profile,
    workouts,
    cardio,
    meals,
    weighIns,
    dailyMisc,
    progressPhotos,
    routines,
    measurements,
    mealTemplates,
  };
}

// Replace all data with an imported bundle. Note: unlike the old Dexie
// version this is NOT a single all-or-nothing transaction — Supabase's
// client REST API has no cross-table transaction primitive — so a failure
// partway through can leave a partial import. Acceptable for a backup/
// restore feature that isn't part of daily use; RLS still guarantees this
// only ever touches the signed-in user's own rows.
export async function importBundle(bundle: ExportBundle): Promise<void> {
  if (!bundle || typeof bundle !== "object" || !bundle.profile) {
    throw new Error("Not a valid Ledger export file.");
  }
  const userId = await currentUserId();

  const clears = await Promise.all([
    supabase.from("workouts").delete().neq("id", ""),
    supabase.from("cardio_sessions").delete().neq("id", ""),
    supabase.from("meals").delete().neq("id", ""),
    supabase.from("weigh_ins").delete().neq("id", ""),
    supabase.from("progress_photos").delete().neq("id", ""),
    supabase.from("routines").delete().neq("id", ""),
    supabase.from("measurements").delete().neq("id", ""),
    supabase.from("daily_misc").delete().neq("date", "0001-01-01"),
    supabase.from("meal_templates").delete().neq("id", ""),
  ]);
  for (const { error } of clears) if (error) throw error;

  const photoRows = await Promise.all(
    (bundle.progressPhotos ?? []).map(async (p) => {
      const blob = await dataUrlToBlob(p.dataUrl);
      const path = `${userId}/${p.id}.jpg`;
      const { error } = await supabase.storage
        .from("progress-photos")
        .upload(path, blob, { contentType: "image/jpeg", upsert: true });
      if (error) throw error;
      return { id: p.id, date: p.date, weight_kg: p.weightKg ?? null, note: p.note ?? null, storage_path: path };
    }),
  );

  const inserts = await Promise.all([
    bundle.workouts?.length
      ? supabase
          .from("workouts")
          .insert(bundle.workouts.map((w) => ({ id: w.id, date: w.date, name: w.name, sets: w.sets, is_pr: w.isPR ?? null })))
      : Promise.resolve({ error: null }),
    bundle.cardio?.length ? supabase.from("cardio_sessions").insert(bundle.cardio) : Promise.resolve({ error: null }),
    bundle.meals?.length ? supabase.from("meals").insert(bundle.meals) : Promise.resolve({ error: null }),
    bundle.weighIns?.length
      ? supabase.from("weigh_ins").insert(bundle.weighIns.map((w) => ({ id: w.id, date: w.date, weight_kg: w.weightKg })))
      : Promise.resolve({ error: null }),
    bundle.dailyMisc?.length
      ? supabase
          .from("daily_misc")
          .insert(bundle.dailyMisc.map((d) => ({ date: d.date, water_glasses: d.waterGlasses, steps: d.steps })))
      : Promise.resolve({ error: null }),
    photoRows.length ? supabase.from("progress_photos").insert(photoRows) : Promise.resolve({ error: null }),
    bundle.routines?.length ? supabase.from("routines").insert(bundle.routines) : Promise.resolve({ error: null }),
    bundle.measurements?.length
      ? supabase.from("measurements").insert(
          bundle.measurements.map((m) => ({
            id: m.id,
            date: m.date,
            waist_cm: m.waistCm ?? null,
            chest_cm: m.chestCm ?? null,
            arms_cm: m.armsCm ?? null,
            hips_cm: m.hipsCm ?? null,
          })),
        )
      : Promise.resolve({ error: null }),
    bundle.mealTemplates?.length
      ? supabase.from("meal_templates").insert(bundle.mealTemplates.map((t) => ({ ...t })))
      : Promise.resolve({ error: null }),
  ]);
  for (const { error } of inserts) if (error) throw error;
  await saveProfile(bundle.profile);

  queryClient.invalidateQueries();
}
