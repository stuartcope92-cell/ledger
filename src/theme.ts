// ── Design tokens ──────────────────────────────────────────────
// Dark, high-contrast, one bold accent. Pulled from the prototype / BUILD_SPEC §3.
export const C = {
  bg: "#0F1115",
  surface: "#171A21",
  surface2: "#1F232C",
  line: "#2A2F3A",
  text: "#EAECEF",
  dim: "#8A909C",
  accent: "#C6F135", // lime — primary actions, calories
  accentDim: "#8FA82A",
  cardio: "#5AC8FA", // sky — cardio / burn
  body: "#B48BF2", // violet — bodyweight
  protein: "#FF9F45", // amber — protein
  warn: "#F0698A", // over-target / destructive
  onAccent: "#0B0D10", // text on top of a filled accent button
} as const;
