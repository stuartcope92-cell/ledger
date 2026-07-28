# Ledger — Build Specification

A simple, no-fuss gym & nutrition tracker. **No social features, no accounts, no feeds.** Clean, fast, private. This document is the source of truth for building the production app. A working single-file React prototype (`gym-tracker.jsx`) already exists and defines the intended look, layout, and logic — treat it as the visual and behavioural reference, then re-architect it properly per the structure below.

---

## 1. Goal & Principles

- **One user, on-device.** No login, no server-side accounts. All data lives on the device.
- **Fast to log.** Every core action (log a set, add a meal, record cardio) should take ≤3 taps.
- **Honest numbers.** Calorie/TDEE math is transparent and explained in-app; never present estimates as exact.
- **Minimal surface.** Five tabs, no settings sprawl. If a feature needs a manual, cut it.

---

## 2. Recommended Stack

- **Framework:** React Native via **Expo** (SDK latest). Cross-platform iOS/Android from one codebase; easy to preview on a physical phone via Expo Go.
- **Language:** TypeScript.
- **Navigation:** `expo-router` (file-based) or React Navigation bottom tabs.
- **State:** Zustand (small, no boilerplate) or React Context + reducers.
- **Persistence:** `expo-sqlite` for structured logs (workouts, meals, cardio) + `AsyncStorage` for the profile/settings blob. SQLite matters because progress charts query by date range.
- **Charts:** `react-native-svg` + `victory-native` (or hand-rolled SVG like the prototype for the simple bars/rings).
- **Icons:** `lucide-react-native`.
- **Dates:** `date-fns`.

If the target is a **web app instead of native**, swap to Vite + React + TypeScript, Dexie.js (IndexedDB) for persistence, and keep everything else.

---

## 3. Design System

Dark, high-contrast, one bold accent. Pulled from the prototype:

```
bg        #0F1115   surface   #171A21   surface2 #1F232C   line #2A2F3A
text      #EAECEF   dim       #8A909C
accent    #C6F135  (lime — primary actions, calories)
cardio    #5AC8FA  (sky — cardio/burn)
body      #B48BF2  (violet — bodyweight)
protein   #FF9F45  (amber — protein)
warn      #F0698A  (over-target / destructive)
```

- Font: system default (San Francisco / Roboto). Display sizes 22–34px bold; body 14–15px; captions 10–12px in `dim`.
- Cards: `surface` bg, 1px `line` border, 16px radius, 16px padding.
- Rounded, generous tap targets (min 44px). Respect reduced-motion and provide visible focus states.
- Protein target renders as a persistent vertical gauge fixed to the right edge, visible across all tabs.

---

## 4. Data Model

```ts
type Sex = "male" | "female";
type ActivityLevel = "Sedentary" | "Light" | "Moderate" | "Active" | "Very active";
type GoalMode = "deficit" | "maintain" | "surplus";

interface Profile {
  name: string;
  age: number;
  heightCm: number;
  weightKg: number;          // current; also the latest weigh-in
  sex: Sex;
  activity: ActivityLevel;
  mode: GoalMode;
}

interface SetEntry { weight: number; reps: number; }          // weight in kg
interface Workout {
  id: string;
  date: string;              // ISO yyyy-mm-dd
  name: string;              // exercise name (library or custom)
  sets: SetEntry[];
  isPR?: boolean;
}

interface CardioSession {
  id: string;
  date: string;
  type: string;              // Running, Walking, Cycling, ...
  duration: number;          // minutes
  pace: number;              // min per km
  incline: number;           // %
  cal: number;               // computed at save time
}

interface Meal {
  id: string;
  date: string;
  name: string;
  cal: number;
  p: number; c: number; f: number;   // grams
  source: "search" | "photo" | "manual";
}

interface WeighIn { id: string; date: string; weightKg: number; }

interface DailyMisc { date: string; waterGlasses: number; steps: number; }

interface PRRecord { exercise: string; estimated1RM: number; date: string; }
```

Persist each as its own SQLite table keyed by `date` for fast range queries. Profile is a single JSON blob.

---

## 5. Core Formulas (implement exactly)

**BMR — Mifflin-St Jeor:**
```
bmr = 10*weightKg + 6.25*heightCm - 5*age + (sex === "male" ? +5 : -161)
```

