// ── Progress tab (home) ────────────────────────────────────────
import { useMemo, useState } from "react";
import { Droplet, Footprints, LineChart as LineChartIcon, Trophy } from "lucide-react";
import { C } from "../theme";
import { Btn, Card, Row } from "../components/ui";
import { CalorieBar, ProteinBar } from "../components/BudgetBar";
import { LineChart } from "../components/LineChart";
import { ExerciseProgress } from "./ExerciseProgress";
import { setsVolume } from "../formulas";
import { inRange, type RangeKey } from "../utils/date";
import { average, buildTrendSeries, setsPerMuscleGroup, type TrendMetric } from "../utils/series";
import { kgToDisplay, unitSystemOf, weightUnitLabel } from "../utils/units";
import { personalRecords } from "../store";
import type {
  CardioSession,
  DailyMisc,
  Meal,
  Profile,
  WeighIn,
  Workout,
} from "../types";

const modeLabel: Record<Profile["mode"], string> = {
  deficit: "cutting",
  surplus: "bulking",
  maintain: "maintaining",
};

// Trend-chart metrics, each with its own theme colour and y-axis unit (§6).
const TREND_METRICS: { id: TrendMetric; label: string; color: string; unit: string }[] = [
  { id: "weight", label: "Weight", color: C.body, unit: "kg" },
  { id: "calories", label: "Calories", color: C.accent, unit: "kcal" },
  { id: "protein", label: "Protein", color: C.protein, unit: "g" },
  { id: "cardio", label: "Cardio", color: C.cardio, unit: "kcal" },
];

