// ── Protein sidebar (fixed vertical gauge, visible on every tab) ─
import { C } from "../theme";

export const ProteinSidebar = ({
  value,
  target,
}: {
  value: number;
  target: number;
}) => {
  const pct = Math.min(1, target > 0 ? value / target : 0);
  return (
    <div
      role="img"
      aria-label={`Protein ${value} of ${target} grams`}
      style={{
        position: "fixed",
        right: "max(6px, calc(50% - 230px))",
        top: 90,
        bottom: 96,
        width: 34,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        zIndex: 5,
      }}
    >
      <span style={{ fontSize: 9, color: C.dim, marginBottom: 4 }}>PRO</span>
      <div
        style={{
          flex: 1,
          width: 12,
          background: C.surface2,
          border: `1px solid ${C.line}`,
          borderRadius: 8,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: `${pct * 100}%`,
            background: C.protein,
            transition: "height .5s",
            borderRadius: 8,
          }}
        />
      </div>
      <span
        style={{ fontSize: 10, color: C.protein, fontWeight: 700, marginTop: 6 }}
      >
        {value}
      </span>
      <span style={{ fontSize: 8, color: C.dim }}>/{target}g</span>
    </div>
  );
};
