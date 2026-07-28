# Ledger

A simple, private, on-device gym & nutrition tracker. **No accounts, no server, no feeds.** Built to the `BUILD_SPEC.md` in this folder; `gym-tracker.jsx` is the original single-file prototype kept as the visual reference.

This is the **web** build of the spec (Vite + React + TypeScript + Dexie/IndexedDB), the fallback stack described in BUILD_SPEC §2. All data lives in the browser's IndexedDB and survives reloads; there are no network calls except the (swappable) food provider.

## Run it

```bash
npm install
npm run dev
```

Open the printed URL (default http://localhost:5173).

## Scripts

- `npm run dev` — start the dev server.
- `npm run build` — typecheck (`tsc -b`) and build to `dist/`.
- `npm run preview` — serve the production build.
- `npm run typecheck` — types only.

## Architecture

```
src/
  theme.ts            Design tokens (BUILD_SPEC §3)
  types.ts            Data model (§4)
  formulas.ts         BMR / TDEE / MET / 1RM math (§5) — implemented exactly
  seed.ts             Exercise library, routines, cardio types, food seed (§7)
  db.ts               Dexie (IndexedDB) tables + export/import (§4, §10)
  store.ts            Reactive read hooks + mutations over Dexie
  food/provider.ts    FoodProvider interface + offline provider (§8)
  utils/date.ts       ISO dates + range filtering
  utils/series.ts     Daily trend + per-exercise series aggregation (§6)
  components/         Card, Field, Btn, Ring, LineChart, RestTimer, ProteinSidebar…
  screens/            Progress, ExerciseProgress, Lift, Cardio, Food, Profile (§6)
  App.tsx             Shell: header, tabs, protein gauge, bottom nav
```

## Swapping in real food services

Everything food-related goes through `FoodProvider` (`src/food/provider.ts`). The default `OfflineFoodProvider` uses the local seed and a mocked photo scan. To go live, implement the same interface against **Open Food Facts** / **Nutritionix** (text) and **LogMeal** / **Foodvisor** (photo), then change the single `foodProvider` export. Keep API keys out of the client — proxy through a serverless function (BUILD_SPEC §8).

## Notes

- Calorie/TDEE math is an estimate (±10%). The in-app note in the You tab explains how to find true maintenance.
- Export produces a full JSON backup; Import restores it exactly (replaces current data, transactional).
