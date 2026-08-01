// Every provider maps its raw response into this single shape so the client
// never has to care which upstream service answered.
//
// FoodResult {
//   id:         string   stable-ish id ("off:737628064502", "nix:eggs", ...)
//   name:       string   display name
//   brand:      string?  brand if known
//   serving:    string   human-readable serving ("100 g", "1 medium (118 g)")
//   grams:      number?  serving weight in grams when known (for scaling)
//   gramsIsEstimate: boolean?  true when grams is a generic fallback, not
//                              this product's real serving size
//   cal:        number   kcal for the stated serving
//   p, c, f:    number   protein / carbs / fat in grams for the stated serving
//   source:     string   provider id
//   confidence: number?  0..1, only for photo recognition
// }

const num = (v, d = 0) => {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : d;
};

// Round macros to 1dp, calories to whole numbers — enough precision for tracking.
export function tidy(result) {
  return {
    ...result,
    cal: Math.round(num(result.cal)),
    p: Math.round(num(result.p) * 10) / 10,
    c: Math.round(num(result.c) * 10) / 10,
    f: Math.round(num(result.f) * 10) / 10,
  };
}

// Scale a per-100g nutriment block to an arbitrary gram amount.
export function per100gToServing({ cal100, p100, c100, f100, grams }) {
  const k = grams / 100;
  return { cal: cal100 * k, p: p100 * k, c: c100 * k, f: f100 * k };
}

// If a provider only gives calories, estimate them from macros as a sanity
// fallback (4/4/9 kcal per gram). Never overrides a real calorie value.
export function ensureCalories(r) {
  if (num(r.cal) > 0) return r;
  return { ...r, cal: r.p * 4 + r.c * 4 + r.f * 9 };
}

export { num };
