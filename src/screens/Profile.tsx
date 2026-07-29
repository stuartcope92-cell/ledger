// ── You (profile) tab ──────────────────────────────────────────
import { useRef, useState } from "react";
import { Download, Droplet, FileSpreadsheet, Footprints, Upload } from "lucide-react";
import { C } from "../theme";
import { Btn, Card, Field, Row, inp } from "../components/ui";
import { ACTIVITY, bmi, proteinTarget } from "../formulas";
import { buildExport, importBundle } from "../db";
import {
  logWeight,
  setSteps,
  setWater,
  useCardio,
  useDailyMisc,
  useMeals,
  useWeighIns,
  useWorkouts,
} from "../store";
import { todayISO } from "../utils/date";
import { downloadCSV, toCSV } from "../utils/csv";
import type { ActivityLevel, GoalMode, Profile as ProfileT } from "../types";

const MODE_BUTTONS: [GoalMode, string, string][] = [
  ["deficit", "Deficit −400", C.cardio],
  ["maintain", "Maintain", C.dim],
  ["surplus", "Surplus +350", C.protein],
];

export function Profile({
  profile,
  update,
  maintenance,
  goal,
}: {
  profile: ProfileT;
  update: (patch: Partial<ProfileT>) => void;
  maintenance: number;
  goal: number;
}) {
  const weighIns = useWeighIns();
  const misc = useDailyMisc();
  const meals = useMeals();
  const workouts = useWorkouts();
  const cardio = useCardio();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const bmiVal = bmi(profile.weightKg, profile.heightCm).toFixed(1);
  const autoProtein = proteinTarget(profile.weightKg);

  const exportData = async () => {
    const bundle = await buildExport();
    const blob = new Blob([JSON.stringify(bundle, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ledger-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // CSV: separate, clean per-entity tables — not one mixed-schema file —
  // since that's what's actually useful to open and graph in a spreadsheet.
  const exportWeighInsCSV = () =>
    downloadCSV(`ledger-weighins-${todayISO()}.csv`, toCSV(weighIns, ["date", "weightKg"]));
  const exportMealsCSV = () =>
    downloadCSV(`ledger-meals-${todayISO()}.csv`, toCSV(meals, ["date", "name", "cal", "p", "c", "f", "source"]));
  const exportWorkoutsCSV = () => {
    const rows = workouts.flatMap((w) =>
      w.sets.map((s, i) => ({
        date: w.date,
        exercise: w.name,
        set: i + 1,
        weightKg: s.weight,
        reps: s.reps,
        isPR: w.isPR && i === 0 ? "yes" : "",
      })),
    );
    downloadCSV(`ledger-workouts-${todayISO()}.csv`, toCSV(rows, ["date", "exercise", "set", "weightKg", "reps", "isPR"]));
  };
  const exportCardioCSV = () =>
    downloadCSV(`ledger-cardio-${todayISO()}.csv`, toCSV(cardio, ["date", "type", "duration", "pace", "incline", "cal"]));

  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      await importBundle(JSON.parse(text));
      setMsg("Data restored from backup.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Import failed.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Card>
        <Field
          label="Name"
          value={profile.name}
          onChange={(e) => update({ name: e.target.value })}
          placeholder="Your name"
        />
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <Field
              label="Age"
              type="number"
              value={profile.age}
              onChange={(e) => update({ age: +e.target.value })}
            />
          </div>
          <div style={{ flex: 1 }}>
            <Field
              label="Height (cm)"
              type="number"
              value={profile.heightCm}
              onChange={(e) => update({ heightCm: +e.target.value })}
            />
          </div>
        </div>
        <Field
          label="Weight (kg)"
          type="number"
          value={profile.weightKg}
          onChange={(e) => update({ weightKg: +e.target.value })}
        />
        <span style={{ fontSize: 12, color: C.dim, display: "block", marginBottom: 6 }}>
          Sex (for BMR accuracy)
        </span>
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          {(["male", "female"] as const).map((s) => (
            <button
              key={s}
              onClick={() => update({ sex: s })}
              aria-pressed={profile.sex === s}
              style={{
                flex: 1,
                padding: "8px 0",
                borderRadius: 8,
                fontSize: 13,
                textTransform: "capitalize",
                cursor: "pointer",
                border: `1px solid ${profile.sex === s ? C.accent : C.line}`,
                background: profile.sex === s ? C.accent : C.surface2,
                color: profile.sex === s ? C.onAccent : C.text,
              }}
            >
              {s}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 12, color: C.dim, display: "block", marginBottom: 6 }}>
          Activity level
        </span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {(Object.keys(ACTIVITY) as ActivityLevel[]).map((a) => (
            <button
              key={a}
              onClick={() => update({ activity: a })}
              aria-pressed={profile.activity === a}
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                fontSize: 12,
                cursor: "pointer",
                border: `1px solid ${profile.activity === a ? C.accent : C.line}`,
                background: profile.activity === a ? C.accent : C.surface2,
                color: profile.activity === a ? C.onAccent : C.text,
              }}
            >
              {a}
            </button>
          ))}
        </div>
      </Card>

      <Card style={{ borderColor: C.accentDim }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
          }}
        >
          <span style={{ fontSize: 13, color: C.dim }}>Maintenance (TDEE)</span>
          <span style={{ fontSize: 18, fontWeight: 700 }}>{maintenance} kcal</span>
        </div>
        <span style={{ fontSize: 12, color: C.dim, display: "block", margin: "12px 0 6px" }}>
          Goal mode
        </span>
        <div style={{ display: "flex", gap: 6 }}>
          {MODE_BUTTONS.map(([m, lbl, col]) => (
            <button
              key={m}
              onClick={() => update({ mode: m })}
              aria-pressed={profile.mode === m}
              style={{
                flex: 1,
                padding: "10px 4px",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                border: `1px solid ${profile.mode === m ? col : C.line}`,
                background: profile.mode === m ? col : C.surface2,
                color: profile.mode === m ? C.onAccent : C.text,
              }}
            >
              {lbl}
            </button>
          ))}
        </div>
        <div style={{ textAlign: "center", marginTop: 12 }}>
          <span style={{ fontSize: 12, color: C.dim }}>Daily target</span>
          <div style={{ fontSize: 26, fontWeight: 700, color: C.accent }}>{goal} kcal</div>
        </div>
        <p style={{ fontSize: 11, color: C.dim, lineHeight: 1.5, marginTop: 10, marginBottom: 0 }}>
          Estimated via Mifflin-St Jeor. Any formula is ±10%. For your true number:
          hold this intake 2–3 weeks and watch your weight trend — if it's flat,
          that's your real maintenance. Adjust from there.
        </p>

        <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.line}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: C.dim }}>Protein goal (g)</span>
            {profile.proteinGoalG !== undefined && (
              <button
                onClick={() => update({ proteinGoalG: undefined })}
                style={{ background: "none", border: "none", color: C.protein, fontSize: 11, fontWeight: 600, cursor: "pointer", padding: 0 }}
              >
                Reset to auto
              </button>
            )}
          </div>
          <input
            type="number"
            aria-label="Protein goal in grams"
            placeholder={`${autoProtein} (auto)`}
            value={profile.proteinGoalG ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              update({ proteinGoalG: v === "" ? undefined : Math.max(0, +v) });
            }}
            style={inp}
          />
          <span style={{ fontSize: 11, color: C.dim, display: "block", marginTop: 6 }}>
            {profile.proteinGoalG !== undefined
              ? "Custom goal — overrides the 1.8g/kg calculation."
              : `Auto: 1.8g × ${profile.weightKg}kg = ${autoProtein}g`}
          </span>
        </div>
      </Card>

      <Card>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 10,
          }}
        >
          <span style={{ fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
            <Droplet size={16} color={C.cardio} /> Water
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={() => setWater(misc.waterGlasses - 1)}
              aria-label="Remove a glass of water"
              style={{ ...inp, width: "auto", padding: "4px 12px", cursor: "pointer" }}
            >
              −
            </button>
            <span style={{ fontWeight: 700, minWidth: 24, textAlign: "center" }}>
              {misc.waterGlasses}
            </span>
            <button
              onClick={() => setWater(misc.waterGlasses + 1)}
              aria-label="Add a glass of water"
              style={{ ...inp, width: "auto", padding: "4px 12px", cursor: "pointer" }}
            >
              +
            </button>
          </div>
        </div>
        <div
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
        >
          <span style={{ fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
            <Footprints size={16} color={C.accent} /> Steps
          </span>
          <input
            type="number"
            aria-label="Steps today"
            value={misc.steps}
            onChange={(e) => setSteps(+e.target.value)}
            style={{ ...inp, width: 100 }}
          />
        </div>
      </Card>

      <Card>
        <Row label="BMI" val={bmiVal} />
        <Row label="Weigh-ins recorded" val={weighIns.length} last />
        <Btn
          kind="ghost"
          onClick={() => logWeight(profile.weightKg)}
          style={{ width: "100%", marginTop: 12 }}
        >
          Log today's weight ({profile.weightKg} kg)
        </Btn>
      </Card>

      <div style={{ display: "flex", gap: 8 }}>
        <Btn kind="ghost" onClick={exportData} style={{ flex: 1, padding: "12px 0" }}>
          <Download size={16} /> Export
        </Btn>
        <Btn
          kind="ghost"
          onClick={() => fileRef.current?.click()}
          style={{ flex: 1, padding: "12px 0" }}
        >
          <Upload size={16} /> Import
        </Btn>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          onChange={onImportFile}
          style={{ display: "none" }}
        />
      </div>
      {msg && (
        <p style={{ fontSize: 12, color: C.dim, textAlign: "center" }}>{msg}</p>
      )}

      <Card>
        <span style={{ fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
          <FileSpreadsheet size={15} color={C.dim} /> Export CSV
        </span>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <Btn kind="ghost" onClick={exportWeighInsCSV} disabled={weighIns.length === 0} style={{ padding: "10px 0", fontSize: 13 }}>
            Weigh-ins
          </Btn>
          <Btn kind="ghost" onClick={exportMealsCSV} disabled={meals.length === 0} style={{ padding: "10px 0", fontSize: 13 }}>
            Meals
          </Btn>
          <Btn kind="ghost" onClick={exportWorkoutsCSV} disabled={workouts.length === 0} style={{ padding: "10px 0", fontSize: 13 }}>
            Workouts
          </Btn>
          <Btn kind="ghost" onClick={exportCardioCSV} disabled={cardio.length === 0} style={{ padding: "10px 0", fontSize: 13 }}>
            Cardio
          </Btn>
        </div>
      </Card>

      <p style={{ fontSize: 11, color: C.dim, textAlign: "center", lineHeight: 1.5 }}>
        Everything is stored on this device only. No account, no tracking.
        Export is a full JSON backup; Import restores it exactly. CSVs are for
        opening a table in a spreadsheet, not for restoring.
      </p>
    </div>
  );
}
