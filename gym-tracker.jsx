import React, { useState, useMemo, useEffect, useRef } from "react";
import { Dumbbell, Heart, User, TrendingUp, Utensils, Plus, X, ChevronLeft, Camera, Check, Trash2, Timer, Play, Pause, RotateCcw, Trophy, Droplet, Footprints, Download, Layers, Award } from "lucide-react";

// ── Design tokens ──────────────────────────────────────────────
const C = {
  bg: "#0F1115", surface: "#171A21", surface2: "#1F232C", line: "#2A2F3A",
  text: "#EAECEF", dim: "#8A909C",
  accent: "#C6F135", accentDim: "#8FA82A",
  cardio: "#5AC8FA", body: "#B48BF2", protein: "#FF9F45", warn: "#F0698A",
};

// ── Seed data ──────────────────────────────────────────────────
const EXERCISE_LIBRARY = [
  "Bench Press", "Incline Bench Press", "Squat", "Deadlift", "Overhead Press",
  "Barbell Row", "Pull-Up", "Lat Pulldown", "Bicep Curl", "Tricep Extension",
  "Leg Press", "Leg Curl", "Leg Extension", "Calf Raise", "Lateral Raise",
  "Dumbbell Fly", "Romanian Deadlift", "Hip Thrust", "Face Pull", "Plank",
];

const TEMPLATES = {
  "Push Day": ["Bench Press", "Overhead Press", "Incline Bench Press", "Lateral Raise", "Tricep Extension"],
  "Pull Day": ["Deadlift", "Pull-Up", "Barbell Row", "Lat Pulldown", "Bicep Curl"],
  "Leg Day": ["Squat", "Romanian Deadlift", "Leg Press", "Leg Curl", "Calf Raise"],
};

const CARDIO_TYPES = ["Running", "Walking", "Cycling", "Rowing", "Elliptical", "Stair Climber", "Swimming"];
const MET = { Running: 9.8, Walking: 3.8, Cycling: 7.5, Rowing: 7.0, Elliptical: 5.0, "Stair Climber": 8.0, Swimming: 8.0 };

const ACTIVITY = {
  Sedentary: 1.2, Light: 1.375, Moderate: 1.55, Active: 1.725, "Very active": 1.9,
};

const FOOD_DB = {
  "chicken breast": { cal: 165, p: 31, c: 0, f: 3.6 },
  "white rice": { cal: 130, p: 2.7, c: 28, f: 0.3 },
  "banana": { cal: 105, p: 1.3, c: 27, f: 0.4 },
  "egg": { cal: 78, p: 6, c: 0.6, f: 5 },
  "oatmeal": { cal: 158, p: 6, c: 27, f: 3 },
  "salmon": { cal: 208, p: 20, c: 0, f: 13 },
  "greek yogurt": { cal: 100, p: 17, c: 6, f: 0.7 },
  "avocado": { cal: 240, p: 3, c: 12, f: 22 },
  "almonds": { cal: 164, p: 6, c: 6, f: 14 },
  "sweet potato": { cal: 112, p: 2, c: 26, f: 0.1 },
  "beef mince": { cal: 250, p: 26, c: 0, f: 15 },
  "protein shake": { cal: 120, p: 25, c: 3, f: 1.5 },
};

// ── Calorie / macro helpers ────────────────────────────────────
function cardioCalories({ type, duration, incline = 0, weightKg = 75 }) {
  const met = (MET[type] || 5) * (1 + incline * 0.03);
  return Math.round((met * 3.5 * weightKg) / 200 * duration);
}
function tdee({ weightKg, heightCm, age, sex, activity }) {
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === "male" ? 5 : -161);
  return Math.round(bmr * (ACTIVITY[activity] || 1.2));
}
function targetCalories(maintenance, mode) {
  if (mode === "deficit") return maintenance - 400;
  if (mode === "surplus") return maintenance + 350;
  return maintenance;
}
const proteinTarget = (weightKg) => Math.round(weightKg * 1.8);

