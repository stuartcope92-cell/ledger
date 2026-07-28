// ── Line chart (SVG): gridlines, gradient fill, capped x-labels ─
import { useId } from "react";
import { C } from "../theme";
import type { Point } from "../utils/series";

// viewBox geometry (scales uniformly to container width).
const W = 320;
const H = 168;
const PAD = { left: 34, right: 8, top: 12, bottom: 22 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;
const GRID_LINES = 4;
const MAX_X_LABELS = 6;

// "Nice" upper bound so y-axis labels are round-ish.
function niceMax(max: number): number {
  if (max <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(max)));
  const n = max / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

export function LineChart({
  points,
  color,
  yLabel,
}: {
  points: Point[];
  color: string;
  yLabel?: (v: number) => string;
}) {
  const gradId = useId();
  const fmtY = yLabel ?? ((v: number) => `${v}`);

  const values = points.map((p) => p.v);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);

  // For weight-like series that never touch zero, floor a little below the
  // minimum so movement is visible; otherwise anchor the baseline at zero.
  const spread = rawMax - rawMin;
  const anchorZero = rawMin >= 0 && rawMin <= spread * 1.5;
  const yMin = anchorZero ? 0 : Math.floor(rawMin - spread * 0.25);
  const yMax = anchorZero ? niceMax(rawMax) : Math.ceil(rawMax + spread * 0.25);
  const range = yMax - yMin || 1;

  const xAt = (i: number) =>
    PAD.left + (points.length <= 1 ? PLOT_W / 2 : (i / (points.length - 1)) * PLOT_W);
  const yAt = (v: number) => PAD.top + (1 - (v - yMin) / range) * PLOT_H;

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(1)} ${yAt(p.v).toFixed(1)}`)
    .join(" ");
  const areaPath =
    points.length > 1
      ? `${linePath} L ${xAt(points.length - 1).toFixed(1)} ${(PAD.top + PLOT_H).toFixed(1)} ` +
        `L ${xAt(0).toFixed(1)} ${(PAD.top + PLOT_H).toFixed(1)} Z`
      : "";

  const gridVals = Array.from(
    { length: GRID_LINES + 1 },
    (_, i) => yMin + (range * i) / GRID_LINES,
  );
  const xLabelStep = Math.max(1, Math.ceil(points.length / MAX_X_LABELS));

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", height: "auto", display: "block", marginTop: 8 }}
      role="img"
      aria-label="Trend chart"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.35} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>

      {/* Gridlines + y-axis labels */}
      {gridVals.map((v, i) => {
        const y = yAt(v);
        return (
          <g key={i}>
            <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke={C.line} strokeWidth={1} />
            <text x={PAD.left - 6} y={y + 3} textAnchor="end" fill={C.dim} fontSize={9}>
              {fmtY(Math.round(v))}
            </text>
          </g>
        );
      })}

      {/* Filled area under the line */}
      {areaPath && <path d={areaPath} fill={`url(#${gradId})`} stroke="none" />}

      {/* The line */}
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Endpoint marker */}
      {points.length > 0 && (
        <circle cx={xAt(points.length - 1)} cy={yAt(points.at(-1)!.v)} r={3.5} fill={color} />
      )}

      {/* X-axis labels (capped) */}
      {points.map((p, i) =>
        i % xLabelStep === 0 || i === points.length - 1 ? (
          <text
            key={i}
            x={xAt(i)}
            y={H - 6}
            textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}
            fill={C.dim}
            fontSize={9}
          >
            {p.x}
          </text>
        ) : null,
      )}
    </svg>
  );
}
