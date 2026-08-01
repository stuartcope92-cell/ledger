-- Ledger — Supabase schema (accounts Phase 2: per-user data).
-- Run once in Supabase → SQL Editor. Every table is scoped to auth.uid()
-- via RLS, so one account can never see another's rows even though the
-- client never threads a user id through by hand — user_id defaults to
-- auth.uid() at insert time (the app also sets it explicitly, belt-and-
-- braces, since it's the one column every RLS check hinges on).
--
-- ids are client-generated strings (see uid() in src/store.ts), not
-- Postgres uuids — kept as text to match, no id-generation change needed
-- app-side. date columns are native `date`; PostgREST serializes these as
-- "yyyy-mm-dd" strings, matching the ISO date strings used throughout.
--
-- Each table needs an explicit GRANT to `authenticated` in addition to its
-- RLS policy — RLS only filters which rows a role can see/touch once that
-- role already has the base table privilege; it doesn't grant it. Easy to
-- miss (the error surfaces at query time as "permission denied for table
-- x", not at CREATE TABLE time), so each grant sits right after its policy.

create table public.profiles (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  name text not null default '',
  age integer not null default 30,
  height_cm numeric not null default 178,
  weight_kg numeric not null default 78,
  sex text not null default 'male',
  activity text not null default 'Moderate',
  mode text not null default 'maintain',
  target_weight_kg numeric,
  protein_goal_g numeric,
  unit_system text
);
alter table public.profiles enable row level security;
create policy "own profile" on public.profiles for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.profiles to authenticated;

create table public.workouts (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  name text not null,
  sets jsonb not null,
  is_pr boolean
);
alter table public.workouts enable row level security;
create policy "own workouts" on public.workouts for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.workouts to authenticated;
create index workouts_user_date_idx on public.workouts (user_id, date);

-- One optional row per exercise the user has set a strength goal for —
-- addWorkout() in src/store.ts advances this automatically whenever a
-- Workout is logged for the same exercise_name, no separate logging step.
create table public.programmed_lifts (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  exercise_name text not null,
  type text not null,
  current_weight numeric not null,
  current_reps integer not null,
  rep_range_min integer not null,
  rep_range_max integer not null,
  sets integer not null,
  progression_phase text not null default 'rep',
  assist_levels jsonb,
  assist_level_index integer,
  consecutive_failures integer not null default 0,
  target_weight numeric not null,
  target_reps integer not null,
  target_1rm numeric not null,
  unique (user_id, exercise_name)
);
alter table public.programmed_lifts enable row level security;
create policy "own programmed lifts" on public.programmed_lifts for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.programmed_lifts to authenticated;

create table public.cardio_sessions (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  type text not null,
  duration numeric not null,
  pace numeric not null,
  incline numeric not null,
  cal numeric not null
);
alter table public.cardio_sessions enable row level security;
create policy "own cardio_sessions" on public.cardio_sessions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.cardio_sessions to authenticated;
create index cardio_sessions_user_date_idx on public.cardio_sessions (user_id, date);

create table public.meals (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  name text not null,
  cal numeric not null,
  p numeric not null,
  c numeric not null,
  f numeric not null,
  source text not null
);
alter table public.meals enable row level security;
create policy "own meals" on public.meals for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.meals to authenticated;
create index meals_user_date_idx on public.meals (user_id, date);

create table public.weigh_ins (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  weight_kg numeric not null
);
alter table public.weigh_ins enable row level security;
create policy "own weigh_ins" on public.weigh_ins for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.weigh_ins to authenticated;
create index weigh_ins_user_date_idx on public.weigh_ins (user_id, date);

create table public.daily_misc (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  water_glasses integer not null default 0,
  steps integer not null default 0,
  primary key (user_id, date)
);
alter table public.daily_misc enable row level security;
create policy "own daily_misc" on public.daily_misc for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.daily_misc to authenticated;

-- id is a composite key with user_id, not a standalone primary key — the
-- default-seeded routines use deterministic ids ("seed-push-day", etc.)
-- that are identical for every account, so a bare `id text primary key`
-- collides the moment a *second* user's seeding runs, even though RLS
-- would otherwise keep the two accounts' rows invisible to each other.
create table public.routines (
  id text not null,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  exercises jsonb not null,
  primary key (user_id, id)
);
alter table public.routines enable row level security;
create policy "own routines" on public.routines for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.routines to authenticated;

create table public.measurements (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  waist_cm numeric,
  chest_cm numeric,
  arms_cm numeric,
  hips_cm numeric
);
alter table public.measurements enable row level security;
create policy "own measurements" on public.measurements for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.measurements to authenticated;
create index measurements_user_date_idx on public.measurements (user_id, date);

-- Metadata only — the actual image bytes live in the "progress-photos"
-- Storage bucket (see the storage policy below), not in this table.
create table public.progress_photos (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  weight_kg numeric,
  note text,
  storage_path text not null
);
alter table public.progress_photos enable row level security;
create policy "own progress_photos" on public.progress_photos for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.progress_photos to authenticated;
create index progress_photos_user_date_idx on public.progress_photos (user_id, date);

-- ── Storage ──────────────────────────────────────────────────────────
-- Run this AFTER creating a private "progress-photos" bucket in the
-- Storage tab of the dashboard (Storage → New bucket → name it exactly
-- "progress-photos", leave "Public bucket" OFF). Paths are shaped
-- "{user_id}/{photo_id}.jpg" — this policy restricts each user to their
-- own folder.
create policy "own photo files" on storage.objects for all
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);
