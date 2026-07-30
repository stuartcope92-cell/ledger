// ── Lift tab ───────────────────────────────────────────────────
import { useMemo, useState } from "react";
import {
  Award,
  Check,
  CheckCircle2,
  Circle,
  Dumbbell,
  Layers,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { C } from "../theme";
import { BackBar, Btn, Card, Empty, Field, inp } from "../components/ui";
import { RestTimer } from "../components/RestTimer";
import { EXERCISE_LIBRARY } from "../seed";
import {
  addRoutine,
  addWorkout,
  deleteRoutine,
  deleteWorkout,
  updateWorkout,
  useRoutines,
  useWorkouts,
} from "../store";
import { shortLabel, todayISO } from "../utils/date";
import { displayToKg, kgToDisplay, unitSystemOf, weightUnitLabel } from "../utils/units";
import { plateBreakdown, warmupLadder } from "../utils/plates";
import { useBackClose } from "../utils/useBackClose";
import type { Profile, Routine, SetEntry, SetType, Workout } from "../types";

interface Session {
  name: string;
  exercises: string[];
}

const SET_TYPES: { id: SetType; label: string }[] = [
  { id: "warmup", label: "Wu" },
  { id: "working", label: "W" },
  { id: "drop", label: "Drop" },
  { id: "failure", label: "Fail" },
];

export function Lift({ profile }: { profile: Profile }) {
  const workouts = useWorkouts();
  const routines = useRoutines();
  const unit = unitSystemOf(profile);
  const weightLabel = weightUnitLabel(unit);

  // Log-exercise flow (also used to log one exercise from an active session).
  const [adding, setAdding] = useState(false);
  const [exercise, setExercise] = useState("");
  const [custom, setCustom] = useState("");
  const [sets, setSets] = useState<SetEntry[]>([{ weight: 20, reps: 10, type: "working" }]);
  const [query, setQuery] = useState("");
  const [editingWorkout, setEditingWorkout] = useState<Workout | null>(null);
  // True when this flow was opened by tapping an exercise in an active
  // routine session — the exercise is already chosen there, so the search/
  // custom picker is redundant clutter and gets hidden (still shown for a
  // fresh ad-hoc "Log exercise" or when editing a past entry, where
  // correcting to a different exercise entirely is a real use case).
  const [fromSession, setFromSession] = useState(false);

  // Routine creator.
  const [creatingRoutine, setCreatingRoutine] = useState(false);
  const [routineName, setRoutineName] = useState("");
  const [routineExercises, setRoutineExercises] = useState<string[]>([]);
  const [routineQuery, setRoutineQuery] = useState("");
  const [routineCustom, setRoutineCustom] = useState("");

  // Active session: which exercises have been logged so far (this view only —
  // not persisted, just a convenience queue over the existing log flow).
  const [session, setSession] = useState<Session | null>(null);

  // Session "done" reflects what's actually been logged today, not a
  // per-visit flag — re-entering the same routine later still shows
  // exercises you already did.
  const doneToday = useMemo(() => {
    const today = todayISO();
    return new Set(workouts.filter((w) => w.date === today).map((w) => w.name));
  }, [workouts]);

  const filtered = EXERCISE_LIBRARY.filter((e) =>
    e.toLowerCase().includes(query.toLowerCase()),
  );
  const name = custom.trim() || exercise;

  // Progressive-overload hint: most recent session for this exercise.
  const lastSession = useMemo(
    () => workouts.find((w) => w.name === name),
    [workouts, name],
  );

  const closeAddFlow = () => {
    setAdding(false);
    setExercise("");
    setCustom("");
    setSets([{ weight: 20, reps: 10, type: "working" }]);
    setQuery("");
    setEditingWorkout(null);
    setFromSession(false);
  };
  useBackClose(adding, closeAddFlow);

  // Opens the log flow pre-filled with one exercise — used by session rows.
  // Also prefills the sets from that exercise's most recent session (same
  // data as the "beat this" hint) so there's a real weight to work from
  // instead of the placeholder 20kg/10 default — without it, the plate
  // calculator below has nothing meaningful to compute for a repeat lift.
  const openLogFor = (exerciseName: string) => {
    setExercise(exerciseName);
    setCustom("");
    setQuery("");
    const prior = workouts.find((w) => w.name === exerciseName);
    setSets(
      prior
        ? prior.sets.map((s) => ({ weight: s.weight, reps: s.reps, type: "working" as const }))
        : [{ weight: 20, reps: 10, type: "working" }],
    );
    setEditingWorkout(null);
    setFromSession(true);
    setAdding(true);
  };

  // Opens the same flow pre-filled with an already-logged workout's values —
  // fixing a typo'd weight (or the wrong exercise entirely) shouldn't mean
  // delete-and-redo.
  const openEditWorkout = (w: Workout) => {
    setExercise(w.name);
    setCustom("");
    setQuery("");
    setSets(w.sets.map((s) => ({ ...s })));
    setEditingWorkout(w);
    setFromSession(false);
    setAdding(true);
  };

  const save = async () => {
    if (!name) return;
    if (editingWorkout) {
      // Preserve the original date — editing sets shouldn't move the entry.
      await updateWorkout(editingWorkout.id, name, sets, editingWorkout.date);
    } else {
      await addWorkout(name, sets);
    }
    closeAddFlow();
  };

  const startSession = (r: Routine) => setSession({ name: r.name, exercises: r.exercises });
  const exitSession = () => setSession(null);
  useBackClose(session !== null, exitSession);

  const closeRoutineCreator = () => {
    setCreatingRoutine(false);
    setRoutineName("");
    setRoutineExercises([]);
    setRoutineQuery("");
    setRoutineCustom("");
  };
  useBackClose(creatingRoutine, closeRoutineCreator);
  const saveRoutine = async () => {
    if (!routineName.trim() || routineExercises.length === 0) return;
    await addRoutine(routineName.trim(), routineExercises);
    closeRoutineCreator();
  };
  const toggleRoutineExercise = (n: string) => {
    setRoutineExercises((prev) =>
      prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n],
    );
  };
  const addCustomRoutineExercise = () => {
    const v = routineCustom.trim();
    if (!v || routineExercises.includes(v)) {
      setRoutineCustom("");
      return;
    }
    setRoutineExercises((prev) => [...prev, v]);
    setRoutineCustom("");
  };
  const removeRoutineExercise = (n: string) => {
    setRoutineExercises((prev) => prev.filter((x) => x !== n));
  };

  if (adding) {
    return (
      <div>
        <BackBar
          onBack={closeAddFlow}
          title={editingWorkout ? "Edit exercise" : fromSession ? name : "Log exercise"}
        />
        <RestTimer />
        {fromSession ? (
          <Card style={{ marginBottom: 12, textAlign: "center" }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>{name}</span>
          </Card>
        ) : (
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
        )}

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
                  {kgToDisplay(s.weight, unit)}{weightLabel}×{s.reps}
                </span>
              ))}
            </div>
          </Card>
        )}

        {(() => {
          const targetWeightKg = Math.max(0, ...sets.map((s) => s.weight));
          if (targetWeightKg <= 0) return null;
          const plates = plateBreakdown(targetWeightKg, unit);
          const ladder = warmupLadder(targetWeightKg, unit);
          return (
            <Card style={{ marginBottom: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 600, display: "block", marginBottom: 8 }}>
                Plate calculator
              </span>
              <p style={{ fontSize: 12, color: C.dim, margin: "0 0 10px" }}>
                {plates.length > 0
                  ? `Per side: ${plates.map((p) => `${p.count}×${p.plate}`).join(" + ")}`
                  : "Bar only — no plates needed."}
              </p>
              {ladder.length > 0 && (
                <>
                  <span style={{ fontSize: 12, color: C.dim, display: "block", marginBottom: 6 }}>
                    Warm-up ladder
                  </span>
                  {ladder.map((rung, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "6px 0",
                        borderBottom: i === ladder.length - 1 ? "none" : `1px solid ${C.line}`,
                      }}
                    >
                      <span style={{ fontSize: 13 }}>
                        <span style={{ color: C.dim, fontSize: 11 }}>{rung.label}</span>{" "}
                        {kgToDisplay(rung.weightKg, unit)}{weightLabel} × {rung.reps}
                      </span>
                      <Btn
                        kind="ghost"
                        onClick={() =>
                          setSets([{ weight: rung.weightKg, reps: rung.reps, type: "warmup" }, ...sets])
                        }
                        style={{ padding: "3px 8px", fontSize: 11 }}
                      >
                        <Plus size={12} /> Add
                      </Btn>
                    </div>
                  ))}
                </>
              )}
            </Card>
          );
        })()}

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
            <span>Weight ({weightLabel})</span>
            <span>Reps</span>
            <span></span>
          </div>
          {sets.map((s, i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "28px 1fr 1fr 32px",
                  gap: 8,
                  alignItems: "center",
                }}
              >
                <span style={{ color: C.dim, fontSize: 13 }}>{i + 1}</span>
                <input
                  type="number"
                  aria-label={`Set ${i + 1} weight in ${unit === "imperial" ? "pounds" : "kilograms"}`}
                  value={kgToDisplay(s.weight, unit)}
                  onChange={(e) =>
                    setSets(
                      sets.map((x, j) =>
                        j === i ? { ...x, weight: displayToKg(+e.target.value, unit) } : x,
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
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  marginTop: 6,
                  paddingLeft: 36,
                  alignItems: "center",
                }}
              >
                {SET_TYPES.map((t) => {
                  const on = (s.type ?? "working") === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() =>
                        setSets(sets.map((x, j) => (j === i ? { ...x, type: t.id } : x)))
                      }
                      aria-pressed={on}
                      style={{
                        padding: "3px 8px",
                        borderRadius: 6,
                        fontSize: 11,
                        cursor: "pointer",
                        border: `1px solid ${on ? C.accent : C.line}`,
                        background: on ? C.accent : C.surface2,
                        color: on ? C.onAccent : C.dim,
                      }}
                    >
                      {t.label}
                    </button>
                  );
                })}
                <input
                  type="number"
                  min={1}
                  max={10}
                  placeholder="RPE"
                  aria-label={`Set ${i + 1} RPE`}
                  value={s.rpe ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSets(
                      sets.map((x, j) =>
                        j === i
                          ? { ...x, rpe: v === "" ? undefined : Math.min(10, Math.max(1, +v)) }
                          : x,
                      ),
                    );
                  }}
                  style={{ ...inp, width: 56, padding: "3px 6px", fontSize: 12 }}
                />
              </div>
            </div>
          ))}
        </Card>
        <Btn onClick={save} disabled={!name} style={{ width: "100%", padding: "12px 0" }}>
          <Check size={16} /> {editingWorkout ? `Save changes` : `Save ${name || "exercise"}`}
        </Btn>
      </div>
    );
  }

  if (creatingRoutine) {
    const filteredLib = EXERCISE_LIBRARY.filter((e) =>
      e.toLowerCase().includes(routineQuery.toLowerCase()),
    );
    return (
      <div>
        <BackBar onBack={closeRoutineCreator} title="New routine" />
        <Card style={{ marginBottom: 12 }}>
          <Field
            label="Routine name"
            placeholder="e.g. Push Day"
            value={routineName}
            onChange={(e) => setRoutineName(e.target.value)}
          />
        </Card>
        <Card style={{ marginBottom: 12 }}>
          <Field
            label="Add exercises"
            placeholder="Search the library…"
            value={routineQuery}
            onChange={(e) => setRoutineQuery(e.target.value)}
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
            {filteredLib.map((e) => {
              const included = routineExercises.includes(e);
              return (
                <button
                  key={e}
                  onClick={() => toggleRoutineExercise(e)}
                  aria-pressed={included}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    fontSize: 13,
                    cursor: "pointer",
                    border: `1px solid ${included ? C.accent : C.line}`,
                    background: included ? C.accent : C.surface2,
                    color: included ? C.onAccent : C.text,
                  }}
                >
                  {e}
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <Field
                label="…or add your own"
                placeholder="Custom exercise name"
                value={routineCustom}
                onChange={(e) => setRoutineCustom(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustomRoutineExercise();
                  }
                }}
              />
            </div>
            <Btn
              kind="ghost"
              onClick={addCustomRoutineExercise}
              disabled={!routineCustom.trim()}
              style={{ padding: "10px 14px", marginBottom: 12 }}
            >
              Add
            </Btn>
          </div>
        </Card>

        {routineExercises.length > 0 && (
          <Card style={{ marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 8 }}>
              {routineExercises.length} exercise{routineExercises.length === 1 ? "" : "s"}
            </span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {routineExercises.map((e) => (
                <span
                  key={e}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 12,
                    background: C.surface2,
                    padding: "4px 6px 4px 10px",
                    borderRadius: 6,
                    color: C.text,
                  }}
                >
                  {e}
                  <button
                    onClick={() => removeRoutineExercise(e)}
                    aria-label={`Remove ${e}`}
                    style={{ background: "none", border: "none", color: C.dim, cursor: "pointer", display: "flex", padding: 2 }}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          </Card>
        )}

        <Btn
          onClick={saveRoutine}
          disabled={!routineName.trim() || routineExercises.length === 0}
          style={{ width: "100%", padding: "12px 0" }}
        >
          <Check size={16} /> Save routine
        </Btn>
      </div>
    );
  }

  if (session) {
    const allDone = session.exercises.every((e) => doneToday.has(e));
    return (
      <div>
        <BackBar onBack={exitSession} title={session.name} />
        <Card>
          {session.exercises.map((e, i) => {
            const done = doneToday.has(e);
            return (
              <button
                key={e}
                onClick={() => openLogFor(e)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 0",
                  borderBottom: i === session.exercises.length - 1 ? "none" : `1px solid ${C.line}`,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: C.text,
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, opacity: done ? 0.6 : 1 }}>
                  {done ? <CheckCircle2 size={16} color={C.accent} /> : <Circle size={16} color={C.dim} />}
                  {e}
                </span>
                {done && <span style={{ fontSize: 11, color: C.accent }}>Logged</span>}
              </button>
            );
          })}
        </Card>
        {allDone && (
          <p style={{ fontSize: 12, color: C.accent, textAlign: "center", marginTop: 10 }}>
            All exercises logged — nice work.
          </p>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Btn onClick={() => { setFromSession(false); setAdding(true); }} style={{ padding: "12px 0" }}>
        <Plus size={16} /> Log exercise
      </Btn>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600 }}>
            <Layers size={15} color={C.dim} /> Routines
          </span>
          <Btn kind="ghost" onClick={() => setCreatingRoutine(true)} style={{ padding: "4px 10px", fontSize: 12 }}>
            <Plus size={13} /> New
          </Btn>
        </div>
        {routines.length === 0 ? (
          <p style={{ fontSize: 12, color: C.dim }}>
            No routines yet — create one to queue up a session's exercises.
          </p>
        ) : (
          routines.map((r, i) => (
            <div
              key={r.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 0",
                borderBottom: i === routines.length - 1 ? "none" : `1px solid ${C.line}`,
              }}
            >
              <button
                onClick={() => startSession(r)}
                style={{ flex: 1, textAlign: "left", background: "none", border: "none", cursor: "pointer", color: C.text, padding: 0 }}
              >
                <div style={{ fontSize: 14, fontWeight: 600 }}>{r.name}</div>
                <div style={{ fontSize: 11, color: C.dim }}>
                  {r.exercises.length} exercise{r.exercises.length === 1 ? "" : "s"}
                </div>
              </button>
              <button
                onClick={() => deleteRoutine(r.id)}
                aria-label={`Delete ${r.name}`}
                style={{ background: "none", border: "none", color: C.dim, cursor: "pointer" }}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))
        )}
      </Card>
      {workouts.length === 0 && (
        <Empty icon={Dumbbell} msg="No lifts yet. Tap to log or start a routine." />
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
            <button
              onClick={() => openEditWorkout(w)}
              aria-label={`Edit ${w.name}`}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                color: C.text,
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 15,
                fontWeight: 700,
              }}
            >
              {w.name}
              {w.isPR && <Award size={15} color={C.accent} />}
            </button>
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
                {kgToDisplay(s.weight, unit)}{weightLabel} × {s.reps}
                {s.type && s.type !== "working" && ` · ${SET_TYPES.find((t) => t.id === s.type)?.label}`}
                {s.rpe !== undefined && ` · @${s.rpe}`}
              </span>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
