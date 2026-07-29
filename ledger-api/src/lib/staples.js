// A small, curated set of common whole foods that always answers instantly
// and correctly — independent of Open Food Facts' search reliability or
// ranking. Not a replacement for OFF's breadth, just a safety net so
// everyday terms ("chicken", "beef", "sausage") never come back empty or
// buried under barely-related branded products.
//
// Values are typical per-100g (or stated serving) macros from standard
// nutrition references — reasonable, not lab-precise. Same portion-scaling
// and manual-correction paths apply as for any other result.

const STAPLES = [
  { keywords: ["chicken breast", "chicken"], name: "Chicken breast (cooked, skinless)", serving: "100 g", grams: 100, cal: 165, p: 31, c: 0, f: 3.6 },
  { keywords: ["chicken thigh"], name: "Chicken thigh (cooked)", serving: "100 g", grams: 100, cal: 209, p: 26, c: 0, f: 10.9 },
  { keywords: ["beef mince", "ground beef", "beef"], name: "Beef mince, 85% lean (cooked)", serving: "100 g", grams: 100, cal: 215, p: 27, c: 0, f: 12 },
  { keywords: ["beef steak", "steak", "sirloin"], name: "Beef steak, sirloin (cooked)", serving: "100 g", grams: 100, cal: 206, p: 29, c: 0, f: 9 },
  { keywords: ["sausage", "sausages"], name: "Sausage, pork (cooked)", serving: "100 g", grams: 100, cal: 301, p: 17.7, c: 2.9, f: 24.9 },
  { keywords: ["turkey", "turkey breast", "ground turkey"], name: "Turkey breast (cooked, skinless)", serving: "100 g", grams: 100, cal: 135, p: 30, c: 0, f: 1.7 },
  { keywords: ["salmon"], name: "Salmon (cooked)", serving: "100 g", grams: 100, cal: 208, p: 20, c: 0, f: 13 },
  { keywords: ["tuna"], name: "Tuna, canned in water (drained)", serving: "100 g", grams: 100, cal: 116, p: 26, c: 0, f: 0.8 },
  { keywords: ["egg", "eggs"], name: "Egg, large", serving: "1 egg (50 g)", grams: 50, cal: 78, p: 6, c: 0.6, f: 5 },
  { keywords: ["greek yogurt", "yogurt", "yoghurt"], name: "Greek yogurt, plain", serving: "100 g", grams: 100, cal: 100, p: 17, c: 6, f: 0.7 },
  { keywords: ["cottage cheese"], name: "Cottage cheese", serving: "100 g", grams: 100, cal: 98, p: 11, c: 3.4, f: 4.3 },
  { keywords: ["white rice", "rice"], name: "White rice, cooked", serving: "100 g", grams: 100, cal: 130, p: 2.7, c: 28, f: 0.3 },
  { keywords: ["brown rice"], name: "Brown rice, cooked", serving: "100 g", grams: 100, cal: 123, p: 2.7, c: 26, f: 0.9 },
  { keywords: ["oats", "oatmeal", "porridge"], name: "Oats, dry", serving: "100 g", grams: 100, cal: 389, p: 16.9, c: 66, f: 6.9 },
  { keywords: ["sweet potato"], name: "Sweet potato, baked", serving: "100 g", grams: 100, cal: 90, p: 2, c: 21, f: 0.1 },
  { keywords: ["potato"], name: "Potato, baked", serving: "100 g", grams: 100, cal: 93, p: 2.5, c: 21, f: 0.1 },
  { keywords: ["banana"], name: "Banana", serving: "1 medium (118 g)", grams: 118, cal: 105, p: 1.3, c: 27, f: 0.4 },
  { keywords: ["avocado"], name: "Avocado", serving: "100 g", grams: 100, cal: 160, p: 2, c: 8.5, f: 14.7 },
  { keywords: ["almonds"], name: "Almonds", serving: "100 g", grams: 100, cal: 579, p: 21, c: 22, f: 50 },
  { keywords: ["peanut butter"], name: "Peanut butter", serving: "100 g", grams: 100, cal: 588, p: 25, c: 20, f: 50 },
  { keywords: ["broccoli"], name: "Broccoli, steamed", serving: "100 g", grams: 100, cal: 35, p: 2.4, c: 7, f: 0.4 },
  { keywords: ["protein shake", "whey", "protein powder"], name: "Protein shake (whey, 1 scoop)", serving: "1 scoop (30 g)", grams: 30, cal: 120, p: 24, c: 3, f: 1.5 },
];

function toResult(s) {
  return {
    id: `staple:${s.name.toLowerCase().replace(/\s+/g, "-")}`,
    name: s.name,
    serving: s.serving,
    grams: s.grams,
    cal: s.cal,
    p: s.p,
    c: s.c,
    f: s.f,
    source: "staples",
  };
}

// Matches on whole keywords (plus simple singular/plural) so "chicken"
// surfaces breast+thigh, but "chick" doesn't false-positive on everything.
function keywordMatches(keyword, q) {
  return keyword === q || keyword === `${q}s` || `${keyword}s` === q;
}

export function searchStaples(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return STAPLES.filter((s) => s.keywords.some((k) => keywordMatches(k, q))).map(toResult);
}
