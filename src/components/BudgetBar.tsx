// ── Calorie & protein budget bars (Progress tab hero) ──────────
// Calories: track = daily target. Eaten fills it from the left; burned
// carves a same-width notch out of the tail of that fill (cardio colour),
// so exercise visibly "gives back" room rather than just adjusting a number.
// Going over target (even after burned calories are subtracted) turns the
// fill red and switches the caption to "X over".
import { C } from "../theme";

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

export function CalorieBar({
  eaten,
  burned,
  goal,
}: {
  eaten: number;
  burned: number;
  goal: number;
}) {
  const eatenPct = goal > 0 ? clamp01(eaten / goal) : 0;
  const burnedPct = Math.min(eatenPct, goal > 0 ? clamp01(burned / goal) : 0);
  const netPct = Math.max(0, eatenPct - burnedPct);
  const net = eaten - burned;
  const over = net > goal;
  const remaining = Math.abs(goal - net);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Calories</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: over ? C.warn : C.accent }}>
          {remaining} {over ? "over" : "left"}
        </span>
      </div>
      <div
        role="img"
        aria-label={`${eaten} calories eaten, ${burned} burned, ${goal} target`}
        style={{
          position: "relative",
          height: 16,
          borderRadius: 8,
          background: C.surface2,
          overflow: "hidden",
        }}
      >
        {/* Both segments are flush rectangles — the track's own overflow:
            hidden + border-radius rounds the outer ends, so the seam between
            eaten and burned stays a single clean edge instead of two
            independently-rounded pills butting against each other. */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: `${netPct * 100}%`,
            background: over ? C.warn : C.accent,
            transition: "width .4s ease",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: `${netPct * 100}%`,
            top: 0,
            bottom: 0,
            width: `${burnedPct * 100}%`,
            background: C.cardio,
            opacity: 0.6,
            transition: "width .4s ease, left .4s ease",
          }}
        />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11, color: C.dim }}>
        <span>
          <span style={{ color: C.accent }}>●</span> Eaten {eaten}
        </span>
        <span>
          <span style={{ color: C.cardio }}>●</span> Burned {burned}
        </span>
        <span>Target {goal}</span>
      </div>
    </div>
  );
}

export function ProteinBar({ value, goal }: { value: number; goal: number }) {
  const pct = goal > 0 ? clamp01(value / goal) : 0;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Protein</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: C.protein }}>
          {value}g / {goal}g
        </span>
      </div>
      <div
        role="img"
        aria-label={`${value} of ${goal} grams protein`}
        style={{ height: 16, borderRadius: 8, background: C.surface2, overflow: "hidden" }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct * 100}%`,
            background: C.protein,
            borderRadius: 8,
            transition: "width .4s ease",
          }}
        />
      </div>
    </div>
  );
}
