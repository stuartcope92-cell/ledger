# Task: Wire the calorie-tracking API into the Food tab

The `ledger-api` service (in this repo) is built and tested. The app is built up to
this point but its Food tab still uses **mock/hardcoded food data**. Replace that
mock with real calls to the API. Text search + barcode work with no API key
(Open Food Facts); photo recognition is optional and key-gated.

Do not change unrelated screens. Keep the existing UI/layout and styling.

## Reference files
- `ledger-api/` — the API server. See `ledger-api/README.md` for endpoints and the
  `FoodResult` shape.
- `ledger-api/src/client/foodProvider.ts` — the client this task is built around.
  Use it as-is; do not reinvent the fetch logic.

## API contract (already implemented — do not modify the server)
- `GET  /api/health` → `{ ok, data: { text, photo } }`
- `GET  /api/food/search?q=...` → `{ ok, data: FoodResult[] }`
- `GET  /api/food/barcode?code=...` → `{ ok, data: FoodResult }` (404 if missing)
- `POST /api/food/recognize` (multipart, field `image`) → `{ ok, data: FoodResult[] }`
  (501 if no photo key configured)

`FoodResult = { id, name, brand?, serving, grams?, cal, p, c, f, source, confidence? }`
— `cal` is kcal for the stated serving; `p/c/f` are grams for that serving.

## Steps

### 1. Config
- Add `EXPO_PUBLIC_API_URL` to the app's env (`.env`), defaulting to
  `http://localhost:3001` for local dev.
- Note for physical-device testing: `localhost` won't reach the dev machine from a
  phone. Document (in a comment or the app README) that on-device testing needs the
  computer's LAN IP, e.g. `EXPO_PUBLIC_API_URL=http://192.168.1.50:3001`.

### 2. Add the provider to the app
- Copy `ledger-api/src/client/foodProvider.ts` into the app source (e.g.
  `src/services/foodProvider.ts`). Confirm it reads `EXPO_PUBLIC_API_URL`.
- Export `apiFoodProvider` and `scaleToGrams` from there.

### 3. Replace the mock in the Food tab
- Find the current mock food source (the hardcoded `FOOD_DB` object / local lookup)
  and the search box handler in the Food screen.
- Replace the local lookup with `apiFoodProvider.searchByText(query)`.
- **Debounce** the search: wait ~300 ms after the user stops typing before calling
  the API, and cancel any in-flight/pending search when the query changes. Do not
  search on empty input.
- Add three UI states to the results area: **loading** (spinner or "Searching…"),
  **empty** ("No matches — try another term" when a non-empty query returns 0), and
  **error** ("Couldn't reach the food service — check the API is running"). Keep
  these minimal and on-brand with the existing styling.

### 4. Portion editor
- When the user taps a result, let them set the portion in grams before saving,
  using `scaleToGrams(item, grams)` so calories/macros scale correctly. Default the
  portion to `item.grams` when present, else 100 g.
- Saving a portion writes a `Meal` using the app's existing meal model/store
  (`source: "search"`). Do not change the meal schema beyond what already exists;
  if a `source` field isn't present, add it as an optional string.

### 5. Photo recognition (optional, guarded)
- Wire the existing "Scan a meal photo" button to `apiFoodProvider.recognizePhoto(blob)`.
- On app start (or when opening Food), call `apiFoodProvider.health()`; if
  `data.photo === "unavailable"`, hide or disable the scan button with a short note
  ("Photo scanning needs an API key"). Never crash when photo isn't configured.
- Recognition returns **candidates**: show them in a list for the user to pick and
  confirm, then run each chosen item through the same portion editor before saving.
  Show `confidence` if present. Always keep manual search as the fallback.

### 6. Keep it resilient
- All API calls wrapped in try/catch; a failed call surfaces the error state, never
  an unhandled crash.
- Cache is handled server-side; do not add client caching logic.
- Do not put API keys in the app. The app only ever calls the API_URL.

## Definition of done
- Typing in the Food search box returns real results from the API (verify with the
  server running: `cd ledger-api && npm install && npm run dev`).
- Selecting a food, adjusting grams, and saving logs a Meal with correctly scaled
  calories and macros that flow into the daily totals and Progress rings.
- With no photo key set, the Food tab works fully for search; the scan button is
  disabled/hidden with a note and nothing errors.
- Existing tabs and styling are unchanged.

## Manual test script (run after building)
1. Start API: `cd ledger-api && npm run dev` → expect `Ledger API on :3001`.
2. In the app Food tab, search "greek yogurt" → results appear after a brief pause.
3. Tap one, set 200 g, save → meal appears with scaled numbers; daily calories/protein update.
4. Search gibberish "xyzzy" → empty state shows, no crash.
5. Stop the API (Ctrl+C) and search → error state shows, no crash.
