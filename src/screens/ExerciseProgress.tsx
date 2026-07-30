// ── Check exercise progress (stacked sub-screen off Progress) ──
import { useMemo, useState } from "react";
import { TrendingUp } from "lucide-react";
import { C } from "../theme";
import { BackBar, Btn, Card, Field } from "../components/ui";
import { LineChart } from "../components/LineChart";
import { EXERCISE_LIBRARY } from "../seed";
import { useWorkouts } from "../store";
import { buildExerciseSeries, type ExerciseMetric } from "../utils/series";
import { shortLabel } from "../utils/date";
import { kgToDisplay, unitSystemOf, weightUnitLabel } from "../utils/units";
import type { Profile } from "../types";

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
  const [exercise, setExercise] = useState<string | null>(null);
  const [metric, setMetric] = useState<ExerciseMetric>("e1rm");
  const [query, setQuery] = useState("");
  const unit = unitSystemOf(profile);

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
  const unitLabel = weightUnitLabel(unit);

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
