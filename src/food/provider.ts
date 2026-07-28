// ── Food data & photo recognition (BUILD_SPEC §8) ──────────────
// Everything is abstracted behind FoodProvider so the API vendor can be
// swapped without touching UI. The default is a fully-offline seed provider;
// wire a real text API (Open Food Facts / Nutritionix) and a photo API
// (LogMeal / Foodvisor) by implementing the same interface.
import type { FoodResult } from "../types";
import { FOOD_DB } from "../seed";

export interface FoodProvider {
  searchByText(q: string): Promise<FoodResult[]>;
  recognizePhoto(uri: string): Promise<FoodResult[]>;
}

function seedToResults(): FoodResult[] {
  return Object.entries(FOOD_DB).map(([name, v]) => ({
    name,
    ...v,
    source: "search" as const,
  }));
}

// Offline provider backed by the local seed database.
export class OfflineFoodProvider implements FoodProvider {
  async searchByText(q: string): Promise<FoodResult[]> {
    const query = q.trim().toLowerCase();
    if (!query) return [];
    return seedToResults()
      .filter((f) => f.name.includes(query))
      .slice(0, 8);
  }

  // Mocked recognition: returns a few plausible candidates the user confirms.
  // Replace with a real image-recognition API call in production.
  async recognizePhoto(_uri: string): Promise<FoodResult[]> {
    await new Promise((r) => setTimeout(r, 1200));
    const all = seedToResults();
    const shuffled = [...all].sort(() => Math.random() - 0.5).slice(0, 3);
    return shuffled.map((f) => ({ ...f, source: "photo" as const }));
  }
}

// Single app-wide instance. Swap this line to change vendors.
export const foodProvider: FoodProvider = new OfflineFoodProvider();
