// Ledger calorie-tracking API.
// A thin proxy in front of food-data providers so API keys stay server-side and
// the app talks to one consistent, normalized interface.
//
// Endpoints:
//   GET  /api/health                 → provider availability
//   GET  /api/food/search?q=...      → text search (Nutritionix if keyed, else OFF)
//   GET  /api/food/barcode?code=...  → barcode lookup (Open Food Facts)
//   POST /api/food/recognize         → multipart image → detected foods
//
// Every food item comes back in the shape defined in lib/normalize.js.

// Load .env if present (Node 20.6+ supports --env-file; this keeps it simple
// and dependency-free for older runtimes).
import fs from "node:fs";
if (fs.existsSync(new URL("../.env", import.meta.url))) {
  for (const line of fs.readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

import express from "express";
import cors from "cors";
import multer from "multer";
import rateLimit from "express-rate-limit";

import { searchOFF, barcodeOFF } from "./providers/openFoodFacts.js";
import { searchNutritionix, nutritionixAvailable } from "./providers/nutritionix.js";
import { recognizePhoto, photoAvailable, photoProvider } from "./providers/photo.js";
import { searchStaples } from "./lib/staples.js";

const app = express();
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || "*" }));
app.use(express.json());

// Basic abuse protection; tune per deployment.
app.use("/api/", rateLimit({ windowMs: 60_000, max: 60 }));

// Accept a single image up to 8 MB, kept in memory (not written to disk).
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

const ok = (res, data) => res.json({ ok: true, data });
const fail = (res, code, msg) => res.status(code).json({ ok: false, error: msg });

app.get("/api/health", (_req, res) =>
  ok(res, {
    text: nutritionixAvailable() ? "nutritionix+openfoodfacts" : "openfoodfacts",
    photo: photoAvailable() ? photoProvider() : "unavailable",
  })
);

// ── Text search ────────────────────────────────────────────────
// Curated staples first (instant, always correct for common terms) — then
// Nutritionix when configured — then OFF backfill so a result set is never
// empty just because an earlier stage missed.
app.get("/api/food/search", async (req, res) => {
  const q = (req.query.q || "").toString().trim();
  if (!q) return fail(res, 400, "Missing query ?q=");
  try {
    let results = searchStaples(q);
    const seen = new Set(results.map(r => r.name.toLowerCase()));

    if (results.length < 5 && nutritionixAvailable()) {
      const nix = await searchNutritionix(q).catch(() => []);
      for (const r of nix) if (!seen.has(r.name.toLowerCase())) { results.push(r); seen.add(r.name.toLowerCase()); }
    }
    if (results.length < 5) {
      const off = await searchOFF(q).catch(() => []);
      results = results.concat(off.filter(r => !seen.has(r.name.toLowerCase())));
    }
    ok(res, results.slice(0, 25));
  } catch (e) {
    fail(res, 502, `Search failed: ${e.message}`);
  }
});

// ── Barcode ────────────────────────────────────────────────────
app.get("/api/food/barcode", async (req, res) => {
  const code = (req.query.code || "").toString().trim();
  if (!code) return fail(res, 400, "Missing ?code=");
  try {
    const product = await barcodeOFF(code);
    if (!product) return fail(res, 404, "Product not found");
    ok(res, product);
  } catch (e) {
    fail(res, 502, `Barcode lookup failed: ${e.message}`);
  }
});

// ── Photo recognition ──────────────────────────────────────────
app.post("/api/food/recognize", upload.single("image"), async (req, res) => {
  if (!photoAvailable())
    return fail(res, 501, "Photo recognition not configured. Set LOGMEAL_TOKEN or FOODVISOR_KEY.");
  if (!req.file) return fail(res, 400, "Attach an image field named 'image'");
  try {
    const results = await recognizePhoto(req.file.buffer, req.file.mimetype);
    // Client should present these as candidates for the user to confirm.
    ok(res, results);
  } catch (e) {
    fail(res, 502, `Recognition failed: ${e.message}`);
  }
});

// Vercel's Node runtime imports this module and calls the exported Express
// app directly as a request handler — it never needs (or wants) an actual
// listening socket, so skip it there.
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => console.log(`Ledger API on :${PORT}`));
}

export default app; // exported for serverless wrappers / tests
