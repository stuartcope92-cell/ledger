// Nutritionix — best-in-class natural-language parsing: "2 eggs and a slice of
// toast" returns each food with real portions. Requires an app id + key (free
// tier available). If keys are absent this provider reports unavailable and the
// server falls back to Open Food Facts.
//
// Docs: https://docs.nutritionix.com/  (endpoint: /v2/natural/nutrients)

import { tidy, num } from "../lib/normalize.js";
import { cached } from "../lib/cache.js";

const BASE = "https://trackapi.nutritionix.com/v2";

export function nutritionixAvailable() {
  return Boolean(process.env.NUTRITIONIX_APP_ID && process.env.NUTRITIONIX_APP_KEY);
}

function mapFood(f) {
  const qty = num(f.serving_qty, 1);
  const unit = f.serving_unit || "serving";
  const grams = num(f.serving_weight_grams) || undefined;
  return tidy({
    id: `nix:${(f.food_name || "").toLowerCase().replace(/\s+/g, "-")}`,
    name: f.food_name || "Unknown item",
    brand: f.brand_name || undefined,
    serving: grams ? `${qty} ${unit} (${grams} g)` : `${qty} ${unit}`,
    grams,
    cal: num(f.nf_calories),
    p: num(f.nf_protein),
    c: num(f.nf_total_carbohydrate),
    f: num(f.nf_total_fat),
    source: "nutritionix",
  });
}

// Natural-language endpoint: give it a phrase, get back parsed foods.
export async function searchNutritionix(query) {
  if (!nutritionixAvailable()) return [];
  const key = `nix:natural:${query}`;
  return cached(key, 1000 * 60 * 60 * 24, async () => {
    const res = await fetch(`${BASE}/natural/nutrients`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-app-id": process.env.NUTRITIONIX_APP_ID,
        "x-app-key": process.env.NUTRITIONIX_APP_KEY,
      },
      body: JSON.stringify({ query }),
    });
    if (res.status === 404) return []; // nothing recognized
    if (!res.ok) throw new Error(`Nutritionix failed: ${res.status}`);
    const data = await res.json();
    return (data.foods || []).map(mapFood);
  });
}
