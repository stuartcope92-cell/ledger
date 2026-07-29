// ── Reusable UI primitives ─────────────────────────────────────
import type {
  CSSProperties,
  InputHTMLAttributes,
  ReactNode,
} from "react";
import { ChevronLeft, type LucideIcon } from "lucide-react";
import { C } from "../theme";

export const Card = ({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) => (
  <div
    style={{
      background: C.surface,
      border: `1px solid ${C.line}`,
      borderRadius: 16,
      padding: 16,
      ...style,
    }}
  >
    {children}
  </div>
);

type FieldProps = InputHTMLAttributes<HTMLInputElement> & { label: string };
export const Field = ({ label, id, ...p }: FieldProps) => {
  const inputId = id ?? `f-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <label htmlFor={inputId} style={{ display: "block", marginBottom: 12 }}>
      <span
        style={{
          fontSize: 12,
          color: C.dim,
          display: "block",
          marginBottom: 6,
          letterSpacing: 0.3,
        }}
      >
        {label}
      </span>
      <input
        id={inputId}
        {...p}
        style={{
          width: "100%",
          boxSizing: "border-box",
          background: C.surface2,
          border: `1px solid ${C.line}`,
          borderRadius: 10,
          padding: "10px 12px",
          color: C.text,
          fontSize: 15,
          outline: "none",
        }}
      />
    </label>
  );
};

export const inp: CSSProperties = {
  background: C.surface2,
  border: `1px solid ${C.line}`,
  borderRadius: 8,
  padding: "8px 10px",
  color: C.text,
  fontSize: 14,
  width: "100%",
  boxSizing: "border-box",
  outline: "none",
};

type BtnKind = "primary" | "ghost";
export const Btn = ({
  children,
  onClick,
  kind = "primary",
  style,
  disabled,
  type = "button",
  ariaLabel,
}: {
  children: ReactNode;
  onClick?: () => void;
  kind?: BtnKind;
  style?: CSSProperties;
  disabled?: boolean;
  type?: "button" | "submit";
  ariaLabel?: string;
}) => {
  const kinds: Record<BtnKind, CSSProperties> = {
    primary: { background: C.accent, color: C.onAccent, border: "none" },
    ghost: { background: "transparent", color: C.text, border: `1px solid ${C.line}` },
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      style={{
        borderRadius: 10,
        padding: "10px 14px",
        fontSize: 14,
        fontWeight: 600,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.5 : 1,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        ...kinds[kind],
        ...style,
      }}
    >
      {children}
    </button>
  );
};

export const Row = ({
  label,
  val,
  last,
}: {
  label: ReactNode;
  val: ReactNode;
  last?: boolean;
}) => (
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      padding: "10px 0",
      borderBottom: last ? "none" : `1px solid ${C.line}`,
    }}
  >
    <span style={{ color: C.dim, fontSize: 14 }}>{label}</span>
    <span style={{ fontWeight: 600, fontSize: 14 }}>{val}</span>
  </div>
);

export const BackBar = ({
  onBack,
  title,
}: {
  onBack: () => void;
  title: string;
}) => (
  <div
    style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}
  >
    <button
      onClick={onBack}
      aria-label="Back"
      style={{
        background: C.surface2,
        border: `1px solid ${C.line}`,
        borderRadius: 8,
        padding: 6,
        color: C.text,
        cursor: "pointer",
        display: "flex",
      }}
    >
      <ChevronLeft size={18} />
    </button>
    <strong style={{ fontSize: 16 }}>{title}</strong>
  </div>
);

export const Empty = ({
  icon: Ic,
  msg,
}: {
  icon: LucideIcon;
  msg: string;
}) => (
  <div style={{ textAlign: "center", padding: "40px 20px", color: C.dim }}>
    <Ic size={32} style={{ opacity: 0.5 }} />
    <p style={{ fontSize: 14, marginTop: 10 }}>{msg}</p>
  </div>
);
