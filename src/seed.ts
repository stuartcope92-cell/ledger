// ── Seed content (BUILD_SPEC §7) ───────────────────────────────
import type { Profile } from "./types";

export const EXERCISE_LIBRARY: string[] = [
  "Bench Press",
  "Incline Bench Press",
  "Squat",
  "Deadlift",
  "Overhead Press",
  "Barbell Row",
  "Pull-Up",
  "Lat Pulldown",
  "Bicep Curl",
  "Tricep Extension",
  "Leg Press",
  "Leg Curl",
  "Leg Extension",
  "Calf Raise",
  "Lateral Raise",
  "Dumbbell Fly",
  "Romanian Deadlift",
  "Hip Thrust",
  "Face Pull",
  "Plank",
];

export const MUSCLE_GROUPS = ["Chest", "Back", "Legs", "Shoulders", "Arms", "Core"] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

// Custom/free-text exercises the user logs (not in the library below) fall
// into an "Other" bucket wherever this is looked up — no per-custom-exercise
// tagging UI, just this seed-library mapping.
export const EXERCISE_MUSCLE_GROUP: Record<string, MuscleGroup> = {
  "Bench Press": "Chest",
  "Incline Bench Press": "Chest",
  "Dumbbell Fly": "Chest",
  Squat: "Legs",
  "Leg Press": "Legs",
  "Leg Curl": "Legs",
  "Leg Extension": "Legs",
  "Calf Raise": "Legs",
  "Romanian Deadlift": "Legs",
  "Hip Thrust": "Legs",
  Deadlift: "Back",
  "Barbell Row": "Back",
  "Pull-Up": "Back",
  "Lat Pulldown": "Back",
  "Overhead Press": "Shoulders",
  "Lateral Raise": "Shoulders",
  "Face Pull": "Shoulders",
  "Bicep Curl": "Arms",
  "Tricep Extension": "Arms",
  Plank: "Core",
};

export const TEMPLATES: Record<string, string[]> = {
  "Push Day": [
    "Bench Press",
    "Overhead Press",
    "Incline Bench Press",
    "Lateral Raise",
    "Tricep Extension",
  ],
  "Pull Day": [
    "Deadlift",
    "Pull-Up",
    "Barbell Row",
    "Lat Pulldown",
    "Bicep Curl",
  ],
  "Leg Day": [
    "Squat",
    "Romanian Deadlift",
    "Leg Press",
    "Leg Curl",
    "Calf Raise",
  ],
};

export const CARDIO_TYPES: string[] = [
  "Running",
  "Walking",
  "Cycling",
  "Rowing",
  "Elliptical",
  "Stair Climber",
  "Swimming",
];

export const DEFAULT_PROFILE: Profile = {
  name: "",
  age: 30,
  heightCm: 178,
  weightKg: 78,
  sex: "male",
  activity: "Moderate",
  mode: "maintain",
  unitSystem: "metric",
};
