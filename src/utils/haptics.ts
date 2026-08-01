// ── Haptic feedback ──────────────────────────────────────────────
// navigator.vibrate is undefined on iOS Safari entirely and requires no
// feature-detection dance beyond optional chaining — silently a no-op
// wherever it's unsupported.
export function hapticTick(): void {
  navigator.vibrate?.(15);
}
