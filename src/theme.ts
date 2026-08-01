// ── Design tokens ──────────────────────────────────────────────
// Values are CSS custom properties (defined in index.css, light override
// under [data-theme="light"]) rather than literal hex, so every consumer of
// `C` stays theme-reactive without threading a hook through every screen —
// see useTheme() below for the toggle itself.
export const C = {
  bg: "var(--bg)",
  surface: "var(--surface)",
  surface2: "var(--surface2)",
  line: "var(--line)",
  text: "var(--text)",
  dim: "var(--dim)",
  accent: "var(--accent)", // lime — primary actions, calories
  accentDim: "var(--accent-dim)",
  cardio: "var(--cardio)", // sky — cardio / burn
  body: "var(--body)", // violet — bodyweight
  protein: "var(--protein)", // amber — protein
  warn: "var(--warn)", // over-target / destructive
  onAccent: "var(--on-accent)", // text on top of a filled accent button
} as const;

export type ThemeMode = "dark" | "light";
const STORAGE_KEY = "ledger-theme";

// Device display preference — not user data, so this stays in localStorage
// rather than syncing through the profile like unitSystem does.
export function getStoredTheme(): ThemeMode | null {
  const v = localStorage.getItem(STORAGE_KEY);
  return v === "light" || v === "dark" ? v : null;
}

export function applyTheme(mode: ThemeMode): void {
  document.documentElement.setAttribute("data-theme", mode);
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    "content",
    mode === "light" ? "#F5F5F3" : "#0F1115",
  );
  localStorage.setItem(STORAGE_KEY, mode);
}
