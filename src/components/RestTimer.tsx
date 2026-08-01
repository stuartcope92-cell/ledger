// ── Rest timer (inside the Lift add flow) ──────────────────────
import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, Timer } from "lucide-react";
import { C } from "../theme";
import { Card, inp } from "./ui";

export function RestTimer({
  presets = [60, 90, 120],
  defaultSecs,
}: {
  presets?: number[];
  defaultSecs?: number;
} = {}) {
  const initial = defaultSecs ?? presets[Math.floor(presets.length / 2)] ?? 90;
  const [secs, setSecs] = useState(initial); // selected preset
  const [left, setLeft] = useState(initial); // seconds remaining
  const [running, setRunning] = useState(false);
  const ref = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (running && left > 0) {
      ref.current = setTimeout(() => setLeft((l) => l - 1), 1000);
    }
    if (left === 0) setRunning(false);
    return () => {
      if (ref.current) clearTimeout(ref.current);
    };
  }, [running, left]);

  const mm = String(Math.floor(left / 60));
  const ss = String(left % 60).padStart(2, "0");

  const pick = (s: number) => {
    setSecs(s);
    setLeft(s);
    setRunning(false);
  };

  return (
    <Card style={{ marginBottom: 12 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Timer size={18} color={C.accent} />
          <span
            aria-live="polite"
            style={{
              fontSize: 26,
              fontWeight: 700,
              fontVariantNumeric: "tabular-nums",
              color: left === 0 ? C.warn : C.text,
            }}
          >
            {mm}:{ss}
          </span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {presets.map((s) => (
            <button
              key={s}
              onClick={() => pick(s)}
              aria-pressed={secs === s}
              style={{
                ...inp,
                width: "auto",
                padding: "4px 8px",
                cursor: "pointer",
                color: secs === s ? C.accent : C.dim,
              }}
            >
              {s}s
            </button>
          ))}
          <button
            onClick={() => setRunning((r) => !r)}
            aria-label={running ? "Pause timer" : "Start timer"}
            style={{ ...inp, width: "auto", padding: 6, cursor: "pointer" }}
          >
            {running ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <button
            onClick={() => {
              setLeft(secs);
              setRunning(false);
            }}
            aria-label="Reset timer"
            style={{ ...inp, width: "auto", padding: 6, cursor: "pointer" }}
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>
    </Card>
  );
}
