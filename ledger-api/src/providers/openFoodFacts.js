// Open Food Facts — free, open, no API key. Great default for text search and
// barcode lookup. Data is crowd-sourced so quality varies; we filter out entries
// missing energy so the client never sees a 0-calorie "food".
//
// Docs: https://openfoodfacts.github.io/openfoodfacts-server/api/

import { tidy, per100gToServing, num } from "../lib/normalize.js";
import { cached } from "../lib/cache.js";

const BASE = "https://world.openfoodfacts.org";
// OFF asks all API users to send a descriptive User-Agent.
const UA = "LedgerApp/1.0 (calorie tracker; contact: you@example.com)";

function mapProduct(p) {
  const n = p.nutriments || {};
  const cal100 = num(n["energy-kcal_100g"]);
  if (cal100 <= 0) return null; // skip entries with no usable energy data

  // Report per 100 g by default (OFF's canonical basis), plus serving if present.
  const grams = num(p.serving_quantity) || 100;
  const scaled = per100gToServing({
    cal100,
    p100: num(n.proteins_100g),
    c100: num(n.carbohydrates_100g),
    f100: num(n.fat_100g),
    grams,
  });

  const name = p.product_name || p.generic_name || "Unknown item";
  const serving = p.serving_size
    ? `${p.serving_size}`
    : grams === 100 ? "100 g" : `${grams} g`;

  return tidy({
    id: `off:${p.code || name}`,
    name,
    brand: p.brands ? p.brands.split(",")[0].trim() : undefined,
    serving,
    grams,
    ...scaled,
    source: "openfoodfacts",
  });
}

export async function searchOFF(query, { pageSize = 20 } = {}) {
  const key = `off:search:${query}:${pageSize}`;
  return cached(key, 1000 * 60 * 60 * 24, async () => {
    const url =
      `${BASE}/api/v2/search?search_terms=${encodeURIComponent(query)}` +
      `&fields=code,product_name,generic_name,brands,serving_size,serving_quantity,nutriments` +
      `&sort_by=popularity_key&page_size=${pageSize}`;

    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error(`OFF search failed: ${res.status}`);
    const data = await res.json();
    return (data.products || []).map(mapProduct).filter(Boolean);
  });
}

export async function barcodeOFF(code) {
  const key = `off:barcode:${code}`;
  return cached(key, 1000 * 60 * 60 * 24 * 7, async () => {
    const url = `${BASE}/api/v2/product/${encodeURIComponent(code)}.json` +
      `?fields=code,product_name,generic_name,brands,serving_size,serving_quantity,nutriments`;
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error(`OFF barcode failed: ${res.status}`);
    const data = await res.json();
    if (data.status !== 1 || !data.product) return null;
    return mapProduct(data.product);
  });
}
