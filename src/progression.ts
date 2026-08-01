// ── Programmed lift progression (optional per-exercise auto-progression) ──
// Pure functions only — no Supabase, no ids. Persistence lives in store.ts,
// UI lives in screens/ExerciseProgress.tsx and screens/Lift.tsx.
import { estimated1RM } from "./formulas";
import type { PerformanceResult, Prescription, ProgrammedLift, ProgressionPhase, SetEntry } from "./types";

export const PHASE_LABEL: Record<ProgressionPhase, string> = {
  rep: "Rep accumulation",
  tempo: "Tempo",
  volume: "Volume",
  weight_jump: "Weight jump",
};

export type ProgressionSpeed = "fast" | "medium" | "slow";

const SPEED_MULTIPLIER: Record<ProgressionSpeed, number> = { fast: 2, medium: 1.5, slow: 1 };

// Repeated failures deload instead of repeating the same failed prescription
// forever — MAX_CONSECUTIVE_FAILURES failed weeks in a row trigger it.
const MAX_CONSECUTIVE_FAILURES = 2;
const DELOAD_FACTOR = 0.9;

export function computeStrengthGap(current1RM: number, target1RM: number) {
  const gap = target1RM - current1RM;
  const gapPercent = current1RM > 0 ? gap / current1RM : 1;
  return { gap, gapPercent };
}

export function determineProgressionSpeed(gapPercent: number): ProgressionSpeed {
  if (gapPercent > 0.2) return "fast";
  if (gapPercent > 0.1) return "medium";
  return "slow";
}

export function getWeightIncrement(exerciseName: string): number {
  const lowerName = exerciseName.toLowerCase();
  if (lowerName.includes("squat") || lowerName.includes("rdl")) return 5;
  return 2.5;
}

// assistLevelIndex is the source of truth for ladder position — never match
// currentWeight back into assistLevels by value (fragile: a manual edit or
// unit-conversion rounding silently breaks an exact-equality lookup).
export function getNextAssistLevelIndex(lift: ProgrammedLift): number {
  const levels = lift.assistLevels;
  const idx = lift.assistLevelIndex ?? 0;
  if (!levels || levels.length === 0) return idx;
  return idx < levels.length - 1 ? idx + 1 : idx;
}

function prescribeCompound(lift: ProgrammedLift): Prescription {
  const current1RM = estimated1RM(lift.currentWeight, lift.currentReps);
  const { gapPercent } = computeStrengthGap(current1RM, lift.target1RM);
  const speed = determineProgressionSpeed(gapPercent);
  const increment = Math.round(getWeightIncrement(lift.exerciseName) * SPEED_MULTIPLIER[speed] * 2) / 2;

  if (lift.currentReps < lift.repRangeMax) {
    return { weight: lift.currentWeight, reps: lift.currentReps + 1, sets: lift.sets, phase: "rep" };
  }
  const uncapped = lift.currentWeight + increment;
  // Don't overshoot the goal weight once within reach of it.
  const weight = lift.targetWeight >= lift.currentWeight ? Math.min(uncapped, lift.targetWeight) : uncapped;
  return { weight, reps: lift.repRangeMin, sets: lift.sets, phase: "weight_jump" };
}

function prescribeAssisted(lift: ProgrammedLift): Prescription {
  const { repRangeMin: minRep, repRangeMax: maxRep, assistLevelIndex } = lift;
  // "weight_jump" is a compound-only phase; a lift that somehow carries it
  // (e.g. stale/imported data) falls back to a fresh rep-accumulation cycle.
  const phase = lift.progressionPhase === "weight_jump" ? "rep" : lift.progressionPhase;

  switch (phase) {
    case "rep":
      if (lift.currentReps < maxRep) {
        return { weight: lift.currentWeight, reps: lift.currentReps + 1, sets: lift.sets, phase: "rep", assistLevelIndex };
      }
      return { weight: lift.currentWeight, reps: minRep, sets: lift.sets, phase: "tempo", assistLevelIndex };
    case "tempo":
      if (lift.currentReps < maxRep) {
        return { weight: lift.currentWeight, reps: lift.currentReps + 1, sets: lift.sets, phase: "tempo", assistLevelIndex };
      }
      return { weight: lift.currentWeight, reps: minRep, sets: 4, phase: "volume", assistLevelIndex };
    case "volume": {
      if (lift.currentReps < maxRep) {
        return { weight: lift.currentWeight, reps: lift.currentReps + 1, sets: 4, phase: "volume", assistLevelIndex };
      }
      const nextIdx = getNextAssistLevelIndex(lift);
      const weight = lift.assistLevels?.[nextIdx] ?? lift.currentWeight;
      return { weight, reps: minRep, sets: 3, phase: "rep", assistLevelIndex: nextIdx };
    }
    default:
      return { weight: lift.currentWeight, reps: minRep, sets: 3, phase: "rep", assistLevelIndex };
  }
}

