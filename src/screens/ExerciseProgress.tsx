// ── Check exercise progress (stacked sub-screen off Progress) ──
import { useMemo, useState } from "react";
import { Target, TrendingUp } from "lucide-react";
import { C } from "../theme";
import { BackBar, Btn, Card, Field } from "../components/ui";
import { LineChart } from "../components/LineChart";
import { EXERCISE_LIBRARY } from "../seed";
import { estimated1RM } from "../formulas";
import { buildProgrammedLift, detectGoalCompletion, PHASE_LABEL, prescribeNext } from "../progression";
import {
  deleteProgrammedLift,
  saveProgrammedLift,
  uid,
  useProgrammedLifts,
  useWorkouts,
} from "../store";
import { buildExerciseSeries, type ExerciseMetric } from "../utils/series";
import { shortLabel } from "../utils/date";
import { displayToKg, kgToDisplay, unitSystemOf, weightUnitLabel } from "../utils/units";
import type { LiftType, Profile, SetEntry } from "../types";

const METRICS: { id: ExerciseMetric; label: string; blurb: string }[] = [
  {
    id: "e1rm",
    label: "Est. 1RM",
    blurb:
      "Epley estimate from your best set. Stays comparable even when reps change — it isolates strength.",
  },
  {
    id: "volume",
    label: "Volume",
    blurb: "Total kg moved that session (Σ weight × reps). Workload, not just strength.",
  },
  {
    id: "topset",
    label: "Top set",
    blurb: "Heaviest single set that session.",
  },
];

