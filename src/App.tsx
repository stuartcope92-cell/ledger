// ── App shell: header, tabs, protein sidebar, bottom nav ───────
import { useMemo, useState } from "react";
import {
  Dumbbell,
  Heart,
  TrendingUp,
  User,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import { C } from "./theme";
import { proteinTarget, targetCalories, tdee } from "./formulas";
import { inRange } from "./utils/date";
import {
  useCardio,
  useDailyMisc,
  useMeals,
  useProfile,
  useWeighIns,
  useWorkouts,
} from "./store";
import { ProteinSidebar } from "./components/ProteinSidebar";
import { Progress } from "./screens/Progress";
import { Lift } from "./screens/Lift";
import { Cardio } from "./screens/Cardio";
import { Food } from "./screens/Food";
import { Profile } from "./screens/Profile";

type TabId = "home" | "lift" | "cardio" | "food" | "profile";

const NAV: { id: TabId; icon: LucideIcon; label: string }[] = [
  { id: "home", icon: TrendingUp, label: "Progress" },
  { id: "lift", icon: Dumbbell, label: "Lift" },
  { id: "cardio", icon: Heart, label: "Cardio" },
  { id: "food", icon: Utensils, label: "Food" },
  { id: "profile", icon: User, label: "You" },
];

export default function App() {
  const [tab, setTab] = useState<TabId>("home");
  const [profile, updateProfile] = useProfile();

  const workouts = useWorkouts();
  const cardio = useCardio();
  const meals = useMeals();
  const weighIns = useWeighIns();
  const todayMisc = useDailyMisc();

  const maintenance = tdee(profile);
  const goal = targetCalories(maintenance, profile.mode);
  const pTarget = proteinTarget(profile.weightKg);

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

      <ProteinSidebar value={Math.round(todayStats.protein)} target={pTarget} />

      <main style={{ padding: "8px 44px 8px 18px" }}>
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
        {tab === "lift" && <Lift />}
        {tab === "cardio" && <Cardio profile={profile} />}
        {tab === "food" && <Food goal={goal} pTarget={pTarget} today={todayStats} />}
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
