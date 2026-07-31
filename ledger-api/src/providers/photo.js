// Photo → food recognition. Three vendors supported; pick whichever you have a
// key for via PHOTO_PROVIDER. LogMeal/Foodvisor are paid, purpose-built food
// APIs. Gemini is a general-purpose vision model prompted for the same
// structured output — free-tier eligible, the recommended default if you don't
// already have a food-API subscription. Neither is perfect, so results always
// include a confidence score and the client must let the user confirm/adjust
// portion before saving.
//
//   LogMeal:  two-step — segment/recognise, then fetch nutrition for the dishes.
//             https://logmeal.com/api  (Authorization: Bearer <token>)
//   Foodvisor: single call returns items with nutrition.
//             https://www.foodvisor.io/en/vision/  (Authorization: Api-Key <key>)
//   Gemini:   single call, prompted for structured JSON via responseSchema.
//             https://aistudio.google.com  (?key=<api key> query param)

import { tidy, ensureCalories, num } from "../lib/normalize.js";

export function photoProvider() {
  const p = (process.env.PHOTO_PROVIDER || "").toLowerCase();
  if (p === "logmeal" && process.env.LOGMEAL_TOKEN) return "logmeal";
  if (p === "foodvisor" && process.env.FOODVISOR_KEY) return "foodvisor";
  if (p === "gemini" && process.env.GEMINI_API_KEY) return "gemini";
  // auto-detect if PHOTO_PROVIDER unset
  if (process.env.LOGMEAL_TOKEN) return "logmeal";
  if (process.env.FOODVISOR_KEY) return "foodvisor";
  if (process.env.GEMINI_API_KEY) return "gemini";
  return null;
}

export function photoAvailable() {
  return photoProvider() !== null;
}

// imageBuffer: Node Buffer of the uploaded image. mime: e.g. "image/jpeg".
export async function recognizePhoto(imageBuffer, mime = "image/jpeg") {
  const provider = photoProvider();
  if (!provider) throw new Error("No photo provider configured");
  if (provider === "logmeal") return recognizeLogMeal(imageBuffer, mime);
  if (provider === "foodvisor") return recognizeFoodvisor(imageBuffer, mime);
  return recognizeGemini(imageBuffer, mime);
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

// ── Gemini ─────────────────────────────────────────────────────
// A general-purpose vision model, not a food-specific API — prompted for the
// same shape the other providers return, using responseSchema so the model's
// output is guaranteed-parseable JSON rather than free text we'd have to
// scrape. GEMINI_MODEL defaults to Flash (good accuracy/cost/quota balance);
// override to e.g. "gemini-2.5-flash-lite" for a higher free-tier quota, or
// "gemini-2.5-pro" for better accuracy at a lower one.
const GEMINI_PROMPT =
  "Identify each distinct food item in this photo of a meal. For each, estimate a " +
  "display name, a short human-readable serving description, the serving weight in " +
  "grams, and calories/protein/carbs/fat (grams) for that estimated serving. Return " +
  "up to 5 items, most prominent first. confidence is 0-1: how sure you are of the " +
  "identification itself, not the nutrition estimate. If no food is visible, return " +
  "an empty items array.";

const GEMINI_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          serving: { type: "string" },
          grams: { type: "number" },
          cal: { type: "number" },
          p: { type: "number" },
          c: { type: "number" },
          f: { type: "number" },
          confidence: { type: "number" },
        },
        required: ["name", "serving", "cal", "p", "c", "f", "confidence"],
      },
    },
  },
  required: ["items"],
};

async function recognizeGemini(buf, mime) {
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: GEMINI_PROMPT },
              { inline_data: { mime_type: mime, data: buf.toString("base64") } },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: GEMINI_SCHEMA,
        },
      }),
    },
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Gemini request failed: ${res.status} ${detail}`.trim());
  }
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no content");

  const items = JSON.parse(text).items;
  if (!Array.isArray(items)) return [];

  return items.slice(0, 5).map((it, i) =>
    tidy(ensureCalories({
      id: `gemini:${i}-${(it.name || "food").toLowerCase().replace(/\s+/g, "-")}`,
      name: it.name || "Detected food",
      serving: it.serving || "1 portion (estimate)",
      grams: it.grams ? num(it.grams) : undefined,
      cal: num(it.cal),
      p: num(it.p),
      c: num(it.c),
      f: num(it.f),
      source: "gemini",
      confidence: num(it.confidence, 0.5),
    })),
  );
}
