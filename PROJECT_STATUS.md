# Ledger — project status

A living handoff doc for resuming work in a fresh session. `BUILD_SPEC.md` is the
original architecture spec but is now **out of date** in one important way (see
"Known doc drift" below) — read this file first for current reality, then
`BUILD_SPEC.md` for the original feature-by-feature design.

## What Ledger is now

A gym/nutrition tracker, originally designed local-only ("no accounts, no
server"), now migrated to **required accounts** (email/password via Supabase)
with all data in per-user Supabase Postgres + Storage. Deployed as three
pieces:

- **Frontend** — Vite/React/TS, deployed on Vercel: `https://ledger-lovat-eight.vercel.app`
- **`ledger-api`** — a small Express proxy for food data (Open Food Facts +
  Gemini photo recognition), its own Vercel project: `https://ledgerapi.vercel.app`
- **Supabase project** — Postgres (schema in `supabase/schema.sql`) + Storage
  (`progress-photos` bucket) + Auth. Project ref `fohfqyjgizbiymqczuob`.

## Recently completed (most recent first)

1. **Milk search + photo-scan multi-item bugfixes** — OFF's free-text search
   is genuinely unreliable for "milk" (confirmed directly against their API:
   even a wide result pool ranks branded/flavoured products above plain
   milk, and larger page sizes started tripping OFF's own "temporarily
   unavailable" page). Added milk (whole/semi-skimmed/skimmed) to
   `ledger-api`'s curated staples list — the safety net already used for
   chicken, rice, etc. Separately, the Food tab's photo-scan was clearing
   *all* detected candidates after saving just one (e.g. a cereal+milk
   photo would lose "milk" the moment "cereal" was saved) — `saveScaled()`
   now removes only the saved candidate. Pushed as `102171c`; the
   ledger-api half needs its Vercel deploy to pick up (auto-deploys on
   push if the GitHub integration is connected — worth a dashboard check).
2. **Programmed lift goals** — optional per-exercise auto-progression overlay
   on top of plain logging. Set a strength goal (compound: target weight ×
   reps; assisted: an assist-level ladder down to 0) from Progress → Check
   exercise progress; the Lift tab add-flow then shows that week's prescribed
   sets/reps/weight with a one-tap "Use prescribed sets" fill. Logging a
   workout for a programmed exercise auto-advances its progression state —
   no separate "did you hit it?" step. Includes goal-aware progression speed
   (bigger jumps the further from goal), a deload after 2 consecutive missed
   sessions, and an index-based assist ladder (not fragile exact-weight
   matching). New `programmed_lifts` Supabase table (migration already run
   live). Core algorithm in `src/progression.ts`, verified with a standalone
   simulation before wiring into the UI.
3. **Target-weight goal auto-picks calorie mode** — optional target weight on
   the You tab (`profile.targetWeightKg`) auto-derives deficit/maintain/
   surplus by comparing target vs current weight (±0.5kg counts as
   maintain), overriding the manual toggle while a goal is active; clearing
   it reverts to manual. `effectiveMode()` in `src/formulas.ts`. New
   `target_weight_kg` column on `profiles` (migration already run live).
4. **Tightened `ledger-api` CORS** — `ALLOWED_ORIGIN` set in Vercel's
   production env vars to `https://ledger-lovat-eight.vercel.app` (was `*`).
5. **Accounts Phase 2** — migrated every entity (profile, workouts, cardio,
   meals, weigh-ins, daily misc, routines, measurements, progress photos) off
   local IndexedDB (Dexie) onto per-user Supabase Postgres + Storage, protected
   by Row-Level Security. `src/db.ts` deleted; `src/store.ts` rewritten
   wholesale against Supabase + `@tanstack/react-query` (replaces Dexie's
   `useLiveQuery` reactivity — every mutation invalidates the relevant query
   key so all mounted hooks refetch together). **Pushed to `origin/main`
   (`b86e21b`)**. Verified on mobile: account creation works, all tabs render
   correctly.
6. **Accounts Phase 1** — Supabase email/password auth gate (`src/screens/Login.tsx`,
   `src/utils/useSession.ts`, `src/services/supabase.ts`). Google/Apple OAuth
   was originally planned but dropped (Apple Developer Program's $99/yr
   wasn't worth it at this stage) — email/password only. Pushed and live.
7. **Food API fixes** — `ledger-api` deployed as its own Vercel project;
   fixed a broken `VITE_API_URL` (was hardcoded to `localhost:3001` in a
   committed `.env`); added Gemini as a free-tier photo-recognition provider
   (LogMeal/Foodvisor are paid-only) — model pinned to the self-updating
   `gemini-flash-latest` alias after `gemini-2.5-flash` got deprecated
   mid-build; fixed meal photos not compressing before upload (Vercel's
   serverless functions reject bodies over 4.5MB, real phone photos often
   exceed that).
8. **Mobile UX fixes** — hardware/gesture back button now closes the current
   view instead of exiting the app (`src/utils/useBackClose.ts`, a shared
   history-stack hook wired into every stacked screen); fixed the Lift tab
   showing a redundant exercise picker + a non-functional-looking plate
   calculator when logging from an active routine session (now hides the
   picker and prefills sets from exercise history); bumped the service
   worker's cache version to stop installed PWAs running stale JS.
9. **"Fits the philosophy" batch** — Metric/Imperial unit toggle, muscle-group
   tags + weekly volume breakdown, set types (warm-up/working/drop/failure) +
   RPE, plate calculator + warm-up ladder, body measurements (waist/chest/
   arms/hips).
10. **"Quick wins" batch** (earlier) — Recent-foods shelf, edit-in-place for
   meals/workouts/cardio, CSV export, installable PWA.

## Key decisions (full detail in Claude's memory — see files linked)

- **Required accounts, Supabase, email/password only** (no OAuth) —
  `decision_accounts_at_launch.md`. Both phases now shipped; memory file has
  the full "why" and a list of real schema bugs hit during Phase 2
  verification (missing GRANTs, missing `profiles.user_id` default, `routines`
  needing a composite primary key) in case the schema is ever recreated.
- **Progress photo privacy: standard tier, not full E2E encryption** —
  `decision_progress_photo_privacy_tier.md`. Encrypted-at-rest + per-user
  access control (which is what Phase 2's Storage bucket + RLS policy now
  implements), not client-side encryption. Legal/privacy-policy review is
  still explicitly called out as a separate open item, independent of this
  technical choice.

## Known doc drift

`BUILD_SPEC.md` §1 previously stated "One user, on-device. No login, no
server-side accounts" as a core principle — the opposite of what's built.
**Fixed**: added a doc-drift note at the top plus inline strikethrough/
supersede callouts at §1 and the Definition of Done, pointing back to this
file for current architecture.

## Next steps (in rough priority order)

1. **Confirm the `ledgerapi` Vercel deploy picked up `102171c`** (the milk
   staples fix) — check the dashboard for a build triggered by that commit;
   if nothing built, the GitHub integration may need reconnecting.
2. **Privacy policy / legal review** before any public launch — not something
   Claude can do; a real lawful-basis/consent/data-rights review.
3. Optional: check whether the original competitive review had a third
   bucket beyond "quick wins" and "fits the philosophy" worth returning to.

**Decided against**: Google/Apple OAuth. Email/password via Supabase is the
permanent auth method, not a stopgap — not revisiting this.

## Where things live

- `supabase/schema.sql` — full current schema + RLS + Storage policy, safe to
  re-run on a fresh project (already reflects all the bug fixes from Phase 2
  verification).
- `.env.local` (gitignored) — local dev Supabase credentials, already set.
- `ledger-api/.env.example` — documents all `ledger-api` env vars including
  `GEMINI_API_KEY`/`GEMINI_MODEL`.