export function prescribeNext(lift: ProgrammedLift): Prescription {
  return lift.type === "compound" ? prescribeCompound(lift) : prescribeAssisted(lift);
}

// Working sets only — a warm-up set's rep count shouldn't count as a miss.
export function evaluatePerformance(sets: SetEntry[], prescription: Prescription): PerformanceResult {
  const working = sets.filter((s) => (s.type ?? "working") !== "warmup");
  const success = working.length >= prescription.sets && working.every((s) => s.reps >= prescription.reps);
  const exceeded = success && working.some((s) => s.reps > prescription.reps);
  return { success, exceeded };
}

export function updateAfterPerformance(
  lift: ProgrammedLift,
  prescription: Prescription,
  performance: PerformanceResult,
): ProgrammedLift {
  if (!performance.success) {
    const failures = lift.consecutiveFailures + 1;
    if (failures < MAX_CONSECUTIVE_FAILURES) {
      // Repeat the same prescription next time — one miss isn't a trend yet.
      return { ...lift, consecutiveFailures: failures };
    }
    // Two misses in a row: deload instead of repeating a failed prescription forever.
    const deloadWeight =
      lift.type === "compound" ? Math.round((lift.currentWeight * DELOAD_FACTOR) / 2.5) * 2.5 : lift.currentWeight;
    return {
      ...lift,
      currentWeight: deloadWeight,
      currentReps: lift.repRangeMin,
      sets: lift.type === "compound" ? lift.sets : 3,
      progressionPhase: "rep",
      consecutiveFailures: 0,
    };
  }

  if (performance.exceeded) {
    // Beat the prescription — pull the next step forward as if this
    // rep-accumulation cycle had already finished.
    const accelerated = prescribeNext({ ...lift, currentReps: lift.repRangeMax });
    return {
      ...lift,
      currentWeight: accelerated.weight,
      currentReps: accelerated.reps,
      sets: accelerated.sets,
      progressionPhase: accelerated.phase,
      assistLevelIndex: accelerated.assistLevelIndex ?? lift.assistLevelIndex,
      consecutiveFailures: 0,
    };
  }

  return {
    ...lift,
    currentWeight: prescription.weight,
    currentReps: prescription.reps,
    sets: prescription.sets,
    progressionPhase: prescription.phase,
    assistLevelIndex: prescription.assistLevelIndex ?? lift.assistLevelIndex,
    consecutiveFailures: 0,
  };
}

// currentWeight === 0 only ever resolves for assisted lifts if assistLevels
// was set up to terminate in 0 (fully unassisted) — enforced when the goal is created.
export function detectGoalCompletion(lift: ProgrammedLift): boolean {
  if (lift.type === "assisted") {
    return lift.currentWeight === 0 && lift.currentReps >= lift.targetReps;
  }
  return lift.currentWeight >= lift.targetWeight && lift.currentReps >= lift.targetReps;
}

export function buildProgrammedLift(params: {
  id: string;
  exerciseName: string;
  type: ProgrammedLift["type"];
  currentWeight: number;
  currentReps: number;
  repRangeMin: number;
  repRangeMax: number;
  sets: number;
  targetWeight: number;
  targetReps: number;
  assistLevels?: number[];
}): ProgrammedLift {
  return {
    id: params.id,
    exerciseName: params.exerciseName,
    type: params.type,
    currentWeight: params.currentWeight,
    currentReps: params.currentReps,
    repRangeMin: params.repRangeMin,
    repRangeMax: params.repRangeMax,
    sets: params.sets,
    progressionPhase: "rep",
    assistLevels: params.assistLevels,
    assistLevelIndex: params.type === "assisted" ? 0 : undefined,
    consecutiveFailures: 0,
    targetWeight: params.targetWeight,
    targetReps: params.targetReps,
    target1RM: estimated1RM(params.targetWeight, params.targetReps),
  };
}