**TDEE (maintenance):** `tdee = bmr * activityFactor`
```
Sedentary 1.2 | Light 1.375 | Moderate 1.55 | Active 1.725 | Very active 1.9
```

**Daily calorie target:**
```
deficit  → tdee - 400
maintain → tdee
surplus  → tdee + 350
```

**Protein target:** `1.8 g per kg bodyweight` (rounded).

**Cardio calories (MET method):**
```
met = baseMET[type] * (1 + incline*0.03)
kcal = (met * 3.5 * weightKg) / 200 * durationMinutes
baseMET: Running 9.8, Walking 3.8, Cycling 7.5, Rowing 7.0,
         Elliptical 5.0, Stair Climber 8.0, Swimming 8.0
```

**Estimated 1RM (Epley), for PRs:** `weight * (1 + reps/30)`. A set beating the stored best for that exercise flags a new PR.

**Calories remaining (Food tab):** `target - eaten + burned`.

> In-app note to display near the target: any BMR formula is ±10%. The reliable way to find true maintenance is to hold the estimated intake 2–3 weeks and watch the weight trend; if flat, that's real maintenance — adjust from there.

---

## 6. Screens (5 bottom tabs)

### Progress (home)
- Day / Week / Month range toggle. Drives the x-axis window of the trend chart: Day → last 7 days, Week → last 7 days, Month → last 30 days. (Also drives any date-scoped queries.)
- Three rings: Eaten (vs target), Burned, Protein (vs target).
- Net calories line + current mode label (cutting / maintaining / bulking).
- **Trend line chart** — the centrepiece. Days on the x-axis, amount on the y-axis. A **metric toggle** below the chart switches the plotted series between four options:
  - **Body weight** (kg) — default, from weigh-ins.
  - **Calories** (kcal) — total daily intake.
  - **Protein** (g) — total daily protein.
  - **Cardio** (kcal) — daily cardio calories burned.
  - Each metric uses its own theme colour (weight=violet, calories=lime, protein=amber, cardio=sky). Chart shows latest + average for the window, a filled gradient under the line, y-axis gridlines/labels, and a capped set of x-labels (~6 max) so the axis stays readable at 30 days.
  - Implementation: build the series by aggregating logs per day over the selected window. In the prototype this reads from a seeded 30-day `HISTORY` array; in production, query SQLite grouped by date and fill gaps (days with no data) with null/0 as appropriate per metric (weight carries forward last known; calories/protein/cardio default to 0).
- Water & steps summary cards.
- Stat rows: lift volume (Σ weight×reps), carbs/fat totals, workout count, cardio count.
- Personal records list.

