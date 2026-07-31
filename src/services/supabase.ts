// Supabase client — auth only for now. Data (workouts, meals, etc.) stays in
// local Dexie/IndexedDB (src/db.ts) until the separate data-migration phase.
import { createClient } from "@supabase/supabase-js";

const env = (import.meta as { env?: Record<string, string | undefined> }).env;
const url = env?.VITE_SUPABASE_URL;
const anonKey = env?.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Fails loudly at startup rather than a confusing runtime error the first
  // time something touches auth — there's no sensible default for these,
  // unlike VITE_API_URL's localhost fallback.
  throw new Error(
    "Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — set them in .env (see .env.example).",
  );
}

export const supabase = createClient(url, anonKey);
