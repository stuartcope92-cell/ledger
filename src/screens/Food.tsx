// ── Food tab ───────────────────────────────────────────────────
import { useEffect, useState } from "react";
import { Camera, Pencil, Trash2, Utensils, X } from "lucide-react";
import { C } from "../theme";
import { Btn, Card, Empty, Field } from "../components/ui";
import { foodProvider } from "../food/provider";
import { addMeal, deleteMeal, useMeals } from "../store";
import { todayISO } from "../utils/date";
import type { FoodResult } from "../types";

interface TodayStats {
  kcalIn: number;
  kcalOut: number;
  protein: number;
  carbs: number;
  fat: number;
}

const blankManual = { name: "", cal: 0, p: 0, c: 0, f: 0 };

export function Food({
  goal,
  pTarget,
  today,
}: {
  goal: number;
  pTarget: number;
  today: TodayStats;
}) {
  const meals = useMeals();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<FoodResult[]>([]);
  const [scanning, setScanning] = useState(false);
  const [candidates, setCandidates] = useState<FoodResult[]>([]);
  const [showManual, setShowManual] = useState(false);
  const [manual, setManual] = useState(blankManual);

  // Debounced text search through the swappable FoodProvider.
  useEffect(() => {
    let active = true;
    if (!q.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const r = await foodProvider.searchByText(q);
      if (active) setResults(r);
    }, 200);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [q]);

  const remaining = goal - today.kcalIn + today.kcalOut;
  const pRemaining = Math.max(0, pTarget - Math.round(today.protein));

  const commit = async (f: FoodResult) => {
    await addMeal({
      date: todayISO(),
      name: f.name,
      cal: f.cal,
      p: f.p,
      c: f.c,
      f: f.f,
      source: f.source,
    });
  };

  const scan = async () => {
    setScanning(true);
    try {
      // In production: capture/pick an image and pass its URI here.
      const found = await foodProvider.recognizePhoto("mock://photo");
      setCandidates(found);
    } finally {
      setScanning(false);
    }
  };

  const saveManual = async () => {
    if (!manual.name.trim()) return;
    await addMeal({
      date: todayISO(),
      name: manual.name.trim(),
      cal: manual.cal,
      p: manual.p,
      c: manual.c,
      f: manual.f,
      source: "manual",
    });
    setManual(blankManual);
    setShowManual(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Card style={{ textAlign: "center" }}>
        <span style={{ fontSize: 12, color: C.dim }}>Calories remaining</span>
        <div
          style={{
            fontSize: 32,
            fontWeight: 700,
            color: remaining >= 0 ? C.accent : C.warn,
          }}
        >
          {remaining} <span style={{ fontSize: 15, color: C.dim }}>kcal</span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 14,
            marginTop: 6,
            fontSize: 12,
          }}
        >
          <span style={{ color: C.protein }}>Protein left {pRemaining}g</span>
          <span style={{ color: C.dim }}>
            C {Math.round(today.carbs)}g · F {Math.round(today.fat)}g
          </span>
        </div>
      </Card>

      <div style={{ display: "flex", gap: 8 }}>
        <Btn
          onClick={scan}
          kind="ghost"
          style={{ flex: 1, padding: "12px 0" }}
          disabled={scanning}
        >
          <Camera size={16} /> {scanning ? "Analysing…" : "Scan photo"}
        </Btn>
        <Btn
          onClick={() => setShowManual((s) => !s)}
          kind="ghost"
          style={{ flex: 1, padding: "12px 0" }}
        >
          <Pencil size={16} /> Manual add
        </Btn>
      </div>

      {/* Photo-recognition candidates — user confirms before saving. */}
      {candidates.length > 0 && (
        <Card style={{ borderColor: C.protein }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600 }}>
              Photo match — pick one
            </span>
            <button
              onClick={() => setCandidates([])}
              aria-label="Dismiss photo matches"
              style={{ background: "none", border: "none", color: C.dim, cursor: "pointer" }}
            >
              <X size={16} />
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {candidates.map((f, i) => (
              <button
                key={i}
                onClick={async () => {
                  await commit(f);
                  setCandidates([]);
                }}
                style={{
                  textAlign: "left",
                  background: C.surface2,
                  border: `1px solid ${C.line}`,
                  borderRadius: 10,
                  padding: 10,
                  cursor: "pointer",
                  color: C.text,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <strong style={{ textTransform: "capitalize" }}>{f.name}</strong>
                  <span style={{ color: C.accent, fontWeight: 700 }}>{f.cal} kcal</span>
                </div>
                <span style={{ fontSize: 12, color: C.dim }}>
                  P {f.p}g · C {f.c}g · F {f.f}g
                </span>
              </button>
            ))}
          </div>
          <p style={{ fontSize: 11, color: C.dim, marginTop: 8 }}>
            Recognition is approximate — correct it or use manual add if it's off.
          </p>
        </Card>
      )}

      {/* Manual add fallback. */}
      {showManual && (
        <Card>
          <Field
            label="Food name"
            placeholder="e.g. Homemade curry"
            value={manual.name}
            onChange={(e) => setManual({ ...manual, name: e.target.value })}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <Field
                label="Calories"
                type="number"
                value={manual.cal}
                onChange={(e) => setManual({ ...manual, cal: +e.target.value })}
              />
            </div>
            <div style={{ flex: 1 }}>
              <Field
                label="Protein (g)"
                type="number"
                value={manual.p}
                onChange={(e) => setManual({ ...manual, p: +e.target.value })}
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <Field
                label="Carbs (g)"
                type="number"
                value={manual.c}
                onChange={(e) => setManual({ ...manual, c: +e.target.value })}
              />
            </div>
            <div style={{ flex: 1 }}>
              <Field
                label="Fat (g)"
                type="number"
                value={manual.f}
                onChange={(e) => setManual({ ...manual, f: +e.target.value })}
              />
            </div>
          </div>
          <Btn onClick={saveManual} disabled={!manual.name.trim()} style={{ width: "100%" }}>
            Add meal
          </Btn>
        </Card>
      )}

      <Card>
        <Field
          label="Search food"
          placeholder="e.g. chicken breast, protein shake…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {q.trim() &&
          (results.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {results.map((f, i) => (
                <button
                  key={i}
                  onClick={async () => {
                    await commit(f);
                    setQ("");
                  }}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    background: C.surface2,
                    border: `1px solid ${C.accent}`,
                    borderRadius: 10,
                    padding: 12,
                    cursor: "pointer",
                    color: C.text,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <strong style={{ textTransform: "capitalize" }}>{f.name}</strong>
                    <span style={{ color: C.accent, fontWeight: 700 }}>{f.cal} kcal</span>
                  </div>
                  <span style={{ fontSize: 12, color: C.dim }}>
                    P {f.p}g · C {f.c}g · F {f.f}g — tap to add
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <span style={{ fontSize: 13, color: C.dim }}>
              No match. Try chicken breast, banana, oatmeal… or add it manually.
            </span>
          ))}
      </Card>

      {meals.length === 0 && (
        <Empty icon={Utensils} msg="No meals logged. Scan, search or add manually." />
      )}
      {meals.map((m) => (
        <Card key={m.id}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <strong style={{ fontSize: 15, textTransform: "capitalize" }}>
                {m.name}
              </strong>
              <div style={{ fontSize: 12, color: C.dim, marginTop: 2 }}>
                <span style={{ color: C.protein }}>P {m.p}g</span> · C {m.c}g · F {m.f}g
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ color: C.accent, fontWeight: 700 }}>{m.cal}</span>
              <button
                onClick={() => deleteMeal(m.id)}
                aria-label={`Delete ${m.name}`}
                style={{ background: "none", border: "none", color: C.dim, cursor: "pointer" }}
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