**Check exercise progress (sub-screen, opened by a button on Progress):**
- A "Check exercise progress" button opens a dedicated view (not a new bottom tab — keeps the 5-tab nav clean; implement as a stacked screen / overlay with a back button).
- User picks an exercise (search across the library ∪ any exercise they've logged).
- Renders a **line chart for that one exercise**: time on the x-axis (one point per logged session date), the chosen metric on the y-axis.
- **Metric toggle** — default **Est. 1RM**, plus **Volume** and **Top set**:
  - *Est. 1RM* (default, recommended): Epley `weight*(1+reps/30)`, taking the best set of the session. This is the recommended default because it stays comparable even when sets/reps change week to week — it isolates strength progress. 
  - *Volume*: total kg lifted that session, `Σ weight×reps` across all sets. Good workload measure but rises with added volume, not only strength.
  - *Top set*: heaviest single-set weight that session.
- Show the change (delta) from first to latest session, and a one-line explanation of the active metric.
- Data: group this exercise's `Workout` rows by date; compute the three per-session values from that day's sets. In the prototype a seeded `EXERCISE_HISTORY` provides demo lifts (Bench Press, Squat, Deadlift, Overhead Press) merged with anything logged live; in production this is a straight query of the workouts table `WHERE name = ?` grouped by date.

### Lift
- "Log exercise" primary action.
- **Quick routines:** Push / Pull / Leg Day templates load a preset list of exercises in one tap (see §7).
- Add flow: searchable exercise library (20 seed exercises) **plus** free-text custom exercise. Multi-set editor (add/remove sets; weight + reps each).
- **Rest timer** inside the add flow: 60/90/120s presets, play/pause/reset.
- **Progressive-overload hint:** when logging an exercise done before, show last session's sets to beat.
- Saved workouts list with PR badge; swipe/tap to delete.

### Cardio
- Activity type chips, duration, pace, incline inputs.
- Live estimated calorie burn (recomputes on input change) using bodyweight from profile.
- Session history with per-entry calories.

### Food
- Calories-remaining hero + protein remaining + carbs/fat.
- **Search** against food database (see §8).
- **Photo scan** button → recognition service (see §8). In prototype this is mocked; wire to real API.
- Meal list with macros; tap to delete. Manual add fallback.

### You (profile)
- Name, age, height, weight, sex, activity level.
- Maintenance (TDEE) display + Deficit/Maintain/Surplus toggle + resulting daily target + the accuracy note.
- Water stepper, steps input.
- BMI, weigh-in count, "Log today's weight" button.
- **Export all data (JSON)** and — add for production — **Import** to restore.

---

## 7. Seed Content

**Exercise library (20):** Bench Press, Incline Bench Press, Squat, Deadlift, Overhead Press, Barbell Row, Pull-Up, Lat Pulldown, Bicep Curl, Tricep Extension, Leg Press, Leg Curl, Leg Extension, Calf Raise, Lateral Raise, Dumbbell Fly, Romanian Deadlift, Hip Thrust, Face Pull, Plank.

**Routine templates:**
- Push Day → Bench Press, Overhead Press, Incline Bench Press, Lateral Raise, Tricep Extension
- Pull Day → Deadlift, Pull-Up, Barbell Row, Lat Pulldown, Bicep Curl
- Leg Day → Squat, Romanian Deadlift, Leg Press, Leg Curl, Calf Raise

**Cardio types:** Running, Walking, Cycling, Rowing, Elliptical, Stair Climber, Swimming.

Ship a small offline food seed (~12 items with cal/p/c/f per 100g or per serving) so search works before any API is connected.

---

## 8. Food Data & Photo Recognition (the one part needing external services)

This is the only feature that can't be built fully offline. Two pieces:

1. **Food database (text search):**
   - **Open Food Facts** — free, open, huge barcode/product DB. Good default, no cost.
   - **Nutritionix** — cleaner natural-language parsing ("2 eggs and toast"), paid tiers.
   - Cache lookups locally so repeat foods are instant and offline.

2. **Photo → food recognition:**
   - **LogMeal API** or **Foodvisor API** — image in, dish + estimated macros out. Both paid.
   - Flow: capture/pick image → upload → receive candidates → user confirms portion → save as a Meal with `source: "photo"`.
   - Always let the user correct the result; recognition is approximate. Keep the manual-add path as the reliable fallback.

Abstract this behind a `FoodProvider` interface so the API vendor can be swapped without touching UI:
```ts
interface FoodProvider {
  searchByText(q: string): Promise<FoodResult[]>;
  recognizePhoto(uri: string): Promise<FoodResult[]>;
}
```
Keep API keys in environment config, never in the client bundle for a shipped app — proxy through a minimal serverless function if keys must stay secret.

---

## 9. Build Order

1. Scaffold Expo + TypeScript project, bottom-tab navigation, design tokens/theme.
2. Profile screen + persistence + TDEE/target/protein math. (Everything else depends on these numbers.)
3. SQLite layer and the data model tables.
4. Lift tab: library, custom add, multi-set editor, save/list/delete.
5. Rest timer, PR detection, overload hint, routine templates.
6. Cardio tab: inputs + live MET calorie calc + history.
7. Food tab: offline seed search + manual add + meal list first; then wire `FoodProvider` to a real text API; then photo recognition.
8. Progress tab: range queries, rings, stat rows, bodyweight chart, PR list.
9. Water/steps, JSON export + import.
10. Polish: empty states, reduced-motion, accessibility labels, tap-target audit.

## 10. Definition of Done

- All five tabs functional; data survives app restart.
- TDEE/target/protein update instantly when profile changes and flow into Food + Progress.
- Logging a lift/meal/cardio is ≤3 taps.
- Food search works offline via seed; real API behind a swappable provider.
- Export produces valid JSON that Import restores exactly.
- No account, no network calls except the food provider, no analytics/tracking.
