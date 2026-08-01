// ── Undo-after-delete toast ──────────────────────────────────────
import { C } from "../theme";

export function UndoToast({ message, onUndo }: { message: string; onUndo: () => void }) {
  return (
    <div
      role="status"
      style={{
        position: "fixed",
        bottom: 78,
        left: "50%",
        transform: "translateX(-50%)",
        width: "calc(100% - 36px)",
        maxWidth: 424,
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        background: C.surface2,
        border: `1px solid ${C.line}`,
        borderRadius: 10,
        padding: "10px 14px",
        zIndex: 40,
      }}
    >
      <span style={{ fontSize: 13, color: C.text }}>{message}</span>
      <button
        onClick={onUndo}
        style={{
          background: "none",
          border: "none",
          color: C.accent,
          fontWeight: 700,
          fontSize: 13,
          cursor: "pointer",
          padding: "4px 2px",
        }}
      >
        Undo
      </button>
    </div>
  );
}
