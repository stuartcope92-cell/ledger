// ── Seed content (BUILD_SPEC §7) ───────────────────────────────
import type { FoodResult, Profile } from "./types";

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

// Small offline food seed so search works before any API is connected.
// Values are per typical serving.
export const FOOD_DB: Record<string, Omit<FoodResult, "name" | "source">> = {
  "chicken breast": { cal: 165, p: 31, c: 0, f: 3.6 },
  "white rice": { cal: 130, p: 2.7, c: 28, f: 0.3 },
  banana: { cal: 105, p: 1.3, c: 27, f: 0.4 },
  egg: { cal: 78, p: 6, c: 0.6, f: 5 },
  oatmeal: { cal: 158, p: 6, c: 27, f: 3 },
  salmon: { cal: 208, p: 20, c: 0, f: 13 },
  "greek yogurt": { cal: 100, p: 17, c: 6, f: 0.7 },
  avocado: { cal: 240, p: 3, c: 12, f: 22 },
  almonds: { cal: 164, p: 6, c: 6, f: 14 },
  "sweet potato": { cal: 112, p: 2, c: 26, f: 0.1 },
  "beef mince": { cal: 250, p: 26, c: 0, f: 15 },
  "protein shake": { cal: 120, p: 25, c: 3, f: 1.5 },
};

export const DEFAULT_PROFILE: Profile = {
  name: "",
  age: 30,
  heightCm: 178,
  weightKg: 78,
  sex: "male",
  activity: "Moderate",
  mode: "maintain",
};
