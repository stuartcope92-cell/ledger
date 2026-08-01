# Ledger — competitive review

A fresh pass (the original, from the very first build session, wasn't
persisted anywhere retrievable — git only kept references to it by name in
commit messages). Benchmarked against Strong, Hevy, MyFitnessPal, Cronometer,
and Fitbod — the closest analogs to Lift and Food respectively. Every idea
below is filtered through `BUILD_SPEC.md` §1: fast to log (≤3 taps), honest
numbers, minimal surface, no social/feed/gamification.

Three buckets, same shape as before: things worth doing now, things worth
doing but bigger, and things deliberately **not** worth doing — that third
bucket didn't survive from the original review, so it's worth writing down
this time so it doesn't need re-litigating later.

## Bucket 1 — Quick wins (small effort, clear fit)

- **Undo after delete** — a brief "Meal deleted · Undo" toast instead of
  instant, silent removal. Every competitor has this; Ledger currently
  doesn't, and delete is one tap with no confirmation anywhere.
- **"Repeat yesterday" for meals** — one tap to re-log every meal from the
  previous day, not just individual items via the Recent shelf. MyFitnessPal
  and Cronometer both have this; it's the single biggest remaining gap
  against the "≤3 taps" rule for someone eating a similar diet day to day.
- **Haptic tick on set save** (`navigator.vibrate`, PWA-safe, no-op where
  unsupported) — small polish, matches the "generous tap targets, fast to
  log" feel the rest of the app already has.
- **PWA app-shortcuts** (`manifest.webmanifest` `shortcuts` array) — long-
  press the home-screen icon → "Log exercise" / "Add meal" jumps straight
  past the tab bar. Near-zero effort on top of the install work already
  shipped.

## Bucket 2 — Fits the philosophy (bigger, still aligned)

- **Supersets/circuits in Lift** — group consecutive exercises with a
  shared shorter rest timer. Real strength-training structure (not
  gamification), and the rest-timer/plate-calculator infrastructure already
  exists to build on.
- **Light theme** — every competitor defaults light or offers a toggle;
  Ledger is dark-only. Real effort (a token audit across every screen, not
  just a palette flip) but squarely "quality," not scope creep.
- **Apple Health / Google Fit import** (steps, weight — read-only, no
  write-back) — removes manual step entry for anyone who already has a
  phone tracking it, without adding any account/social surface.
- **Auto-flagged deload week** — the weekly volume card and the just-shipped
  programmed-lift goals already compute what's needed (sets/week, missed
  sessions); surfacing "this week's volume is well above your 4-week
  average" as a plain observation (not a push notification) fits "honest
  numbers, no nagging."
- **Saved meal templates** — explicit "save this as [name]" beyond the
  Recent shelf's implicit history, for a stack of go-to meals larger than 8.

## Bucket 3 — Considered, deliberately rejected

Worth keeping on record so these don't get re-proposed and re-debated later.

- **Social feed / friends / leaderboards** (Hevy, Strava) — directly
  contradicts "no social features, no feeds" in `BUILD_SPEC.md` §1's first
  sentence.
- **Streaks and guilt-based push notifications** (Duolingo-style "don't
  break your streak!") — a manipulative engagement pattern, at odds with
  "honest numbers... never present estimates as exact" and the app's whole
  quiet, private tone.
- **Ads or a subscription paywall** (MyFitnessPal's premium gate on barcode
  scanning) — Ledger has no monetization model and the accounts decision
  was already about privacy/control, not extraction.
- **AI auto-coaching / full workout-plan generation** (Fitbod) — the
  programmed-lift-goals feature shipped this session is the restrained
  version of this idea: formula-driven, inspectable, no black-box model.
  A full AI coach is a different, much bigger product.
- **Micronutrient tracking** (25+ vitamins/minerals, Cronometer) — conflicts
  with the app's own stated ±10% honesty framing; the UI cost (a much
  bigger Food tab) isn't worth it for a feature whose precision the app
  already says not to trust.
- **In-app sharing to social media** — private by design; nothing in the
  app should produce a shareable artifact.

## Suggested order, if any of this gets picked up

1. Undo-after-delete and "repeat yesterday" (bucket 1) — smallest, highest
   day-to-day value.
2. Supersets (bucket 2) — the most-requested-feeling gap against Strong/Hevy
   for anyone doing real programmed training, and pairs naturally with the
   programmed-lift-goals work already shipped.
3. Everything else — no urgency, pick up opportunistically.
