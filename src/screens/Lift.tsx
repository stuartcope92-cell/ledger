// ── Lift tab ───────────────────────────────────────────────────
import { useMemo, useState } from "react";
import { Award, Check, Dumbbell, Layers, Plus, Trash2, X } from "lucide-react";
import { C } from "../theme";
import { BackBar, Btn, Card, Empty, Field, inp } from "../components/ui";
import { RestTimer } from "../components/RestTimer";
import { EXERCISE_LIBRARY, TEMPLATES } from "../seed";
import { addWorkout, deleteWorkout, loadTemplate, useWorkouts } from "../store";
import { shortLabel } from "../utils/date";
import type { SetEntry } from "../types";

export function Lift() {
  const workouts = useWorkouts();
  const [adding, setAdding] = useState(false);
  const [exercise, setExercise] = useState("");
  const [custom, setCustom] = useState("");
  const [sets, setSets] = useState<SetEntry[]>([{ weight: 20, reps: 10 }]);
  const [query, setQuery] = useState("");

  const filtered = EXERCISE_LIBRARY.filter((e) =>
    e.toLowerCase().includes(query.toLowerCase()),
  );
  const name = custom.trim() || exercise;

  // Progressive-overload hint: most recent session for this exercise.
  const lastSession = useMemo(
    () => workouts.find((w) => w.name === name),
    [workouts, name],
  );

  const resetForm = () => {
    setAdding(false);
    setExercise("");
    setCustom("");
    setSets([{ weight: 20, reps: 10 }]);
    setQuery("");
  };

  const save = async () => {
    if (!name) return;
    await addWorkout(name, sets);
    resetForm();
  };

  if (adding) {
    return (
      <div>
        <BackBar onBack={resetForm} title="Log exercise" />
        <RestTimer />
        <Card style={{ marginBottom: 12 }}>
          <Field
            label="Search exercises"
            placeholder="Type to filter…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCustom("");
            }}
          />
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              maxHeight: 130,
              overflowY: "auto",
            }}
          >
            {filtered.map((e) => (
              <button
                key={e}
                onClick={() => {
                  setExercise(e);
                  setCustom("");
                }}
                aria-pressed={exercise === e}
                style={{
                  padding: "6px 10px",
                  borderRadius: 8,
                  fontSize: 13,
                  cursor: "pointer",
                  border: `1px solid ${exercise === e ? C.accent : C.line}`,
                  background: exercise === e ? C.accent : C.surface2,
                  color: exercise === e ? C.onAccent : C.text,
                }}
              >
                {e}
              </button>
            ))}
          </div>
          <div style={{ marginTop: 12 }}>
            <Field
              label="…or add your own"
              placeholder="Custom exercise name"
              value={custom}
              onChange={(e) => {
                setCustom(e.target.value);
                setExercise("");
              }}
            />
          </div>
        </Card>

        {lastSession && (
          <Card
            style={{
              marginBottom: 12,
              borderColor: C.accentDim,
              background: C.surface2,
            }}
          >
            <span style={{ fontSize: 12, color: C.accent, fontWeight: 600 }}>
              ↑ Last time ({shortLabel(lastSession.date)}) — beat this
            </span>
            <div
              style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}
            >
              {lastSession.sets.map((s, i) => (
                <span key={i} style={{ fontSize: 12, color: C.dim }}>
                  {s.weight}kg×{s.reps}
                </span>
              ))}
            </div>
          </Card>
        )}

        <Card style={{ marginBottom: 12 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 600 }}>Sets</span>
            <Btn
              kind="ghost"
              onClick={() => setSets([...sets, { ...sets[sets.length - 1] }])}
              style={{ padding: "4px 10px" }}
            >
              <Plus size={14} /> Set
            </Btn>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "28px 1fr 1fr 32px",
              gap: 8,
              fontSize: 11,
              color: C.dim,
              marginBottom: 6,
            }}
          >
            <span>#</span>
            <span>Weight (kg)</span>
            <span>Reps</span>
            <span></span>
          </div>
          {sets.map((s, i) => (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "28px 1fr 1fr 32px",
                gap: 8,
                alignItems: "center",
                marginBottom: 6,
              }}
            >
              <span style={{ color: C.dim, fontSize: 13 }}>{i + 1}</span>
              <input
                type="number"
                aria-label={`Set ${i + 1} weight in kilograms`}
                value={s.weight}
                onChange={(e) =>
                  setSets(
                    sets.map((x, j) =>
                      j === i ? { ...x, weight: +e.target.value } : x,
                    ),
                  )
                }
                style={inp}
              />
              <input
                type="number"
                aria-label={`Set ${i + 1} reps`}
                value={s.reps}
                onChange={(e) =>
                  setSets(
                    sets.map((x, j) =>
                      j === i ? { ...x, reps: +e.target.value } : x,
                    ),
                  )
                }
                style={inp}
              />
              <button
                onClick={() => setSets(sets.filter((_, j) => j !== i))}
                aria-label={`Remove set ${i + 1}`}
                disabled={sets.length === 1}
                style={{
                  background: "none",
                  border: "none",
                  color: C.dim,
                  cursor: sets.length === 1 ? "default" : "pointer",
                  opacity: sets.length === 1 ? 0.4 : 1,
                }}
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </Card>
        <Btn onClick={save} disabled={!name} style={{ width: "100%", padding: "12px 0" }}>
          <Check size={16} /> Save {name || "exercise"}
        </Btn>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Btn onClick={() => setAdding(true)} style={{ padding: "12px 0" }}>
        <Plus size={16} /> Log exercise
      </Btn>
      <Card>
        <div
          style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}
        >
          <Layers size={15} color={C.dim} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>Quick routines</span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {Object.keys(TEMPLATES).map((t) => (
            <Btn
              key={t}
              kind="ghost"
              onClick={() => loadTemplate(TEMPLATES[t])}
              style={{ flex: 1, padding: "8px 0", fontSize: 13 }}
            >
              {t}
            </Btn>
          ))}
        </div>
      </Card>
      {workouts.length === 0 && (
        <Empty icon={Dumbbell} msg="No lifts yet. Tap to log or load a routine." />
      )}
      {workouts.map((w) => (
        <Card key={w.id}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <strong
              style={{ fontSize: 15, display: "flex", alignItems: "center", gap: 6 }}
            >
              {w.name}
              {w.isPR && <Award size={15} color={C.accent} />}
            </strong>
            <button
              onClick={() => deleteWorkout(w.id)}
              aria-label={`Delete ${w.name}`}
              style={{ background: "none", border: "none", color: C.dim, cursor: "pointer" }}
            >
              <Trash2 size={15} />
            </button>
          </div>
          <div
            style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}
          >
            {w.sets.map((s, i) => (
              <span
                key={i}
                style={{
                  fontSize: 12,
                  background: C.surface2,
                  padding: "4px 8px",
                  borderRadius: 6,
                  color: C.dim,
                }}
              >
                {s.weight}kg × {s.reps}
              </span>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
