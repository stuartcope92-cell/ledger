// Photo → food recognition. Two vendors supported; pick whichever you have a key
// for via PHOTO_PROVIDER. Both are paid. Neither is perfect, so results always
// include a confidence score and the client must let the user confirm/adjust
// portion before saving.
//
//   LogMeal:  two-step — segment/recognise, then fetch nutrition for the dishes.
//             https://logmeal.com/api  (Authorization: Bearer <token>)
//   Foodvisor: single call returns items with nutrition.
//             https://www.foodvisor.io/en/vision/  (Authorization: Api-Key <key>)

import { tidy, ensureCalories, num } from "../lib/normalize.js";

export function photoProvider() {
  const p = (process.env.PHOTO_PROVIDER || "").toLowerCase();
  if (p === "logmeal" && process.env.LOGMEAL_TOKEN) return "logmeal";
  if (p === "foodvisor" && process.env.FOODVISOR_KEY) return "foodvisor";
  // auto-detect if PHOTO_PROVIDER unset
  if (process.env.LOGMEAL_TOKEN) return "logmeal";
  if (process.env.FOODVISOR_KEY) return "foodvisor";
  return null;
}

export function photoAvailable() {
  return photoProvider() !== null;
}

// imageBuffer: Node Buffer of the uploaded image. mime: e.g. "image/jpeg".
export async function recognizePhoto(imageBuffer, mime = "image/jpeg") {
  const provider = photoProvider();
  if (!provider) throw new Error("No photo provider configured");
  return provider === "logmeal"
    ? recognizeLogMeal(imageBuffer, mime)
    : recognizeFoodvisor(imageBuffer, mime);
}

// ── LogMeal ────────────────────────────────────────────────────
async function recognizeLogMeal(buf, mime) {
  const token = process.env.LOGMEAL_TOKEN;
  const auth = { Authorization: `Bearer ${token}` };

  // 1) segmentation + recognition
  const form1 = new FormData();
  form1.append("image", new Blob([buf], { type: mime }), "meal.jpg");
  const segRes = await fetch("https://api.logmeal.com/v2/image/segmentation/complete", {
    method: "POST", headers: auth, body: form1,
  });
  if (!segRes.ok) throw new Error(`LogMeal segmentation failed: ${segRes.status}`);
  const seg = await segRes.json();

  // 2) nutritional info for the recognised image
  const nutRes = await fetch("https://api.logmeal.com/v2/recipe/nutritionalInfo", {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({ imageId: seg.imageId }),
  });
  if (!nutRes.ok) throw new Error(`LogMeal nutrition failed: ${nutRes.status}`);
  const nut = await nutRes.json();

  // Map recognised dishes → FoodResults. LogMeal shapes vary by plan; we read
  // defensively and fall back to macro-derived calories where needed.
  const items = seg.segmentation_results || seg.recognition_results || [];
  const totals = nut.nutritional_info || {};
  return items.slice(0, 5).map((it, i) => {
    const top = (it.recognition_results && it.recognition_results[0]) || {};
    const t = totals.totalNutrients || {};
    return tidy(ensureCalories({
      id: `logmeal:${top.id || i}`,
      name: top.name || it.name || "Detected food",
      serving: "1 portion (estimate)",
      cal: num(totals.calories ?? totals.energy),
      p: num(t.PROCNT?.quantity),
      c: num(t.CHOCDF?.quantity),
      f: num(t.FAT?.quantity),
      source: "logmeal",
      confidence: num(top.prob, 0.5),
    }));
  });
}

// ── Foodvisor ──────────────────────────────────────────────────
async function recognizeFoodvisor(buf, mime) {
  const form = new FormData();
  form.append("image", new Blob([buf], { type: mime }), "meal.jpg");
  const res = await fetch("https://vision.foodvisor.io/api/1.0/en/analysis/", {
    method: "POST",
    headers: { Authorization: `Api-Key ${process.env.FOODVISOR_KEY}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Foodvisor failed: ${res.status}`);
  const data = await res.json();

  const out = [];
  for (const item of data.items || []) {
    for (const f of item.food || []) {
      const info = f.food_info || {};
      const nut = info.nutrition || {};
      const grams = num(f.quantity) || num(info.g_per_serving) || 100;
      const k = grams / 100;
      out.push(tidy(ensureCalories({
        id: `foodvisor:${info.food_id || info.display_name}`,
        name: info.display_name || "Detected food",
        serving: `${grams} g (estimate)`,
        grams,
        cal: num(nut.calories_100g) * k,
        p: num(nut.proteins_100g) * k,
        c: num(nut.carbs_100g) * k,
        f: num(nut.fat_100g) * k,
        source: "foodvisor",
        confidence: num(f.confidence, 0.5),
      })));
    }
  }
  return out.slice(0, 5);
}
