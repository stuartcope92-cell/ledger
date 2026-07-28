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
};