export function ExerciseProgress({
  profile,
  onBack,
}: {
  profile: Profile;
  onBack: () => void;
}) {
  const workouts = useWorkouts();
  const programmedLifts = useProgrammedLifts();
  const [exercise, setExercise] = useState<string | null>(null);
  const [metric, setMetric] = useState<ExerciseMetric>("e1rm");
  const [query, setQuery] = useState("");
  const unit = unitSystemOf(profile);
  const unitLabel = weightUnitLabel(unit);

  // Goal-setting form state (opt-in overlay on top of plain logging).
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [goalType, setGoalType] = useState<LiftType>("compound");
  const [goalCurrentWeight, setGoalCurrentWeight] = useState(0);
  const [goalCurrentReps, setGoalCurrentReps] = useState(5);
  const [goalTargetWeight, setGoalTargetWeight] = useState(0);
  const [goalTargetReps, setGoalTargetReps] = useState(5);
  const [goalRepMin, setGoalRepMin] = useState(4);
  const [goalRepMax, setGoalRepMax] = useState(6);
  const [goalSets, setGoalSets] = useState(3);
  const [goalAssistLevels, setGoalAssistLevels] = useState("");

  const activeLift = exercise ? programmedLifts.find((l) => l.exerciseName === exercise) : undefined;

  const openGoalForm = () => {
    if (!exercise) return;
    if (activeLift) {
      setGoalType(activeLift.type);
      setGoalCurrentWeight(activeLift.currentWeight);
      setGoalCurrentReps(activeLift.currentReps);
      setGoalTargetWeight(activeLift.targetWeight);
      setGoalTargetReps(activeLift.targetReps);
      setGoalRepMin(activeLift.repRangeMin);
      setGoalRepMax(activeLift.repRangeMax);
      setGoalSets(activeLift.sets);
      setGoalAssistLevels(activeLift.assistLevels?.join(", ") ?? "");
      setShowGoalForm(true);
      return;
    }
    const last = workouts.find((w) => w.name === exercise);
    const bestSet = last?.sets.reduce<SetEntry | undefined>(
      (best, s) => (!best || s.weight > best.weight ? s : best),
      undefined,
    );
    setGoalType("compound");
    setGoalCurrentWeight(bestSet?.weight ?? 20);
    setGoalCurrentReps(bestSet?.reps ?? 5);
    setGoalTargetWeight(Math.round(((bestSet?.weight ?? 20) * 1.1) / 2.5) * 2.5);
    setGoalTargetReps(bestSet?.reps ?? 5);
    setGoalRepMin(Math.max(1, (bestSet?.reps ?? 6) - 2));
    setGoalRepMax(bestSet?.reps ?? 6);
    setGoalSets(3);
    setGoalAssistLevels("");
    setShowGoalForm(true);
  };

  const saveGoal = async () => {
    if (!exercise) return;
    const isAssisted = goalType === "assisted";
    let assistLevels: number[] | undefined;
    if (isAssisted) {
      assistLevels = goalAssistLevels
        .split(",")
        .map((s) => parseFloat(s.trim()))
        .filter((n) => !Number.isNaN(n));
      // Goal completion for assisted lifts requires reaching 0 assist —
      // enforce the ladder always ends there.
      if (assistLevels.length === 0 || assistLevels[assistLevels.length - 1] !== 0) {
        assistLevels.push(0);
      }
    }
    const repMax = Math.max(goalRepMin, goalRepMax);
    const lift = buildProgrammedLift({
      id: activeLift?.id ?? uid(),
      exerciseName: exercise,
      type: goalType,
      currentWeight: isAssisted ? assistLevels![0] : goalCurrentWeight,
      currentReps: goalCurrentReps,
      repRangeMin: goalRepMin,
      repRangeMax: repMax,
      sets: goalSets,
      targetWeight: isAssisted ? 0 : goalTargetWeight,
      targetReps: goalTargetReps,
      assistLevels,
    });
    await saveProgrammedLift(lift);
    setShowGoalForm(false);
  };

  const clearGoal = async () => {
    if (activeLift) await deleteProgrammedLift(activeLift.id);
    setShowGoalForm(false);
  };

  // Choices: the seed library ∪ anything the user has actually logged.
  const options = useMemo(() => {
    const logged = new Set(workouts.map((w) => w.name));
    const all = new Set<string>([...EXERCISE_LIBRARY, ...logged]);
    return [...all]
      .filter((e) => e.toLowerCase().includes(query.toLowerCase()))
      .sort();
  }, [workouts, query]);

  const loggedNames = useMemo(
    () => new Set(workouts.map((w) => w.name)),
    [workouts],
  );

  const series = useMemo(
    () => (exercise ? buildExerciseSeries(workouts, exercise, metric) : []),
    [workouts, exercise, metric],
  );
  const displaySeries = useMemo(
    () => series.map((p) => ({ ...p, v: kgToDisplay(p.v, unit) })),
    [series, unit],
  );

  const activeBlurb = METRICS.find((m) => m.id === metric)!.blurb;

  const delta =
    displaySeries.length >= 2 ? displaySeries.at(-1)!.v - displaySeries[0].v : 0;

  return (
    <div>
      <BackBar onBack={onBack} title="Exercise progress" />

      <Card style={{ marginBottom: 12 }}>
        <Field
          label="Pick an exercise"
          placeholder="Search your lifts…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            maxHeight: 132,
            overflowY: "auto",
          }}
        >
          {options.map((e) => {
            const on = exercise === e;
            const hasData = loggedNames.has(e);
            return (
              <button
                key={e}
                onClick={() => setExercise(e)}
                aria-pressed={on}
                style={{
                  padding: "6px 10px",
                  borderRadius: 8,
                  fontSize: 13,
                  cursor: "pointer",
                  border: `1px solid ${on ? C.accent : C.line}`,
                  background: on ? C.accent : C.surface2,
                  color: on ? C.onAccent : hasData ? C.text : C.dim,
                }}
              >
                {e}
              </button>
            );
          })}
        </div>
      </Card>

      {!exercise && (
        <div style={{ textAlign: "center", padding: "40px 20px", color: C.dim }}>
          <TrendingUp size={32} style={{ opacity: 0.5 }} />
          <p style={{ fontSize: 14, marginTop: 10 }}>
            Pick an exercise to see its trend.
          </p>
        </div>
      )}

      {exercise && !activeLift && !showGoalForm && (
        <Btn kind="ghost" onClick={openGoalForm} style={{ width: "100%", marginBottom: 12 }}>
          <Target size={14} /> Set a goal for {exercise}
        </Btn>
      )}

      {showGoalForm && (
        <Card style={{ marginBottom: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 600, display: "block", marginBottom: 10 }}>
            Set a goal — {exercise}
          </span>
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            {(["compound", "assisted"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setGoalType(t)}
                aria-pressed={goalType === t}
                style={{
                  flex: 1,
                  padding: "8px 0",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  border: `1px solid ${goalType === t ? C.accent : C.line}`,
                  background: goalType === t ? C.accent : C.surface2,
                  color: goalType === t ? C.onAccent : C.text,
                }}
              >
                {t === "compound" ? "Compound" : "Assisted"}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <Field
                label={`Current ${goalType === "assisted" ? "assist" : "weight"} (${unitLabel})`}
                type="number"
                value={kgToDisplay(goalCurrentWeight, unit)}
                onChange={(e) => setGoalCurrentWeight(displayToKg(+e.target.value, unit))}
              />
            </div>
            <div style={{ flex: 1 }}>
              <Field
                label="Current reps"
                type="number"
                value={goalCurrentReps}
                onChange={(e) => setGoalCurrentReps(+e.target.value)}
              />
            </div>
          </div>

          {goalType === "compound" ? (
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <Field
                  label={`Target weight (${unitLabel})`}
                  type="number"
                  value={kgToDisplay(goalTargetWeight, unit)}
                  onChange={(e) => setGoalTargetWeight(displayToKg(+e.target.value, unit))}
                />
              </div>
              <div style={{ flex: 1 }}>
                <Field
                  label="Target reps"
                  type="number"
                  value={goalTargetReps}
                  onChange={(e) => setGoalTargetReps(+e.target.value)}
                />
              </div>
            </div>
          ) : (
            <>
              <Field
                label="Target reps (fully unassisted)"
                type="number"
                value={goalTargetReps}
                onChange={(e) => setGoalTargetReps(+e.target.value)}
              />
              <Field
                label={`Assist levels, easiest to hardest (${unitLabel}, comma separated — ends in 0)`}
                placeholder="e.g. 54, 45, 35, 0"
                value={goalAssistLevels}
                onChange={(e) => setGoalAssistLevels(e.target.value)}
              />
            </>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <Field
                label="Rep range min"
                type="number"
                value={goalRepMin}
                onChange={(e) => setGoalRepMin(+e.target.value)}
              />
            </div>
            <div style={{ flex: 1 }}>
              <Field
                label="Rep range max"
                type="number"
                value={goalRepMax}
                onChange={(e) => setGoalRepMax(+e.target.value)}
              />
            </div>
            <div style={{ flex: 1 }}>
              <Field
                label="Sets"
                type="number"
                value={goalSets}
                onChange={(e) => setGoalSets(+e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <Btn kind="ghost" onClick={() => setShowGoalForm(false)} style={{ flex: 1 }}>
              Cancel
            </Btn>
            <Btn onClick={saveGoal} style={{ flex: 1 }}>
              Save goal
            </Btn>
          </div>
        </Card>
      )}

      {exercise && activeLift && !showGoalForm && (() => {
        const prescription = prescribeNext(activeLift);
        const complete = detectGoalCompletion(activeLift);
        const current1RM =
          activeLift.type === "compound" ? estimated1RM(activeLift.currentWeight, activeLift.currentReps) : null;
        const progressPct =
          current1RM != null && activeLift.target1RM > 0
            ? Math.min(100, Math.max(0, (current1RM / activeLift.target1RM) * 100))
            : 0;
        return (
          <Card style={{ marginBottom: 12, borderColor: C.accentDim }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.accent }}>Programmed goal</span>
              <div style={{ display: "flex", gap: 12 }}>
                <button
                  onClick={openGoalForm}
                  style={{ background: "none", border: "none", color: C.dim, fontSize: 11, cursor: "pointer" }}
                >
                  Edit
                </button>
                <button
                  onClick={clearGoal}
                  style={{ background: "none", border: "none", color: C.warn, fontSize: 11, cursor: "pointer" }}
                >
                  Clear goal
                </button>
              </div>
            </div>
            {complete ? (
              <p style={{ fontSize: 13, color: C.accent, margin: 0 }}>
                Goal reached — set a new target when you're ready.
              </p>
            ) : (
              <>
                <div style={{ fontSize: 12, color: C.dim, marginBottom: 4 }}>
                  {PHASE_LABEL[prescription.phase]} phase
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 10 }}>
                  {prescription.sets} × {prescription.reps} @ {kgToDisplay(prescription.weight, unit)}
                  {unitLabel}
                  {activeLift.type === "assisted" ? " assist" : ""}
                </div>
                {current1RM != null && (
                  <>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 11,
                        color: C.dim,
                        marginBottom: 4,
                      }}
                    >
                      <span>Est. 1RM {kgToDisplay(current1RM, unit)}{unitLabel}</span>
                      <span>Goal {kgToDisplay(activeLift.targetWeight, unit)}{unitLabel}</span>
                    </div>
                    <div style={{ height: 6, background: C.surface2, borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ width: `${progressPct}%`, height: "100%", background: C.accent }} />
                    </div>
                  </>
                )}
                {activeLift.consecutiveFailures > 0 && (
                  <p style={{ fontSize: 11, color: C.warn, marginTop: 10, marginBottom: 0 }}>
                    {activeLift.consecutiveFailures} missed session
                    {activeLift.consecutiveFailures > 1 ? "s" : ""} — one more triggers a deload.
                  </p>
                )}
              </>
            )}
          </Card>
        );
      })()}

      {exercise && series.length === 0 && (
        <Card>
          <p style={{ fontSize: 13, color: C.dim }}>
            No sessions logged for <strong style={{ color: C.text }}>{exercise}</strong> yet.
            Log it from the Lift tab and it'll chart here.
          </p>
        </Card>
      )}

      {exercise && series.length > 0 && (
        <Card>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 4,
            }}
          >
            <strong style={{ fontSize: 15 }}>{exercise}</strong>
            <span style={{ fontSize: 12, color: C.dim }}>
              {series.length} session{series.length > 1 ? "s" : ""}
            </span>
          </div>

          <div style={{ display: "flex", gap: 16, alignItems: "baseline" }}>
            <div>
              <span style={{ fontSize: 26, fontWeight: 700, color: C.accent }}>
                {displaySeries.at(-1)!.v}
              </span>
              <span style={{ fontSize: 12, color: C.dim }}> {unitLabel} latest</span>
            </div>
            {displaySeries.length >= 2 && (
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: delta > 0 ? C.accent : delta < 0 ? C.warn : C.dim,
                }}
              >
                {delta > 0 ? "▲ +" : delta < 0 ? "▼ " : "± "}
                {Math.abs(delta)} {unitLabel} since {shortLabel(displaySeries[0].iso)}
              </span>
            )}
          </div>

          <LineChart points={displaySeries} color={C.accent} yLabel={(v) => `${v}`} />

          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            {METRICS.map((m) => (
              <Btn
                key={m.id}
                kind={metric === m.id ? "primary" : "ghost"}
                onClick={() => setMetric(m.id)}
                style={{ flex: 1, padding: "8px 0", fontSize: 12 }}
              >
                {m.label}
              </Btn>
            ))}
          </div>
          <p style={{ fontSize: 11, color: C.dim, lineHeight: 1.5, marginTop: 10, marginBottom: 0 }}>
            {activeBlurb}
          </p>
        </Card>
      )}
    </div>
  );
}