export function Progress({
  profile,
  workouts,
  cardio,
  meals,
  weighIns,
  todayMisc,
  goal,
  pTarget,
}: {
  profile: Profile;
  workouts: Workout[];
  cardio: CardioSession[];
  meals: Meal[];
  weighIns: WeighIn[];
  todayMisc: DailyMisc;
  goal: number;
  pTarget: number;
}) {
  const [range, setRange] = useState<RangeKey>("day");
  const [metric, setMetric] = useState<TrendMetric>("weight");
  const [showExercise, setShowExercise] = useState(false);
  const unit = unitSystemOf(profile);

  const stats = useMemo(() => {
    const m = inRange(meals, range);
    const c = inRange(cardio, range);
    const w = inRange(workouts, range);
    return {
      kcalIn: m.reduce((s, x) => s + x.cal, 0),
      kcalOut: c.reduce((s, x) => s + x.cal, 0),
      protein: m.reduce((s, x) => s + x.p, 0),
      carbs: m.reduce((s, x) => s + x.c, 0),
      fat: m.reduce((s, x) => s + x.f, 0),
      volume: w.reduce((s, x) => s + setsVolume(x.sets), 0),
      workoutCount: w.length,
      cardioCount: c.length,
    };
  }, [meals, cardio, workouts, range]);

  const net = stats.kcalIn - stats.kcalOut;
  const prs = useMemo(() => personalRecords(workouts), [workouts]);

  // Day/Week → 7-day window, Month → 30-day window (§6).
  const chartDays = range === "month" ? 30 : 7;
  const active = TREND_METRICS.find((m) => m.id === metric)!;
  const activeUnit = metric === "weight" ? weightUnitLabel(unit) : active.unit;
  const series = useMemo(
    () =>
      buildTrendSeries(metric, chartDays, {
        weighIns,
        meals,
        cardio,
        fallbackWeight: profile.weightKg,
      }),
    [metric, chartDays, weighIns, meals, cardio, profile.weightKg],
  );
  // Weight is the only series stored in kg — convert to the display unit
  // for both the headline numbers and the chart itself.
  const displaySeries = useMemo(
    () => (metric === "weight" ? series.map((p) => ({ ...p, v: kgToDisplay(p.v, unit) })) : series),
    [series, metric, unit],
  );
  const muscleGroups = useMemo(() => setsPerMuscleGroup(workouts), [workouts]);
  const maxGroupSets = Math.max(1, ...muscleGroups.map((g) => g.sets));

  if (showExercise) {
    return <ExerciseProgress profile={profile} onBack={() => setShowExercise(false)} />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Card>
        <CalorieBar eaten={stats.kcalIn} burned={stats.kcalOut} goal={goal} />
        <div style={{ height: 16 }} />
        <ProteinBar value={Math.round(stats.protein)} goal={pTarget} />
        <div style={{ textAlign: "center", marginTop: 10, fontSize: 12, color: C.dim }}>
          {modeLabel[profile.mode]} · net {net} kcal
        </div>
      </Card>

      {/* Trend line chart — the centrepiece (§6). */}
      <Card>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h3 style={{ margin: 0, fontSize: 15 }}>{active.label} trend</h3>
          <div style={{ display: "flex", gap: 3, background: C.surface2, borderRadius: 7, padding: 2 }}>
            {(["day", "week", "month"] as RangeKey[]).map((r) => {
              const on = range === r;
              return (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  aria-pressed={on}
                  style={{
                    padding: "3px 8px",
                    borderRadius: 5,
                    fontSize: 10,
                    fontWeight: 600,
                    textTransform: "capitalize",
                    cursor: "pointer",
                    border: "none",
                    background: on ? C.line : "transparent",
                    color: on ? C.text : C.dim,
                  }}
                >
                  {r}
                </button>
              );
            })}
          </div>
        </div>
        <span style={{ fontSize: 11, color: C.dim }}>last {chartDays} days</span>
        {displaySeries.length > 0 ? (
          <>
            <div style={{ display: "flex", gap: 16, marginTop: 4, alignItems: "baseline" }}>
              <span>
                <span style={{ fontSize: 22, fontWeight: 700, color: active.color }}>
                  {displaySeries.at(-1)!.v}
                </span>
                <span style={{ fontSize: 12, color: C.dim }}> {activeUnit} latest</span>
              </span>
              <span style={{ fontSize: 12, color: C.dim }}>
                avg {average(displaySeries)} {activeUnit}
              </span>
            </div>
            <LineChart points={displaySeries} color={active.color} />
          </>
        ) : (
          <p style={{ fontSize: 13, color: C.dim, marginTop: 10 }}>
            No {active.label.toLowerCase()} data in this window yet — start logging and it'll fill in.
          </p>
        )}

        <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
          {TREND_METRICS.map((m) => {
            const on = metric === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setMetric(m.id)}
                aria-pressed={on}
                style={{
                  flex: 1,
                  padding: "8px 0",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  border: `1px solid ${on ? m.color : C.line}`,
                  background: on ? m.color : C.surface2,
                  color: on ? C.onAccent : C.text,
                }}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </Card>

      <Btn
        kind="ghost"
        onClick={() => setShowExercise(true)}
        style={{ width: "100%", padding: "12px 0" }}
      >
        <LineChartIcon size={16} /> Check exercise progress
      </Btn>

      <div style={{ display: "flex", gap: 12 }}>
        <Card style={{ flex: 1, textAlign: "center" }}>
          <Droplet size={18} color={C.cardio} />
          <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>
            {todayMisc.waterGlasses}
          </div>
          <span style={{ fontSize: 11, color: C.dim }}>glasses water</span>
        </Card>
        <Card style={{ flex: 1, textAlign: "center" }}>
          <Footprints size={18} color={C.accent} />
          <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>
            {todayMisc.steps.toLocaleString()}
          </div>
          <span style={{ fontSize: 11, color: C.dim }}>steps</span>
        </Card>
      </div>

      <Card>
        <Row label="Lift volume" val={`${Math.round(kgToDisplay(stats.volume, unit)).toLocaleString()} ${weightUnitLabel(unit)}`} />
        <Row label="Carbs / Fat" val={`${Math.round(stats.carbs)}g · ${Math.round(stats.fat)}g`} />
        <Row label="Workouts logged" val={stats.workoutCount} />
        <Row label="Cardio sessions" val={stats.cardioCount} last />
      </Card>

      {muscleGroups.length > 0 && (
        <Card>
          <h3 style={{ margin: "0 0 10px", fontSize: 15 }}>Muscle groups this week</h3>
          {muscleGroups.map(({ group, sets }) => (
            <div key={group} style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                <span style={{ color: C.text }}>{group}</span>
                <span style={{ color: C.dim }}>{sets} set{sets === 1 ? "" : "s"}</span>
              </div>
              <div style={{ height: 6, background: C.surface2, borderRadius: 3, overflow: "hidden" }}>
                <div
                  style={{
                    width: `${(sets / maxGroupSets) * 100}%`,
                    height: "100%",
                    background: C.body,
                    borderRadius: 3,
                  }}
                />
              </div>
            </div>
          ))}
        </Card>
      )}

      {prs.length > 0 && (
        <Card>
          <h3
            style={{
              margin: "0 0 8px",
              fontSize: 15,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Trophy size={16} color={C.accent} /> Personal records
          </h3>
          {prs.map((pr, i) => (
            <Row
              key={pr.exercise}
              label={pr.exercise}
              val={`${kgToDisplay(pr.estimated1RM, unit)} ${weightUnitLabel(unit)} est. 1RM`}
              last={i === prs.length - 1}
            />
          ))}
        </Card>
      )}
    </div>
  );
}