// ── Reusable bits ──────────────────────────────────────────────
const Card = ({ children, style }) => (
  <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16, padding: 16, ...style }}>{children}</div>
);
const Field = ({ label, ...p }) => (
  <label style={{ display: "block", marginBottom: 12 }}>
    <span style={{ fontSize: 12, color: C.dim, display: "block", marginBottom: 6, letterSpacing: 0.3 }}>{label}</span>
    <input {...p} style={{ width: "100%", boxSizing: "border-box", background: C.surface2, border: `1px solid ${C.line}`, borderRadius: 10, padding: "10px 12px", color: C.text, fontSize: 15, outline: "none" }} />
  </label>
);
const Btn = ({ children, onClick, kind = "primary", style, disabled }) => {
  const kinds = {
    primary: { background: C.accent, color: "#0B0D10", border: "none" },
    ghost: { background: "transparent", color: C.text, border: `1px solid ${C.line}` },
  };
  return <button onClick={onClick} disabled={disabled} style={{ borderRadius: 10, padding: "10px 14px", fontSize: 14, fontWeight: 600, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, ...kinds[kind], ...style }}>{children}</button>;
};
const inp = { background: C.surface2, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 10px", color: C.text, fontSize: 14, width: "100%", boxSizing: "border-box", outline: "none" };

const Ring = ({ value, max, color, label, sub }) => {
  const pct = Math.min(1, value / max), r = 42, circ = 2 * Math.PI * r;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <svg width={110} height={110}>
        <circle cx={55} cy={55} r={r} fill="none" stroke={C.line} strokeWidth={9} />
        <circle cx={55} cy={55} r={r} fill="none" stroke={color} strokeWidth={9} strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)} transform="rotate(-90 55 55)" style={{ transition: "stroke-dashoffset .5s" }} />
        <text x={55} y={52} textAnchor="middle" fill={C.text} fontSize={19} fontWeight={700}>{value}</text>
        <text x={55} y={70} textAnchor="middle" fill={C.dim} fontSize={10}>{sub}</text>
      </svg>
      <span style={{ fontSize: 12, color: C.dim, marginTop: 4 }}>{label}</span>
    </div>
  );
};
const Bars = ({ data, color }) => {
  const max = Math.max(...data.map(d => d.v), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 90, marginTop: 8 }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div style={{ width: "100%", height: `${(d.v / max) * 70}px`, minHeight: 2, background: color, borderRadius: 4, opacity: d.v ? 1 : 0.25 }} />
          <span style={{ fontSize: 10, color: C.dim }}>{d.l}</span>
        </div>
      ))}
    </div>
  );
};

