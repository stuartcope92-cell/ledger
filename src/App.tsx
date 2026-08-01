// ── App shell: header, tabs, bottom nav ─────────────────────────
import { useEffect, useMemo, useState } from "react";
import {
  Dumbbell,
  Heart,
  Images,
  TrendingUp,
  User,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import { C } from "./theme";
import { queryClient } from "./queryClient";
import { effectiveMode, effectiveProteinTarget, targetCalories, tdee } from "./formulas";
import { inRange } from "./utils/date";
import { useBackClose } from "./utils/useBackClose";
import { useSession } from "./utils/useSession";
import {
  ensureDefaultRoutines,
  useCardio,
  useDailyMisc,
  useMeals,
  useProfile,
  useWeighIns,
  useWorkouts,
} from "./store";
import { Progress } from "./screens/Progress";
import { Lift } from "./screens/Lift";
import { Cardio } from "./screens/Cardio";
import { Food } from "./screens/Food";
import { Photos } from "./screens/Photos";
import { Profile } from "./screens/Profile";
import { Login } from "./screens/Login";

type TabId = "home" | "lift" | "cardio" | "food" | "photos" | "profile";
const TAB_IDS: TabId[] = ["home", "lift", "cardio", "food", "photos", "profile"];

const NAV: { id: TabId; icon: LucideIcon; label: string }[] = [
  { id: "home", icon: TrendingUp, label: "Progress" },
  { id: "lift", icon: Dumbbell, label: "Lift" },
  { id: "cardio", icon: Heart, label: "Cardio" },
  { id: "food", icon: Utensils, label: "Food" },
  { id: "photos", icon: Images, label: "Photos" },
  { id: "profile", icon: User, label: "You" },
];

// PWA shortcut deep-links (manifest.webmanifest `shortcuts`) land on
// "./?tab=lift" etc. Pure on purpose — StrictMode double-invokes useState
// lazy initializers in dev, and a side effect here (e.g. scrubbing the URL)
// would make the second call read state the first call already mutated.
function initialTab(): TabId {
  const requested = new URLSearchParams(window.location.search).get("tab");
  return requested && (TAB_IDS as string[]).includes(requested) ? (requested as TabId) : "home";
}

export default function App() {
  const [tab, setTab] = useState<TabId>(initialTab);

  // Scrub ?tab= after the state above has already captured it, so a later
  // refresh doesn't keep forcing the same tab. A separate effect (not the
  // initializer itself) so it's safe to double-fire under StrictMode.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("tab")) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);
  const [profile, updateProfile] = useProfile();
  const { session, loading: sessionLoading } = useSession();

  // A mobile back gesture from any non-home tab returns to the dashboard
  // (home) instead of exiting the app — only backing out from home itself
  // falls through to the native minimize/exit behavior.
  useBackClose(tab !== "home", () => setTab("home"));

  // Every data hook below fires unconditionally (before the auth gate
  // further down), so a session transition needs an explicit cache reset —
  // React Query has no reason to refetch on its own just because `session`
  // changed elsewhere. Sign-in: drop any pre-login (unauthenticated, empty/
  // errored) cache and seed default routines for a first-time account.
  // Sign-out: wipe the cache entirely so a second account signing in on the
  // same device never briefly sees the previous one's cached data.
  useEffect(() => {
    if (session) {
      queryClient.invalidateQueries();
      void ensureDefaultRoutines();
    } else {
      queryClient.clear();
    }
  }, [session?.user.id]);

  const workouts = useWorkouts();
  const cardio = useCardio();
  const meals = useMeals();
  const weighIns = useWeighIns();
  const todayMisc = useDailyMisc();

  const maintenance = tdee(profile);
  const goal = targetCalories(maintenance, effectiveMode(profile));
  const pTarget = effectiveProteinTarget(profile);

  // Today's totals — drive the Food remaining figure and the protein gauge.
  const todayStats = useMemo(() => {
    const m = inRange(meals, "day");
    const c = inRange(cardio, "day");
    return {
      kcalIn: m.reduce((s, x) => s + x.cal, 0),
      kcalOut: c.reduce((s, x) => s + x.cal, 0),
      protein: m.reduce((s, x) => s + x.p, 0),
      carbs: m.reduce((s, x) => s + x.c, 0),
      fat: m.reduce((s, x) => s + x.f, 0),
    };
  }, [meals, cardio]);

  const today = new Date().toLocaleDateString(undefined, { weekday: "short" });

  if (sessionLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: C.bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: C.dim,
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        Loading…
      </div>
    );
  }
  if (!session) {
    return <Login />;
  }

  return (
    <div
      style={{
        maxWidth: 460,
        margin: "0 auto",
        background: C.bg,
        minHeight: "100vh",
        color: C.text,
        fontFamily: "system-ui, -apple-system, sans-serif",
        paddingBottom: 80,
        position: "relative",
      }}
    >
      <header
        style={{
          padding: "20px 18px 8px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <h1 style={{ margin: 0, fontSize: 22, letterSpacing: -0.5 }}>
          <span style={{ color: C.accent }}>▚</span> Ledger
        </h1>
        <span style={{ fontSize: 13, color: C.dim }}>{today}</span>
      </header>

      <main style={{ padding: "8px 18px" }}>
        {tab === "home" && (
          <Progress
            profile={profile}
            workouts={workouts}
            cardio={cardio}
            meals={meals}
            weighIns={weighIns}
            todayMisc={todayMisc}
            goal={goal}
            pTarget={pTarget}
          />
        )}
        {tab === "lift" && <Lift profile={profile} />}
        {tab === "cardio" && <Cardio profile={profile} />}
        {tab === "food" && <Food goal={goal} pTarget={pTarget} today={todayStats} />}
        {tab === "photos" && <Photos profile={profile} />}
        {tab === "profile" && (
          <Profile
            profile={profile}
            update={updateProfile}
            maintenance={maintenance}
            goal={goal}
          />
        )}
      </main>

      <nav
        aria-label="Primary"
        style={{
          position: "fixed",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "100%",
          maxWidth: 460,
          boxSizing: "border-box",
          display: "flex",
          background: C.surface,
          borderTop: `1px solid ${C.line}`,
          padding: "8px 6px 12px",
        }}
      >
        {NAV.map((n) => {
          const Ic = n.icon;
          const on = tab === n.id;
          return (
            <button
              key={n.id}
              onClick={() => setTab(n.id)}
              aria-current={on ? "page" : undefined}
              aria-label={n.label}
              style={{
                flex: 1,
                background: "none",
                border: "none",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 3,
                color: on ? C.accent : C.dim,
              }}
            >
              <Ic size={22} strokeWidth={on ? 2.4 : 1.8} />
              <span style={{ fontSize: 10, fontWeight: on ? 700 : 500 }}>{n.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
