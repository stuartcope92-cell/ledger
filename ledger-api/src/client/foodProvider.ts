// Client-side FoodProvider — the app talks only to this, never to vendors
// directly. Matches the interface in BUILD_SPEC.md §8. Point BASE at your
// deployed API. Keys live on the server, never in the app bundle.

export interface FoodResult {
  id: string;
  name: string;
  brand?: string;
  serving: string;
  grams?: number;
  cal: number;
  p: number;
  c: number;
  f: number;
  source: string;
  confidence?: number; // photo results only
}

export interface FoodProvider {
  searchByText(q: string): Promise<FoodResult[]>;
  lookupBarcode(code: string): Promise<FoodResult | null>;
  recognizePhoto(file: Blob): Promise<FoodResult[]>;
  health(): Promise<{ text: string; photo: string }>;
}

// BUILD_SPEC.md §2: this app targets Vite/web, not Expo, so the base URL
// comes from Vite's `VITE_API_URL` (client env vars must be `VITE_`-prefixed
// to be exposed to browser code) rather than Expo's `EXPO_PUBLIC_API_URL`.
// Everything else in this file is unchanged from the reference client.
const BASE = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_API_URL || "http://localhost:3001";

async function getJSON(path: string) {
  const res = await fetch(`${BASE}${path}`);
  const body = await res.json();
  if (!body.ok) throw new Error(body.error || `Request failed: ${res.status}`);
  return body.data;
}

export const apiFoodProvider: FoodProvider = {
  async searchByText(q) {
    if (!q.trim()) return [];
    return getJSON(`/api/food/search?q=${encodeURIComponent(q)}`);
  },

  async lookupBarcode(code) {
    try {
      return await getJSON(`/api/food/barcode?code=${encodeURIComponent(code)}`);
    } catch {
      return null;
    }
  },

  async recognizePhoto(file) {
    const form = new FormData();
    form.append("image", file, "meal.jpg");
    const res = await fetch(`${BASE}/api/food/recognize`, { method: "POST", body: form });
    const body = await res.json();
    if (!body.ok) throw new Error(body.error || "Recognition failed");
    return body.data;
  },

  async health() {
    return getJSON(`/api/health`);
  },
};

// Scale a FoodResult to a chosen gram amount (for the portion editor).
export function scaleToGrams(item: FoodResult, grams: number): FoodResult {
  if (!item.grams || item.grams <= 0) return item;
  const k = grams / item.grams;
  return {
    ...item,
    serving: `${grams} g`,
    grams,
    cal: Math.round(item.cal * k),
    p: Math.round(item.p * k * 10) / 10,
    c: Math.round(item.c * k * 10) / 10,
    f: Math.round(item.f * k * 10) / 10,
  };
}
