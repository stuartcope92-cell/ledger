# Ledger Calorie API

A thin proxy in front of food-data providers. The app talks to one normalized
interface; vendor API keys stay server-side and never ship in the app bundle.

## What works out of the box

**No keys required.** [Open Food Facts](https://openfoodfacts.org) powers text
search and barcode lookup for free. Add keys to unlock better text parsing and
photo recognition:

| Capability            | Provider              | Key needed | Cost        |
|-----------------------|-----------------------|------------|-------------|
| Text search + barcode | Open Food Facts       | No         | Free        |
| Natural-language text | Nutritionix           | Yes        | Free tier   |
| Photo → food          | LogMeal *or* Foodvisor| Yes        | Paid        |

The server degrades gracefully: no Nutritionix key → Open Food Facts only; no
photo key → `/recognize` returns `501` and the app should keep its manual-add
path as the fallback.

## Setup

```bash
cd ledger-api
npm install
cp .env.example .env      # fill in any keys you have (all optional)
npm run dev               # http://localhost:3001
```

Requires Node 18+ (uses built-in `fetch`, `FormData`, `Blob`).

## Endpoints

All responses are `{ ok: true, data }` or `{ ok: false, error }`.

### `GET /api/health`
Reports which providers are active.
```json
{ "ok": true, "data": { "text": "openfoodfacts", "photo": "unavailable" } }
```

### `GET /api/food/search?q=chicken breast`
Text search, layered: a small curated set of ~20 common staples (chicken,
beef, sausage, rice, egg, ...) first — instant, always correct, independent
of any upstream provider — then Nutritionix when configured, then Open Food
Facts backfill. Returns up to 25 `FoodResult`s. See "Search reliability"
below for why the staples layer exists.

### `GET /api/food/barcode?code=737628064502`
Barcode lookup via Open Food Facts. `404` if the product isn't in the database.

### `POST /api/food/recognize`
Multipart form, one image field named `image` (≤8 MB). Returns detected foods
with a `confidence` score. **These are candidates** — the app must let the user
confirm the dish and adjust portion before saving. `501` if no photo provider is
configured.

```bash
curl -F "image=@lunch.jpg" http://localhost:3001/api/food/recognize
```

## FoodResult shape

Every item, whatever the source, comes back as:

```ts
{
  id: string;          // "off:737628064502", "nix:egg", "logmeal:5"
  name: string;
  brand?: string;
  serving: string;     // "170 g", "2 large (100 g)", "1 portion (estimate)"
  grams?: number;      // serving weight when known, for scaling
  cal: number;         // kcal for the stated serving
  p: number; c: number; f: number;   // grams
  source: string;      // "staples" | "openfoodfacts" | "nutritionix" | "logmeal" | "foodvisor"
  confidence?: number; // 0..1, photo results only
}
```

## Wiring the app

Copy `src/client/foodProvider.ts` into the app and point it at your API:

```ts
// .env in the Expo app
EXPO_PUBLIC_API_URL=https://your-api.example.com
```

```ts
import { apiFoodProvider, scaleToGrams } from "./foodProvider";

const results = await apiFoodProvider.searchByText("greek yogurt");
const photoHits = await apiFoodProvider.recognizePhoto(imageBlob);
const scaled = scaleToGrams(results[0], 200); // adjust portion in the editor
```

This is the concrete implementation of the `FoodProvider` interface from
`BUILD_SPEC.md` §8 — swapping vendors never touches the UI.

## Deploying

Runs anywhere Node 18+ runs. The Express app is exported from `src/server.js`,
so it wraps cleanly for serverless (Vercel, Lambda, Cloud Functions). Set your
env vars in the platform's config, and set `ALLOWED_ORIGIN` to your app's origin
instead of `*` in production.

## Search reliability

Open Food Facts' free search endpoint (`cgi/search.pl`) is occasionally
flaky per-request — a genuine zero-result or `503` response for a common
term that succeeds moments later on an identical request, and under
sustained load it can fail on nearly every request for a stretch. Three
things in `src/providers/openFoodFacts.js` and `src/lib/staples.js` handle
this so a bad moment upstream doesn't become "no matches found":

- **Staples first.** `searchStaples()` (`src/lib/staples.js`) is a small,
  curated, zero-network list of common whole foods. It always answers
  correctly for everyday terms regardless of what OFF is doing.
- **One retry, then give up gracefully.** A zero-result OFF response gets
  one immediate retry (~400ms) before falling through to whatever else is
  available.
- **Don't cache a bad moment for 24h.** Only non-empty OFF results get
  cached; a transient miss doesn't lock out a real answer for the rest of
  the day.

There's also a lightweight relevance re-rank on OFF's own results
(`rankByRelevance`) — OFF's own sort otherwise happily puts "Beef Flavoured
Bouillon Cubes" ahead of plain beef, since it ranks by popularity, not by
how well the query matches the product name.

## Notes on accuracy

- Open Food Facts is crowd-sourced; entries missing energy data, or with an
  implausible energy value (>900 kcal/100g — more than pure fat, almost
  always a data-entry error), are filtered out. Always let users correct
  values regardless.
- Photo recognition is approximate — treat every result as an editable estimate,
  never a final number. Portion size is the biggest source of error.
- Lookups are cached 24 h (barcodes 7 days) to stay within rate limits. Swap the
  in-memory cache in `src/lib/cache.js` for Redis if you run multiple instances.
