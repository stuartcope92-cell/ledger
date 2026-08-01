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

1. **Tightened `ledger-api` CORS** — `ALLOWED_ORIGIN` set in Vercel's
   production env vars to `https://ledger-lovat-eight.vercel.app` (was `*`).
2. **Accounts Phase 2** — migrated every entity (profile, workouts, cardio,
   meals, weigh-ins, daily misc, routines, measurements, progress photos) off
   local IndexedDB (Dexie) onto per-user Supabase Postgres + Storage, protected
   by Row-Level Security. `src/db.ts` deleted; `src/store.ts` rewritten
   wholesale against Supabase + `@tanstack/react-query` (replaces Dexie's
   `useLiveQuery` reactivity — every mutation invalidates the relevant query
   key so all mounted hooks refetch together). **Pushed to `origin/main`
   (`b86e21b`)**. Verified on mobile: account creation works, all tabs render
   correctly.
3. **Accounts Phase 1** — Supabase email/password auth gate (`src/screens/Login.tsx`,
   `src/utils/useSession.ts`, `src/services/supabase.ts`). Google/Apple OAuth
   was originally planned but dropped (Apple Developer Program's $99/yr
   wasn't worth it at this stage) — email/password only. Pushed and live.
4. **Food API fixes** — `ledger-api` deployed as its own Vercel project;
   fixed a broken `VITE_API_URL` (was hardcoded to `localhost:3001` in a
   committed `.env`); added Gemini as a free-tier photo-recognition provider
   (LogMeal/Foodvisor are paid-only) — model pinned to the self-updating
   `gemini-flash-latest` alias after `gemini-2.5-flash` got deprecated
   mid-build; fixed meal photos not compressing before upload (Vercel's
   serverless functions reject bodies over 4.5MB, real phone photos often
   exceed that).
5. **Mobile UX fixes** — hardware/gesture back button now closes the current
   view instead of exiting the app (`src/utils/useBackClose.ts`, a shared
   history-stack hook wired into every stacked screen); fixed the Lift tab
   showing a redundant exercise picker + a non-functional-looking plate
   calculator when logging from an active routine session (now hides the
   picker and prefills sets from exercise history); bumped the service
   worker's cache version to stop installed PWAs running stale JS.
6. **"Fits the philosophy" batch** — Metric/Imperial unit toggle, muscle-group
   tags + weekly volume breakdown, set types (warm-up/working/drop/failure) +
   RPE, plate calculator + warm-up ladder, body measurements (waist/chest/
   arms/hips).
7. **"Quick wins" batch** (earlier) — Recent-foods shelf, edit-in-place for
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

1. **Privacy policy / legal review** before any public launch — not something
   Claude can do; a real lawful-basis/consent/data-rights review.
2. Optional: check whether the original competitive review had a third
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
