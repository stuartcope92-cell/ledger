// Open Food Facts — free, open, no API key. Great default for text search and
// barcode lookup. Data is crowd-sourced so quality varies; we filter out entries
// missing energy so the client never sees a 0-calorie "food".
//
// Docs: https://openfoodfacts.github.io/openfoodfacts-server/api/

import { tidy, per100gToServing, num } from "../lib/normalize.js";
import { cached, cacheGet, cacheSet } from "../lib/cache.js";

const BASE = "https://world.openfoodfacts.org";
// OFF asks all API users to send a descriptive User-Agent.
const UA = "LedgerApp/1.0 (calorie tracker; contact: you@example.com)";

// Nothing edible legitimately exceeds pure fat/oil (~900 kcal/100g) — crowd-
// sourced entries occasionally have a data-entry error (e.g. total package
// calories typed into the per-100g field), which we'd otherwise show as a
// bizarre 13,000+ kcal "food". Reject rather than guess at a correction.
const MAX_PLAUSIBLE_CAL_PER_100G = 900;

function mapProduct(p) {
  const n = p.nutriments || {};
  const cal100 = num(n["energy-kcal_100g"]);
  if (cal100 <= 0 || cal100 > MAX_PLAUSIBLE_CAL_PER_100G) return null;

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

// /api/v2/search?search_terms=... does NOT filter by the query — it returns
// OFF's whole catalog (millions of products) sorted by popularity regardless
// of what's searched. cgi/search.pl is the endpoint OFF's own docs point to
// for free-text search and actually matches the query.
async function fetchOFF(query, rawPoolSize) {
  const url =
    `${BASE}/cgi/search.pl?search_terms=${encodeURIComponent(query)}` +
    `&search_simple=1&action=process&json=1` +
    `&fields=code,product_name,generic_name,brands,serving_size,serving_quantity,nutriments` +
    `&page_size=${rawPoolSize}`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`OFF search failed: ${res.status}`);
  // OFF sometimes serves its own maintenance page with a 200 status, which
  // passes the check above and only fails here at parse time.
  const data = await res.json();
  return data.products || [];
}

function logOFFFailure(query, err) {
  console.warn(`[openFoodFacts] search "${query}" failed: ${err.message}`);
}

// Re-sorts raw OFF products so names that actually match the query word
// (allowing simple singular/plural) rank above products where the term only
// appears deep in an unrelated branded/flavoured name — OFF's own relevance
// sort otherwise happily puts "Beef Flavoured Bouillon Cubes" ahead of beef.
function rankByRelevance(products, query) {
  const q = query.trim().toLowerCase();
  const sameWord = (word) => word === q || word === `${q}s` || `${word}s` === q;
  const score = (p) => {
    const name = (p.product_name || p.generic_name || "").toLowerCase();
    if (!name) return -100;
    const words = name.split(/[^a-z0-9]+/).filter(Boolean);
    let s;
    if (name === q) s = 100;
    else if (words.some(sameWord)) s = 55;
    else if (name.includes(q)) s = 15;
    else s = -50; // matched on something other than the name (category, ingredients, ...)
    return s - Math.min(15, words.length); // slight preference for plainer, shorter names
  };
  return [...products].sort((a, b) => score(b) - score(a));
}

export async function searchOFF(query, { pageSize = 20 } = {}) {
  const key = `off:search:${query}:${pageSize}`;
  const hit = cacheGet(key);
  if (hit !== undefined) return hit;

  const rawPoolSize = Math.max(pageSize * 2, 40); // wider pool so ranking has something to choose from
  let raw = await fetchOFF(query, rawPoolSize).catch((e) => { logOFFFailure(query, e); return []; });
  // OFF's free search endpoint is occasionally flaky per-request — a genuine
  // zero-result response for a common term ("sausage") that succeeds
  // moments later on an identical request. One quick retry clears most of
  // these up before we give up and tell the user there's no match.
  if (raw.length === 0) {
    await new Promise((r) => setTimeout(r, 400));
    raw = await fetchOFF(query, rawPoolSize).catch((e) => { logOFFFailure(query, e); return []; });
  }

  const results = rankByRelevance(raw, query).map(mapProduct).filter(Boolean).slice(0, pageSize);
  // Don't lock in an empty/thin result for 24h — a transient miss now
  // shouldn't block a real answer for the rest of the day.
  if (results.length > 0) cacheSet(key, results, 1000 * 60 * 60 * 24);
  return results;
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