// ── Protein sidebar (fixed vertical gauge) ─────────────────────
const ProteinSidebar = ({ value, target }) => {
  const pct = Math.min(1, value / target);
  return (
    <div style={{ position: "fixed", right: "max(6px, calc(50% - 230px))", top: 90, bottom: 96, width: 34, display: "flex", flexDirection: "column", alignItems: "center", zIndex: 5 }}>
      <span style={{ fontSize: 9, color: C.dim, marginBottom: 4 }}>PRO</span>
      <div style={{ flex: 1, width: 12, background: C.surface2, border: `1px solid ${C.line}`, borderRadius: 8, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: `${pct * 100}%`, background: C.protein, transition: "height .5s", borderRadius: 8 }} />
      </div>
      <span style={{ fontSize: 10, color: C.protein, fontWeight: 700, marginTop: 6 }}>{value}</span>
      <span style={{ fontSize: 8, color: C.dim }}>/{target}g</span>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
export default function App() {
  const [tab, setTab] = useState("home");
  const [profile, setProfile] = useState({ name: "", age: 30, heightCm: 178, weightKg: 78, sex: "male", activity: "Moderate", mode: "maintain" });
  const [weightLog, setWeightLog] = useState([{ date: "Mon", w: 79 }, { date: "Tue", w: 78.6 }, { date: "Wed", w: 78.4 }, { date: "Thu", w: 78 }, { date: "Fri", w: 77.8 }]);
  const [workouts, setWorkouts] = useState([]);
  const [cardio, setCardio] = useState([]);
  const [meals, setMeals] = useState([]);
  const [water, setWater] = useState(0);
  const [steps, setSteps] = useState(0);
  const [prs, setPrs] = useState({});

  const today = new Date().toLocaleDateString(undefined, { weekday: "short" });
  const maintenance = tdee(profile);
  const goal = targetCalories(maintenance, profile.mode);
  const pTarget = proteinTarget(profile.weightKg);

  const stats = useMemo(() => {
    const kcalIn = meals.reduce((s, m) => s + m.cal, 0);
    const kcalOut = cardio.reduce((s, c) => s + c.cal, 0);
    const protein = meals.reduce((s, m) => s + m.p, 0);
    const carbs = meals.reduce((s, m) => s + m.c, 0);
    const fat = meals.reduce((s, m) => s + m.f, 0);
    const volume = workouts.reduce((s, w) => s + w.sets.reduce((ss, st) => ss + st.weight * st.reps, 0), 0);
    return { kcalIn, kcalOut, protein, carbs, fat, volume };
  }, [meals, cardio, workouts]);

  const nav = [
    { id: "home", icon: TrendingUp, label: "Progress" },
    { id: "lift", icon: Dumbbell, label: "Lift" },
    { id: "cardio", icon: Heart, label: "Cardio" },
    { id: "food", icon: Utensils, label: "Food" },
    { id: "profile", icon: User, label: "You" },
  ];

  const exportData = () => {
    const blob = new Blob([JSON.stringify({ profile, weightLog, workouts, cardio, meals, water, steps, prs }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "ledger-export.json"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ maxWidth: 460, margin: "0 auto", background: C.bg, minHeight: "100vh", color: C.text, fontFamily: "system-ui, -apple-system, sans-serif", paddingBottom: 80, position: "relative" }}>
      <header style={{ padding: "20px 18px 8px", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h1 style={{ margin: 0, fontSize: 22, letterSpacing: -0.5 }}><span style={{ color: C.accent }}>▚</span> Ledger</h1>
        <span style={{ fontSize: 13, color: C.dim }}>{today}</span>
      </header>

      <ProteinSidebar value={Math.round(stats.protein)} target={pTarget} />

      <main style={{ padding: "8px 44px 8px 18px" }}>
        {tab === "home" && <Progress {...{ profile, stats, weightLog, workouts, cardio, meals, maintenance, goal, pTarget, water, steps, prs }} />}
        {tab === "lift" && <Lift {...{ workouts, setWorkouts, today, prs, setPrs }} />}
        {tab === "cardio" && <Cardio {...{ cardio, setCardio, profile, today }} />}
        {tab === "food" && <Food {...{ meals, setMeals, stats, goal, pTarget }} />}
        {tab === "profile" && <Profile {...{ profile, setProfile, weightLog, setWeightLog, maintenance, goal, water, setWater, steps, setSteps, exportData }} />}
      </main>

      <nav style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 460, boxSizing: "border-box", display: "flex", background: C.surface, borderTop: `1px solid ${C.line}`, padding: "8px 6px 12px" }}>
        {nav.map(n => {
          const Ic = n.icon, on = tab === n.id;
          return (
            <button key={n.id} onClick={() => setTab(n.id)} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, color: on ? C.accent : C.dim }}>
              <Ic size={22} strokeWidth={on ? 2.4 : 1.8} />
              <span style={{ fontSize: 10, fontWeight: on ? 700 : 500 }}>{n.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

// ── Progress tab ───────────────────────────────────────────────
function Progress({ profile, stats, weightLog, workouts, cardio, meals, maintenance, goal, pTarget, water, steps, prs }) {
  const [range, setRange] = useState("day");
  const net = stats.kcalIn - stats.kcalOut;
  const prList = Object.entries(prs);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 6 }}>
        {["day", "week", "month"].map(r => (
          <Btn key={r} kind={range === r ? "primary" : "ghost"} onClick={() => setRange(r)} style={{ flex: 1, padding: "8px 0", textTransform: "capitalize" }}>{r}</Btn>
        ))}
      </div>

      <Card>
        <div style={{ display: "flex", justifyContent: "space-around" }}>
          <Ring value={stats.kcalIn} max={goal} color={C.accent} label="Eaten" sub={`/${goal}`} />
          <Ring value={stats.kcalOut} max={800} color={C.cardio} label="Burned" sub="kcal" />
          <Ring value={Math.round(stats.protein)} max={pTarget} color={C.protein} label="Protein" sub={`/${pTarget}g`} />
        </div>
        <div style={{ textAlign: "center", marginTop: 8, fontSize: 12, color: C.dim }}>
          Net {net} kcal · {profile.mode === "deficit" ? "cutting" : profile.mode === "surplus" ? "bulking" : "maintaining"} (target {goal})
        </div>
      </Card>

      <div style={{ display: "flex", gap: 12 }}>
        <Card style={{ flex: 1, textAlign: "center" }}>
          <Droplet size={18} color={C.cardio} />
          <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{water}</div>
          <span style={{ fontSize: 11, color: C.dim }}>glasses water</span>
        </Card>
        <Card style={{ flex: 1, textAlign: "center" }}>
          <Footprints size={18} color={C.accent} />
          <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{steps.toLocaleString()}</div>
          <span style={{ fontSize: 11, color: C.dim }}>steps</span>
        </Card>
      </div>

      <Card>
        <Row label="Lift volume" val={`${stats.volume.toLocaleString()} kg`} />
        <Row label="Carbs / Fat" val={`${Math.round(stats.carbs)}g · ${Math.round(stats.fat)}g`} />
        <Row label="Workouts logged" val={workouts.length} />
        <Row label="Cardio sessions" val={cardio.length} last />
      </Card>

      {prList.length > 0 && (
        <Card>
          <h3 style={{ margin: "0 0 8px", fontSize: 15, display: "flex", alignItems: "center", gap: 6 }}><Trophy size={16} color={C.accent} /> Personal records</h3>
          {prList.map(([name, val], i) => (
            <Row key={name} label={name} val={`${val} kg est. 1RM`} last={i === prList.length - 1} />
          ))}
        </Card>
      )}

      <Card>
        <h3 style={{ margin: "0 0 2px", fontSize: 15 }}>Body weight</h3>
        <span style={{ fontSize: 12, color: C.dim }}>Trend · latest {weightLog.at(-1)?.w} kg</span>
        <Bars data={weightLog.map(d => ({ l: d.date, v: d.w }))} color={C.body} />
      </Card>
    </div>
  );
}
const Row = ({ label, val, last }) => (
  <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: last ? "none" : `1px solid ${C.line}` }}>
    <span style={{ color: C.dim, fontSize: 14 }}>{label}</span>
    <span style={{ fontWeight: 600, fontSize: 14 }}>{val}</span>
  </div>
);

// ── Rest timer ─────────────────────────────────────────────────
function RestTimer() {
  const [secs, setSecs] = useState(90);
  const [left, setLeft] = useState(90);
  const [running, setRunning] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (running && left > 0) { ref.current = setTimeout(() => setLeft(left - 1), 1000); }
    return () => clearTimeout(ref.current);
  }, [running, left]);
  const mm = String(Math.floor(left / 60)), ss = String(left % 60).padStart(2, "0");
  return (
    <Card style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Timer size={18} color={C.accent} />
          <span style={{ fontSize: 26, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: left === 0 ? C.warn : C.text }}>{mm}:{ss}</span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {[60, 90, 120].map(s => (
            <button key={s} onClick={() => { setSecs(s); setLeft(s); setRunning(false); }} style={{ ...inp, width: "auto", padding: "4px 8px", cursor: "pointer", color: secs === s ? C.accent : C.dim }}>{s}s</button>
          ))}
          <button onClick={() => setRunning(!running)} style={{ ...inp, width: "auto", padding: 6, cursor: "pointer" }}>{running ? <Pause size={16} /> : <Play size={16} />}</button>
          <button onClick={() => { setLeft(secs); setRunning(false); }} style={{ ...inp, width: "auto", padding: 6, cursor: "pointer" }}><RotateCcw size={16} /></button>
        </div>
      </div>
    </Card>
  );
}

// ── Lift tab ───────────────────────────────────────────────────
function Lift({ workouts, setWorkouts, today, prs, setPrs }) {
  const [adding, setAdding] = useState(false);
  const [exercise, setExercise] = useState("");
  const [custom, setCustom] = useState("");
  const [sets, setSets] = useState([{ weight: 20, reps: 10 }]);
  const [query, setQuery] = useState("");

  const filtered = EXERCISE_LIBRARY.filter(e => e.toLowerCase().includes(query.toLowerCase()));
  const name = custom.trim() || exercise;
  const lastSession = workouts.find(w => w.name === name);

  const loadTemplate = (t) => {
    const now = Date.now();
    const added = TEMPLATES[t].map((n, i) => ({ id: now + i, name: n, sets: [{ weight: 20, reps: 10 }], date: today, fromTemplate: t }));
    setWorkouts([...added, ...workouts]);
  };

  const save = () => {
    if (!name) return;
    const best = Math.max(...sets.map(s => Math.round(s.weight * (1 + s.reps / 30))));
    let isPR = false;
    if (!prs[name] || best > prs[name]) { setPrs({ ...prs, [name]: best }); isPR = true; }
    setWorkouts([{ id: Date.now(), name, sets, date: today, isPR }, ...workouts]);
    setAdding(false); setExercise(""); setCustom(""); setSets([{ weight: 20, reps: 10 }]); setQuery("");
  };

  if (adding) {
    return (
      <div>
        <BackBar onBack={() => setAdding(false)} title="Log exercise" />
        <RestTimer />
        <Card style={{ marginBottom: 12 }}>
          <Field label="Search exercises" placeholder="Type to filter…" value={query} onChange={e => { setQuery(e.target.value); setCustom(""); }} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 130, overflowY: "auto" }}>
            {filtered.map(e => (
              <button key={e} onClick={() => { setExercise(e); setCustom(""); }} style={{ padding: "6px 10px", borderRadius: 8, fontSize: 13, cursor: "pointer", border: `1px solid ${exercise === e ? C.accent : C.line}`, background: exercise === e ? C.accent : C.surface2, color: exercise === e ? "#0B0D10" : C.text }}>{e}</button>
            ))}
          </div>
          <div style={{ marginTop: 12 }}><Field label="…or add your own" placeholder="Custom exercise name" value={custom} onChange={e => { setCustom(e.target.value); setExercise(""); }} /></div>
        </Card>

        {lastSession && (
          <Card style={{ marginBottom: 12, borderColor: C.accentDim, background: C.surface2 }}>
            <span style={{ fontSize: 12, color: C.accent, fontWeight: 600 }}>↑ Last time — beat this</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
              {lastSession.sets.map((s, i) => <span key={i} style={{ fontSize: 12, color: C.dim }}>{s.weight}kg×{s.reps}</span>)}
            </div>
          </Card>
        )}

        <Card style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>Sets</span>
            <Btn kind="ghost" onClick={() => setSets([...sets, { ...sets.at(-1) }])} style={{ padding: "4px 10px" }}><Plus size={14} /> Set</Btn>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "28px 1fr 1fr 32px", gap: 8, fontSize: 11, color: C.dim, marginBottom: 6 }}>
            <span>#</span><span>Weight (kg)</span><span>Reps</span><span></span>
          </div>
          {sets.map((s, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "28px 1fr 1fr 32px", gap: 8, alignItems: "center", marginBottom: 6 }}>
              <span style={{ color: C.dim, fontSize: 13 }}>{i + 1}</span>
              <input type="number" value={s.weight} onChange={e => setSets(sets.map((x, j) => j === i ? { ...x, weight: +e.target.value } : x))} style={inp} />
              <input type="number" value={s.reps} onChange={e => setSets(sets.map((x, j) => j === i ? { ...x, reps: +e.target.value } : x))} style={inp} />
              <button onClick={() => setSets(sets.filter((_, j) => j !== i))} style={{ background: "none", border: "none", color: C.dim, cursor: "pointer" }}><X size={16} /></button>
            </div>
          ))}
        </Card>
        <Btn onClick={save} style={{ width: "100%", padding: "12px 0" }}><Check size={16} /> Save {name || "exercise"}</Btn>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Btn onClick={() => setAdding(true)} style={{ padding: "12px 0" }}><Plus size={16} /> Log exercise</Btn>
      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}><Layers size={15} color={C.dim} /><span style={{ fontSize: 13, fontWeight: 600 }}>Quick routines</span></div>
        <div style={{ display: "flex", gap: 6 }}>
          {Object.keys(TEMPLATES).map(t => <Btn key={t} kind="ghost" onClick={() => loadTemplate(t)} style={{ flex: 1, padding: "8px 0", fontSize: 13 }}>{t}</Btn>)}
        </div>
      </Card>
      {workouts.length === 0 && <Empty icon={Dumbbell} msg="No lifts yet. Tap to log or load a routine." />}
      {workouts.map(w => (
        <Card key={w.id}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <strong style={{ fontSize: 15, display: "flex", alignItems: "center", gap: 6 }}>{w.name}{w.isPR && <Award size={15} color={C.accent} />}</strong>
            <button onClick={() => setWorkouts(workouts.filter(x => x.id !== w.id))} style={{ background: "none", border: "none", color: C.dim, cursor: "pointer" }}><Trash2 size={15} /></button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            {w.sets.map((s, i) => <span key={i} style={{ fontSize: 12, background: C.surface2, padding: "4px 8px", borderRadius: 6, color: C.dim }}>{s.weight}kg × {s.reps}</span>)}
          </div>
        </Card>
      ))}
    </div>
  );
}

