// ── Store: reactive reads + mutations over Dexie ───────────────
import { useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  db,
  getProfile,
  getDailyMisc,
  saveDailyMisc,
  saveProfile,
} from "./db";
import { DEFAULT_PROFILE } from "./seed";
import { bestSet1RM, estimated1RM } from "./formulas";
import { todayISO } from "./utils/date";
import type {
  CardioSession,
  DailyMisc,
  Meal,
  Measurement,
  PRRecord,
  Profile,
  ProgressPhoto,
  Routine,
  SetEntry,
  Workout,
} from "./types";

const uid = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

// ── Profile ────────────────────────────────────────────────────
export function useProfile(): [Profile, (patch: Partial<Profile>) => void] {
  const profile = useLiveQuery(getProfile, [], DEFAULT_PROFILE) ?? DEFAULT_PROFILE;
  const update = useCallback(
    (patch: Partial<Profile>) => {
      void saveProfile({ ...profile, ...patch });
    },
    [profile],
  );
  return [profile, update];
}

// ── Log collections ────────────────────────────────────────────
export const useWorkouts = (): Workout[] =>
  useLiveQuery(() => db.workouts.orderBy("date").reverse().toArray(), [], []) ??
  [];

export const useCardio = (): CardioSession[] =>
  useLiveQuery(() => db.cardio.orderBy("date").reverse().toArray(), [], []) ?? [];

export const useMeals = (): Meal[] =>
  useLiveQuery(() => db.meals.orderBy("date").reverse().toArray(), [], []) ?? [];

export const useWeighIns = () =>
  useLiveQuery(() => db.weighIns.orderBy("date").toArray(), [], []) ?? [];

export const useMeasurements = (): Measurement[] =>
  useLiveQuery(() => db.measurements.orderBy("date").reverse().toArray(), [], []) ?? [];

// Newest first, matching the other log lists.
export const useProgressPhotos = (): ProgressPhoto[] =>
  useLiveQuery(() => db.progressPhotos.orderBy("date").reverse().toArray(), [], []) ?? [];

export const useRoutines = (): Routine[] =>
  useLiveQuery(() => db.routines.orderBy("name").toArray(), [], []) ?? [];

export function useDailyMisc(date: string = todayISO()): DailyMisc {
  return (
    useLiveQuery(() => getDailyMisc(date), [date], {
      date,
      waterGlasses: 0,
      steps: 0,
    }) ?? { date, waterGlasses: 0, steps: 0 }
  );
}

// ── Mutations ──────────────────────────────────────────────────

// Save a workout. Detects a PR by comparing this session's best est. 1RM
// against the best previously recorded for the same exercise name.
export async function addWorkout(
  name: string,
  sets: SetEntry[],
  date: string = todayISO(),
): Promise<boolean> {
  const prior = await db.workouts.where("name").equals(name).toArray();
  const priorBest = prior.reduce((b, w) => Math.max(b, bestSet1RM(w.sets)), 0);
  const best = bestSet1RM(sets);
  const isPR = best > priorBest;
  await db.workouts.add({ id: uid(), name, sets, date, isPR });
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
  const prior = await db.workouts.where("name").equals(name).toArray();
  const priorBest = prior
    .filter((w) => w.id !== id)
    .reduce((b, w) => Math.max(b, bestSet1RM(w.sets)), 0);
  const isPR = bestSet1RM(sets) > priorBest;
  await db.workouts.update(id, { name, sets, date, isPR });
  return isPR;
}

export const deleteWorkout = (id: string) => db.workouts.delete(id);

// Routines hold exercise names only — weight/reps/sets are logged per
// exercise during a session, never pre-filled.
export async function addRoutine(name: string, exercises: string[]): Promise<void> {
  await db.routines.add({ id: uid(), name, exercises });
}
export const deleteRoutine = (id: string) => db.routines.delete(id);

export async function addCardio(
  session: Omit<CardioSession, "id">,
): Promise<void> {
  await db.cardio.add({ id: uid(), ...session });
}
export async function updateCardio(id: string, session: Omit<CardioSession, "id">): Promise<void> {
  await db.cardio.update(id, session);
}
export const deleteCardio = (id: string) => db.cardio.delete(id);

export async function addMeal(meal: Omit<Meal, "id">): Promise<void> {
  await db.meals.add({ id: uid(), ...meal });
}
export async function updateMeal(id: string, meal: Omit<Meal, "id">): Promise<void> {
  await db.meals.update(id, meal);
}
export const deleteMeal = (id: string) => db.meals.delete(id);

// Record a weigh-in and keep the profile's current weight in sync.
export async function logWeight(
  weightKg: number,
  date: string = todayISO(),
): Promise<void> {
  await db.weighIns.add({ id: uid(), date, weightKg });
  const profile = await getProfile();
  await saveProfile({ ...profile, weightKg });
}

export async function addMeasurement(m: Omit<Measurement, "id">): Promise<void> {
  await db.measurements.add({ id: uid(), ...m });
}
export async function updateMeasurement(id: string, m: Omit<Measurement, "id">): Promise<void> {
  await db.measurements.update(id, m);
}
export const deleteMeasurement = (id: string) => db.measurements.delete(id);

export async function addProgressPhoto(photo: Omit<ProgressPhoto, "id">): Promise<void> {
  await db.progressPhotos.add({ id: uid(), ...photo });
}
export const deleteProgressPhoto = (id: string) => db.progressPhotos.delete(id);

export async function setWater(glasses: number, date: string = todayISO()) {
  const row = await getDailyMisc(date);
  await saveDailyMisc({ ...row, waterGlasses: Math.max(0, glasses) });
}
export async function setSteps(steps: number, date: string = todayISO()) {
  const row = await getDailyMisc(date);
  await saveDailyMisc({ ...row, steps: Math.max(0, steps) });
}

// ── Derived: personal records across all workouts ──────────────
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
