// ── Food tab ───────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { Camera, Check, Pencil, Trash2, Utensils, X } from "lucide-react";
import { C } from "../theme";
import { BackBar, Btn, Card, Empty, Field } from "../components/ui";
import { apiFoodProvider, scaleToGrams, type FoodResult } from "../services/foodProvider";
import { addMeal, deleteMeal, useMeals } from "../store";
import { todayISO } from "../utils/date";
import type { MealSource } from "../types";

interface TodayStats {
  kcalIn: number;
  kcalOut: number;
  protein: number;
  carbs: number;
  fat: number;
}

type SearchState = "idle" | "loading" | "loaded" | "empty" | "error";
type PhotoStatus = "unknown" | "available" | "unavailable";

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
  const [searchState, setSearchState] = useState<SearchState>("idle");

  const [photoStatus, setPhotoStatus] = useState<PhotoStatus>("unknown");
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<FoodResult[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showManual, setShowManual] = useState(false);
  const [manual, setManual] = useState(blankManual);

  // Portion editor: the item being adjusted before it's saved as a Meal, and
  // which flow it came from (drives the saved Meal's `source`).
  const [portion, setPortion] = useState<{ item: FoodResult; kind: MealSource } | null>(null);
  const [portionGrams, setPortionGrams] = useState(100);

  // Check once whether photo recognition is configured server-side; never
  // let this block or crash the rest of the tab.
  useEffect(() => {
    let cancelled = false;
    apiFoodProvider
      .health()
      .then((h) => {
        if (!cancelled) setPhotoStatus(h.photo === "unavailable" ? "unavailable" : "available");
      })
      .catch(() => {
        if (!cancelled) setPhotoStatus("unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounced text search (300ms). `cancelled` guards against a stale
  // response from an earlier keystroke overwriting a newer one.
  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      setSearchState("idle");
      return;
    }
    setSearchState("loading");
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const r = await apiFoodProvider.searchByText(q);
        if (cancelled) return;
        setResults(r);
        setSearchState(r.length > 0 ? "loaded" : "empty");
      } catch {
        if (!cancelled) setSearchState("error");
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q]);

  const remaining = goal - today.kcalIn + today.kcalOut;
  const pRemaining = Math.max(0, pTarget - Math.round(today.protein));

  const openPortion = (item: FoodResult, kind: MealSource) => {
    setPortionGrams(item.grams ?? 100);
    setPortion({ item, kind });
  };

  const saveScaled = async () => {
    if (!portion) return;
    const scaled = hasGrams(portion.item) ? scaleToGrams(portion.item, portionGrams) : portion.item;
    await addMeal({
      date: todayISO(),
      name: scaled.name,
      cal: scaled.cal,
      p: scaled.p,
      c: scaled.c,
      f: scaled.f,
      source: portion.kind,
    });
    setPortion(null);
    setQ("");
    setCandidates([]);
  };

  const startScan = () => fileInputRef.current?.click();

  const onPhotoPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file again later
    if (!file) return;
    setScanning(true);
    setScanError(null);
    try {
      const found = await apiFoodProvider.recognizePhoto(file);
      setCandidates(found);
      if (found.length === 0) setScanError("No foods recognized in that photo — try search instead.");
    } catch {
      setScanError("Couldn't reach the food service — check the API is running.");
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

  // ── Portion editor: takes over the tab while adjusting a pick ──
  if (portion) {
    const scaled = hasGrams(portion.item) ? scaleToGrams(portion.item, portionGrams) : portion.item;
    return (
      <div>
        <BackBar onBack={() => setPortion(null)} title="Add to log" />
        <Card style={{ marginBottom: 12 }}>
          <strong style={{ fontSize: 16, textTransform: "capitalize" }}>{scaled.name}</strong>
          {scaled.brand && <div style={{ fontSize: 12, color: C.dim, marginTop: 2 }}>{scaled.brand}</div>}

          {hasGrams(portion.item) ? (
            <div style={{ marginTop: 12 }}>
              <Field
                label="Portion (grams)"
                type="number"
                value={portionGrams}
                onChange={(e) => setPortionGrams(Math.max(0, +e.target.value))}
              />
            </div>
          ) : (
            <div style={{ fontSize: 12, color: C.dim, marginTop: 12 }}>
              Serving: {portion.item.serving} (portion size unknown — logged as one serving)
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: C.accent }}>{scaled.cal}</div>
              <span style={{ fontSize: 11, color: C.dim }}>kcal</span>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: C.protein }}>{scaled.p}g</div>
              <span style={{ fontSize: 11, color: C.dim }}>protein</span>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{scaled.c}g</div>
              <span style={{ fontSize: 11, color: C.dim }}>carbs</span>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{scaled.f}g</div>
              <span style={{ fontSize: 11, color: C.dim }}>fat</span>
            </div>
          </div>
        </Card>
        <Btn onClick={saveScaled} style={{ width: "100%", padding: "12px 0" }}>
          <Check size={16} /> Save meal
        </Btn>
      </div>
    );
  }

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
        <div style={{ flex: 1 }}>
          <Btn
            onClick={startScan}
            kind="ghost"
            style={{ width: "100%", padding: "12px 0" }}
            disabled={scanning || photoStatus !== "available"}
          >
            <Camera size={16} /> {scanning ? "Analysing…" : "Scan photo"}
          </Btn>
          {photoStatus === "unavailable" && (
            <p style={{ fontSize: 10, color: C.dim, textAlign: "center", marginTop: 4 }}>
              Photo scanning needs an API key
            </p>
          )}
        </div>
        <Btn
          onClick={() => setShowManual((s) => !s)}
          kind="ghost"
          style={{ flex: 1, padding: "12px 0" }}
        >
          <Pencil size={16} /> Manual add
        </Btn>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={onPhotoPicked}
          style={{ display: "none" }}
        />
      </div>

      {scanError && (
        <p style={{ fontSize: 12, color: C.warn, textAlign: "center" }}>{scanError}</p>
      )}

      {/* Photo-recognition candidates — user confirms/adjusts before saving. */}
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
            <span style={{ fontSize: 13, fontWeight: 600 }}>Photo match — pick one</span>
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
                onClick={() => openPortion(f, "photo")}
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
                  {f.confidence !== undefined ? ` · ${Math.round(f.confidence * 100)}% match` : ""}
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
        {searchState === "loading" && (
          <span style={{ fontSize: 13, color: C.dim }}>Searching…</span>
        )}
        {searchState === "error" && (
          <span style={{ fontSize: 13, color: C.warn }}>
            Couldn't reach the food service — check the API is running.
          </span>
        )}
        {searchState === "empty" && (
          <span style={{ fontSize: 13, color: C.dim }}>No matches — try another term.</span>
        )}
        {searchState === "loaded" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {results.map((f) => (
              <button
                key={f.id}
                onClick={() => openPortion(f, "search")}
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
                  {f.brand ? `${f.brand} · ` : ""}
                  {f.serving} — P {f.p}g · C {f.c}g · F {f.f}g
                </span>
              </button>
            ))}
          </div>
        )}
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
              <strong style={{ fontSize: 15, textTransform: "capitalize" }}>{m.name}</strong>
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

const hasGrams = (item: FoodResult): boolean => !!item.grams && item.grams > 0;