// ── Cardio tab ─────────────────────────────────────────────────
function Cardio({ cardio, setCardio, profile, today }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ type: "Running", duration: 30, pace: 6, incline: 0 });
  const est = cardioCalories({ ...form, weightKg: profile.weightKg });
  const save = () => { setCardio([{ id: Date.now(), ...form, cal: est, date: today }, ...cardio]); setAdding(false); setForm({ type: "Running", duration: 30, pace: 6, incline: 0 }); };

  if (adding) {
    return (
      <div>
        <BackBar onBack={() => setAdding(false)} title="Log cardio" />
        <Card style={{ marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: C.dim, display: "block", marginBottom: 6 }}>Activity</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
            {CARDIO_TYPES.map(t => (
              <button key={t} onClick={() => setForm({ ...form, type: t })} style={{ padding: "6px 10px", borderRadius: 8, fontSize: 13, cursor: "pointer", border: `1px solid ${form.type === t ? C.cardio : C.line}`, background: form.type === t ? C.cardio : C.surface2, color: form.type === t ? "#0B0D10" : C.text }}>{t}</button>
            ))}
          </div>
          <Field label="Duration (minutes)" type="number" value={form.duration} onChange={e => setForm({ ...form, duration: +e.target.value })} />
          <Field label="Pace (min / km)" type="number" value={form.pace} onChange={e => setForm({ ...form, pace: +e.target.value })} />
          <Field label="Incline (%)" type="number" value={form.incline} onChange={e => setForm({ ...form, incline: +e.target.value })} />
        </Card>
        <Card style={{ marginBottom: 12, textAlign: "center", borderColor: C.cardio }}>
          <span style={{ fontSize: 12, color: C.dim }}>Estimated burn</span>
          <div style={{ fontSize: 34, fontWeight: 700, color: C.cardio }}>{est} <span style={{ fontSize: 16, color: C.dim }}>kcal</span></div>
          <span style={{ fontSize: 11, color: C.dim }}>Based on your weight of {profile.weightKg} kg</span>
        </Card>
        <Btn onClick={save} style={{ width: "100%", padding: "12px 0", background: C.cardio }}><Check size={16} /> Save session</Btn>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Btn onClick={() => setAdding(true)} style={{ padding: "12px 0", background: C.cardio }}><Plus size={16} /> Log cardio</Btn>
      {cardio.length === 0 && <Empty icon={Heart} msg="No cardio yet. Log a run, ride or walk." />}
      {cardio.map(c => (
        <Card key={c.id}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <strong style={{ fontSize: 15 }}>{c.type}</strong>
              <div style={{ fontSize: 12, color: C.dim, marginTop: 4, display: "flex", gap: 10 }}>
                <span><Timer size={11} style={{ verticalAlign: -1 }} /> {c.duration}m</span>
                <span>{c.pace} min/km</span>
                {c.incline > 0 && <span>{c.incline}% incline</span>}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ color: C.cardio, fontWeight: 700, fontSize: 17 }}>{c.cal}</div>
              <span style={{ fontSize: 10, color: C.dim }}>kcal</span>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ── Food tab ───────────────────────────────────────────────────
function Food({ meals, setMeals, stats, goal, pTarget }) {
  const [q, setQ] = useState("");
  const [scanning, setScanning] = useState(false);
  const match = FOOD_DB[q.trim().toLowerCase()];
  const addFood = (nameKey, data) => { setMeals([{ id: Date.now(), name: nameKey, ...data }, ...meals]); setQ(""); };
  const scan = () => { setScanning(true); setTimeout(() => { const keys = Object.keys(FOOD_DB); const g = keys[Math.floor(Math.random() * keys.length)]; addFood(g, FOOD_DB[g]); setScanning(false); }, 1400); };
  const remaining = goal - stats.kcalIn + stats.kcalOut;
  const pRemaining = Math.max(0, pTarget - Math.round(stats.protein));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Card style={{ textAlign: "center" }}>
        <span style={{ fontSize: 12, color: C.dim }}>Calories remaining</span>
        <div style={{ fontSize: 32, fontWeight: 700, color: remaining >= 0 ? C.accent : C.warn }}>{remaining} <span style={{ fontSize: 15, color: C.dim }}>kcal</span></div>
        <div style={{ display: "flex", justifyContent: "center", gap: 14, marginTop: 6, fontSize: 12 }}>
          <span style={{ color: C.protein }}>Protein left {pRemaining}g</span>
          <span style={{ color: C.dim }}>C {Math.round(stats.carbs)}g · F {Math.round(stats.fat)}g</span>
        </div>
      </Card>

      <Btn onClick={scan} kind="ghost" style={{ padding: "12px 0" }} disabled={scanning}><Camera size={16} /> {scanning ? "Analysing photo…" : "Scan a meal photo"}</Btn>

      <Card>
        <Field label="Search food" placeholder="e.g. chicken breast, protein shake…" value={q} onChange={e => setQ(e.target.value)} />
        {q && (match ? (
          <button onClick={() => addFood(q.trim().toLowerCase(), match)} style={{ width: "100%", textAlign: "left", background: C.surface2, border: `1px solid ${C.accent}`, borderRadius: 10, padding: 12, cursor: "pointer", color: C.text }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <strong style={{ textTransform: "capitalize" }}>{q.trim()}</strong>
              <span style={{ color: C.accent, fontWeight: 700 }}>{match.cal} kcal</span>
            </div>
            <span style={{ fontSize: 12, color: C.dim }}>P {match.p}g · C {match.c}g · F {match.f}g — tap to add</span>
          </button>
        ) : <span style={{ fontSize: 13, color: C.dim }}>No match. Try: {Object.keys(FOOD_DB).slice(0, 3).join(", ")}…</span>)}
      </Card>

      {meals.length === 0 && <Empty icon={Utensils} msg="No meals logged. Scan or search to start." />}
      {meals.map(m => (
        <Card key={m.id}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <strong style={{ fontSize: 15, textTransform: "capitalize" }}>{m.name}</strong>
              <div style={{ fontSize: 12, color: C.dim, marginTop: 2 }}><span style={{ color: C.protein }}>P {m.p}g</span> · C {m.c}g · F {m.f}g</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ color: C.accent, fontWeight: 700 }}>{m.cal}</span>
              <button onClick={() => setMeals(meals.filter(x => x.id !== m.id))} style={{ background: "none", border: "none", color: C.dim, cursor: "pointer" }}><Trash2 size={15} /></button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ── Profile tab ────────────────────────────────────────────────
function Profile({ profile, setProfile, weightLog, setWeightLog, maintenance, goal, water, setWater, steps, setSteps, exportData }) {
  const set = (k, v) => setProfile({ ...profile, [k]: v });
  const bmi = (profile.weightKg / Math.pow(profile.heightCm / 100, 2)).toFixed(1);
  const logWeight = () => setWeightLog([...weightLog, { date: new Date().toLocaleDateString(undefined, { weekday: "short" }), w: profile.weightKg }]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Card>
        <Field label="Name" value={profile.name} onChange={e => set("name", e.target.value)} placeholder="Your name" />
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}><Field label="Age" type="number" value={profile.age} onChange={e => set("age", +e.target.value)} /></div>
          <div style={{ flex: 1 }}><Field label="Height (cm)" type="number" value={profile.heightCm} onChange={e => set("heightCm", +e.target.value)} /></div>
        </div>
        <Field label="Weight (kg)" type="number" value={profile.weightKg} onChange={e => set("weightKg", +e.target.value)} />
        <span style={{ fontSize: 12, color: C.dim, display: "block", marginBottom: 6 }}>Sex (for BMR accuracy)</span>
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          {["male", "female"].map(s => <button key={s} onClick={() => set("sex", s)} style={{ flex: 1, padding: "8px 0", borderRadius: 8, fontSize: 13, textTransform: "capitalize", cursor: "pointer", border: `1px solid ${profile.sex === s ? C.accent : C.line}`, background: profile.sex === s ? C.accent : C.surface2, color: profile.sex === s ? "#0B0D10" : C.text }}>{s}</button>)}
        </div>
        <span style={{ fontSize: 12, color: C.dim, display: "block", marginBottom: 6 }}>Activity level</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {Object.keys(ACTIVITY).map(a => <button key={a} onClick={() => set("activity", a)} style={{ padding: "6px 10px", borderRadius: 8, fontSize: 12, cursor: "pointer", border: `1px solid ${profile.activity === a ? C.accent : C.line}`, background: profile.activity === a ? C.accent : C.surface2, color: profile.activity === a ? "#0B0D10" : C.text }}>{a}</button>)}
        </div>
      </Card>

      <Card style={{ borderColor: C.accentDim }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontSize: 13, color: C.dim }}>Maintenance (TDEE)</span>
          <span style={{ fontSize: 18, fontWeight: 700 }}>{maintenance} kcal</span>
        </div>
        <span style={{ fontSize: 12, color: C.dim, display: "block", margin: "12px 0 6px" }}>Goal mode</span>
        <div style={{ display: "flex", gap: 6 }}>
          {[["deficit", "Deficit −400", C.cardio], ["maintain", "Maintain", C.dim], ["surplus", "Surplus +350", C.protein]].map(([m, lbl, col]) => (
            <button key={m} onClick={() => set("mode", m)} style={{ flex: 1, padding: "10px 4px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1px solid ${profile.mode === m ? col : C.line}`, background: profile.mode === m ? col : C.surface2, color: profile.mode === m ? "#0B0D10" : C.text }}>{lbl}</button>
          ))}
        </div>
        <div style={{ textAlign: "center", marginTop: 12 }}>
          <span style={{ fontSize: 12, color: C.dim }}>Daily target</span>
          <div style={{ fontSize: 26, fontWeight: 700, color: C.accent }}>{goal} kcal</div>
        </div>
        <p style={{ fontSize: 11, color: C.dim, lineHeight: 1.5, marginTop: 10, marginBottom: 0 }}>
          Estimated via Mifflin-St Jeor. Any formula is ±10%. For your true number: hold this intake 2–3 weeks and watch your weight trend — if it's flat, that's your real maintenance. Adjust from there.
        </p>
      </Card>

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={{ fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}><Droplet size={16} color={C.cardio} /> Water</span>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => setWater(Math.max(0, water - 1))} style={{ ...inp, width: "auto", padding: "4px 12px", cursor: "pointer" }}>−</button>
            <span style={{ fontWeight: 700, minWidth: 24, textAlign: "center" }}>{water}</span>
            <button onClick={() => setWater(water + 1)} style={{ ...inp, width: "auto", padding: "4px 12px", cursor: "pointer" }}>+</button>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}><Footprints size={16} color={C.accent} /> Steps</span>
          <input type="number" value={steps} onChange={e => setSteps(+e.target.value)} style={{ ...inp, width: 100 }} />
        </div>
      </Card>

      <Card>
        <Row label="BMI" val={bmi} />
        <Row label="Weigh-ins recorded" val={weightLog.length} last />
        <Btn kind="ghost" onClick={logWeight} style={{ width: "100%", marginTop: 12 }}>Log today's weight</Btn>
      </Card>

      <Btn kind="ghost" onClick={exportData} style={{ width: "100%", padding: "12px 0" }}><Download size={16} /> Export all data (JSON)</Btn>
    </div>
  );
}

// ── Shared UI ──────────────────────────────────────────────────
const BackBar = ({ onBack, title }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
    <button onClick={onBack} style={{ background: C.surface2, border: `1px solid ${C.line}`, borderRadius: 8, padding: 6, color: C.text, cursor: "pointer", display: "flex" }}><ChevronLeft size={18} /></button>
    <strong style={{ fontSize: 16 }}>{title}</strong>
  </div>
);
const Empty = ({ icon: Ic, msg }) => (
  <div style={{ textAlign: "center", padding: "40px 20px", color: C.dim }}>
    <Ic size={32} style={{ opacity: 0.5 }} />
    <p style={{ fontSize: 14, marginTop: 10 }}>{msg}</p>
  </div>
);
