// ── Persistence (BUILD_SPEC §2, §4) ────────────────────────────
// Web target: Dexie over IndexedDB. Each log type is its own table keyed by
// `date` for fast range queries; the profile lives in a single settings row.
import Dexie, { type Table } from "dexie";
import type {
  CardioSession,
  DailyMisc,
  ExportBundle,
  ExportedPhoto,
  Meal,
  Profile,
  ProgressPhoto,
  Routine,
  WeighIn,
  Workout,
} from "./types";
import { DEFAULT_PROFILE, TEMPLATES } from "./seed";
import { blobToDataUrl, dataUrlToBlob } from "./utils/image";

interface SettingRow {
  key: string;
  value: unknown;
}

class LedgerDB extends Dexie {
  workouts!: Table<Workout, string>;
  cardio!: Table<CardioSession, string>;
  meals!: Table<Meal, string>;
  weighIns!: Table<WeighIn, string>;
  dailyMisc!: Table<DailyMisc, string>;
  settings!: Table<SettingRow, string>;
  progressPhotos!: Table<ProgressPhoto, string>;
  routines!: Table<Routine, string>;

  constructor() {
    super("ledger");
    this.version(1).stores({
      workouts: "id, date, name",
      cardio: "id, date, type",
      meals: "id, date, source",
      weighIns: "id, date",
      dailyMisc: "date",
      settings: "key",
    });
    this.version(2).stores({
      progressPhotos: "id, date",
    });
    this.version(3).stores({
      routines: "id, name",
    });
  }
}

export const db = new LedgerDB();

export const PROFILE_KEY = "profile";

export async function getProfile(): Promise<Profile> {
  const row = await db.settings.get(PROFILE_KEY);
  return (row?.value as Profile) ?? DEFAULT_PROFILE;
}

export async function saveProfile(profile: Profile): Promise<void> {
  await db.settings.put({ key: PROFILE_KEY, value: profile });
}

// Read-or-create today's water/steps row.
export async function getDailyMisc(date: string): Promise<DailyMisc> {
  const row = await db.dailyMisc.get(date);
  return row ?? { date, waterGlasses: 0, steps: 0 };
}

export async function saveDailyMisc(row: DailyMisc): Promise<void> {
  await db.dailyMisc.put(row);
}

// Seed the built-in Push/Pull/Leg Day routines once, only if the user has
// none yet (fresh install, or upgrading from before routines existed).
export async function ensureDefaultRoutines(): Promise<void> {
  const count = await db.routines.count();
  if (count > 0) return;
  const seeds: Routine[] = Object.entries(TEMPLATES).map(([name, exercises]) => ({
    id: `seed-${name.toLowerCase().replace(/\s+/g, "-")}`,
    name,
    exercises,
  }));
  await db.routines.bulkAdd(seeds);
}

// ── Export / Import (BUILD_SPEC §10) ───────────────────────────
export async function buildExport(): Promise<ExportBundle> {
  const [profile, workouts, cardio, meals, weighIns, dailyMisc, photos, routines] =
    await Promise.all([
      getProfile(),
      db.workouts.toArray(),
      db.cardio.toArray(),
      db.meals.toArray(),
      db.weighIns.toArray(),
      db.dailyMisc.toArray(),
      db.progressPhotos.toArray(),
      db.routines.toArray(),
    ]);
  const progressPhotos: ExportedPhoto[] = await Promise.all(
    photos.map(async (p) => ({
      id: p.id,
      date: p.date,
      weightKg: p.weightKg,
      note: p.note,
      dataUrl: await blobToDataUrl(p.blob),
    })),
  );
  return {
    version: 3,
    exportedAt: new Date().toISOString(),
    profile,
    workouts,
    cardio,
    meals,
    weighIns,
    dailyMisc,
    progressPhotos,
    routines,
  };
}

// Replace all data with an imported bundle (transactional, all-or-nothing).
export async function importBundle(bundle: ExportBundle): Promise<void> {
  if (!bundle || typeof bundle !== "object" || !bundle.profile) {
    throw new Error("Not a valid Ledger export file.");
  }
  const photos: ProgressPhoto[] = await Promise.all(
    (bundle.progressPhotos ?? []).map(async (p) => ({
      id: p.id,
      date: p.date,
      weightKg: p.weightKg,
      note: p.note,
      blob: await dataUrlToBlob(p.dataUrl),
    })),
  );
  await db.transaction(
    "rw",
    [
      db.workouts,
      db.cardio,
      db.meals,
      db.weighIns,
      db.dailyMisc,
      db.settings,
      db.progressPhotos,
      db.routines,
    ],
    async () => {
      await Promise.all([
        db.workouts.clear(),
        db.cardio.clear(),
        db.meals.clear(),
        db.weighIns.clear(),
        db.dailyMisc.clear(),
        db.progressPhotos.clear(),
        db.routines.clear(),
      ]);
      await Promise.all([
        db.workouts.bulkAdd(bundle.workouts ?? []),
        db.cardio.bulkAdd(bundle.cardio ?? []),
        db.meals.bulkAdd(bundle.meals ?? []),
        db.weighIns.bulkAdd(bundle.weighIns ?? []),
        db.dailyMisc.bulkAdd(bundle.dailyMisc ?? []),
        db.progressPhotos.bulkAdd(photos),
        db.routines.bulkAdd(bundle.routines ?? []),
        saveProfile(bundle.profile),
      ]);
    },
  );
}
