# Ledger

A simple, private, on-device gym & nutrition tracker. **No accounts, no server, no feeds.** Built to the `BUILD_SPEC.md` in this folder; `gym-tracker.jsx` is the original single-file prototype kept as the visual reference.

This is the **web** build of the spec (Vite + React + TypeScript + Dexie/IndexedDB), the fallback stack described in BUILD_SPEC §2. All data lives in the browser's IndexedDB and survives reloads; there are no network calls except the (swappable) food provider.

## Try it live

**https://stuartcope92-cell.github.io/ledger/** — deployed from the `gh-pages`
branch. All five tabs work fully (data persists in your browser's IndexedDB).
The Food tab's live search needs `ledger-api` running too — see below; without
it, search just shows a "couldn't reach the food service" message and manual
add still works.

## Run it

The Food tab needs the `ledger-api` service running alongside the app (text
search + barcode work with no API key; see [`ledger-api/README.md`](../ledger-api/README.md)).

```bash
# terminal 1
cd ledger-api && npm install && npm run dev   # http://localhost:3001

# terminal 2
npm install
npm run dev                                    # http://localhost:5173
```

Open the printed URL (default http://localhost:5173). If the API isn't
running, the Food tab still loads — search just shows a "couldn't reach the
food service" message instead of results.

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
  services/foodProvider.ts  Client for ledger-api (§8) — copied from ledger-api/src/client
  utils/date.ts       ISO dates + range filtering
  utils/series.ts     Daily trend + per-exercise series aggregation (§6)
  utils/image.ts      Client-side compression + Blob<->dataURL for photo export (§6, §10)
  utils/useObjectUrl.ts  Renders a stored Blob as an <img>, no leaks
  components/         Card, Field, Btn, Ring, LineChart, RestTimer, ProteinSidebar…
  screens/            Progress, ExerciseProgress, Lift, Cardio, Food, Photos, PhotoCompare, Profile (§6)
  App.tsx             Shell: header, tabs, protein gauge, bottom nav
```

## Food data

The Food tab talks to `ledger-api` (a sibling folder at `../ledger-api`) via
`src/services/foodProvider.ts` — a copy of `ledger-api/src/client/foodProvider.ts`,
unmodified except for reading Vite's `VITE_API_URL` instead of Expo's
`EXPO_PUBLIC_API_URL` (see comment in that file). Vendor keys (Nutritionix,
LogMeal/Foodvisor) live only in the API's `.env`, never in this app's bundle.

- `VITE_API_URL` — set in `.env` (defaults to `http://localhost:3001` in code
  if unset). Testing from a phone or another device on your network: point it
  at your computer's LAN IP instead, e.g. `VITE_API_URL=http://192.168.1.50:3001`
  — `localhost` always means the device loading the page.
- Search debounces 300ms and shows loading/empty/error states.
- Photo scanning is hidden with a note when the API reports no photo
  provider configured; manual add is always available as a fallback.

## Notes

- Calorie/TDEE math is an estimate (±10%). The in-app note in the You tab explains how to find true maintenance.
- Export produces a full JSON backup; Import restores it exactly (replaces current data, transactional).
