// ── Compare progress: preset time-based matchups + manual picking ─
import { useMemo, useState } from "react";
import { differenceInCalendarDays, parseISO, subMonths, subYears } from "date-fns";
import { Images } from "lucide-react";
import { C } from "../theme";
import { BackBar, Btn, Card, Empty } from "../components/ui";
import { useObjectUrl } from "../utils/useObjectUrl";
import { shortLabel, toISO } from "../utils/date";
import { cmToDisplay, kgToDisplay, lengthUnitLabel, weightUnitLabel } from "../utils/units";
import { PhotoThumb } from "./Photos";
import type { Measurement, ProgressPhoto, UnitSystem } from "../types";

// Nearest Measurement to targetISO, by absolute calendar-day distance —
// mirrors nearestExcluding's photo-pairing approach below.
function nearestMeasurement(measurements: Measurement[], targetISO: string): Measurement | undefined {
  if (measurements.length === 0) return undefined;
  const dist = (m: Measurement) => Math.abs(differenceInCalendarDays(parseISO(m.date), parseISO(targetISO)));
  return measurements.reduce((best, m) => (dist(m) < dist(best) ? m : best));
}

const MEASUREMENT_FIELDS: { key: keyof Measurement; label: string }[] = [
  { key: "waistCm", label: "Waist" },
  { key: "chestCm", label: "Chest" },
  { key: "armsCm", label: "Arms" },
  { key: "hipsCm", label: "Hips" },
];

type Preset = "1m" | "3m" | "1y" | "custom";

const PRESETS: { id: Preset; label: string; monthsBack?: number; yearsBack?: number }[] = [
  { id: "1m", label: "vs 1 month", monthsBack: 1 },
  { id: "3m", label: "vs 3 months", monthsBack: 3 },
  { id: "1y", label: "vs 1 year", yearsBack: 1 },
];

// Photo whose date is closest to targetISO, preferring not to reuse excludeId
// (falls back to it if that's the only candidate available).
function nearestExcluding(
  photos: ProgressPhoto[],
  targetISO: string,
  excludeId?: string,
): ProgressPhoto | undefined {
  const pool = photos.filter((p) => p.id !== excludeId);
  const candidates = pool.length > 0 ? pool : photos;
  if (candidates.length === 0) return undefined;
  const dist = (p: ProgressPhoto) => Math.abs(differenceInCalendarDays(parseISO(p.date), parseISO(targetISO)));
  return candidates.reduce((best, p) => (dist(p) < dist(best) ? p : best));
}

export function PhotoCompare({
  photos,
  measurements,
  unit,
  onBack,
}: {
  photos: ProgressPhoto[];
  measurements: Measurement[];
  unit: UnitSystem;
  onBack: () => void;
}) {
  const sorted = useMemo(() => [...photos].sort((a, b) => a.date.localeCompare(b.date)), [photos]);
  const latest = sorted.at(-1);

  const [preset, setPreset] = useState<Preset>("1m");
  const [manualAfterId, setManualAfterId] = useState<string | undefined>();
  const [manualBeforeId, setManualBeforeId] = useState<string | undefined>();
  const [picking, setPicking] = useState<"before" | "after" | null>(null);

  const afterPhoto = manualAfterId ? sorted.find((p) => p.id === manualAfterId) : latest;

  const presetBeforePhoto = useMemo(() => {
    const def = PRESETS.find((x) => x.id === preset);
    if (!def) return undefined; // "custom" — manual only
    const target = def.monthsBack !== undefined ? subMonths(new Date(), def.monthsBack) : subYears(new Date(), def.yearsBack!);
    return nearestExcluding(sorted, toISO(target), afterPhoto?.id);
  }, [preset, sorted, afterPhoto]);

  const beforePhoto = manualBeforeId ? sorted.find((p) => p.id === manualBeforeId) : presetBeforePhoto;

  const selectPreset = (p: Preset) => {
    setPreset(p);
    setManualBeforeId(undefined);
  };

  const pickManual = (id: string) => {
    if (picking === "after") setManualAfterId(id);
    else if (picking === "before") {
      setManualBeforeId(id);
      setPreset("custom");
    }
    setPicking(null);
  };

  const daysApart =
    afterPhoto && beforePhoto
      ? Math.abs(differenceInCalendarDays(parseISO(afterPhoto.date), parseISO(beforePhoto.date)))
      : undefined;
  const weightDelta =
    afterPhoto?.weightKg !== undefined && beforePhoto?.weightKg !== undefined
      ? Math.round((kgToDisplay(afterPhoto.weightKg, unit) - kgToDisplay(beforePhoto.weightKg, unit)) * 10) / 10
      : undefined;

  // Pairs naturally with weigh-ins: nearest logged measurement to each
  // photo's date, deltas shown only for fields present on both sides.
  const beforeMeasurement = beforePhoto ? nearestMeasurement(measurements, beforePhoto.date) : undefined;
  const afterMeasurement = afterPhoto ? nearestMeasurement(measurements, afterPhoto.date) : undefined;
  const measurementDeltas = MEASUREMENT_FIELDS.map(({ key, label }) => {
    const b = beforeMeasurement?.[key] as number | undefined;
    const a = afterMeasurement?.[key] as number | undefined;
    if (b === undefined || a === undefined) return null;
    return { label, delta: Math.round((cmToDisplay(a, unit) - cmToDisplay(b, unit)) * 10) / 10 };
  }).filter((x): x is { label: string; delta: number } => x !== null);

  if (sorted.length < 2) {
    return (
      <div>
        <BackBar onBack={onBack} title="Compare progress" />
        <Empty icon={Images} msg="Add at least two photos to compare." />
      </div>
    );
  }

  if (picking) {
    return (
      <div>
        <BackBar onBack={() => setPicking(null)} title={`Choose ${picking} photo`} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          {[...sorted].reverse().map((p) => (
            <PhotoThumb key={p.id} photo={p} onClick={() => pickManual(p.id)} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <BackBar onBack={onBack} title="Compare progress" />
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {PRESETS.map((p) => (
          <Btn
            key={p.id}
            kind={preset === p.id ? "primary" : "ghost"}
            onClick={() => selectPreset(p.id)}
            style={{ flex: 1, padding: "8px 2px", fontSize: 11 }}
          >
            {p.label}
          </Btn>
        ))}
      </div>

      <Card>
        <div style={{ display: "flex", gap: 10 }}>
          <ComparisonSlot label="Before" photo={beforePhoto} unit={unit} onTap={() => setPicking("before")} />
          <ComparisonSlot label="After" photo={afterPhoto} unit={unit} onTap={() => setPicking("after")} />
        </div>
        {daysApart !== undefined && (
          <div style={{ textAlign: "center", marginTop: 12, fontSize: 12, color: C.dim }}>
            {daysApart} day{daysApart === 1 ? "" : "s"} apart
            {weightDelta !== undefined && (
              <>
                {" · "}
                <span style={{ color: C.body, fontWeight: 600 }}>
                  {weightDelta > 0 ? "+" : ""}
                  {weightDelta} {weightUnitLabel(unit)}
                </span>
              </>
            )}
            {measurementDeltas.length > 0 && (
              <div style={{ marginTop: 6, display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
                {measurementDeltas.map(({ label, delta }) => (
                  <span key={label}>
                    {label}{" "}
                    <span style={{ color: delta === 0 ? C.dim : C.body, fontWeight: 600 }}>
                      {delta > 0 ? "+" : ""}
                      {delta}
                      {lengthUnitLabel(unit)}
                    </span>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>
      <p style={{ fontSize: 11, color: C.dim, textAlign: "center", marginTop: 10 }}>
        Tap either photo to pick a specific date instead of the closest match.
      </p>
    </div>
  );
}

function ComparisonSlot({
  label,
  photo,
  unit,
  onTap,
}: {
  label: string;
  photo: ProgressPhoto | undefined;
  unit: UnitSystem;
  onTap: () => void;
}) {
  const url = useObjectUrl(photo?.blob);
  return (
    <div style={{ flex: 1 }}>
      <span style={{ fontSize: 11, color: C.dim, display: "block", marginBottom: 4, textAlign: "center" }}>
        {label}
      </span>
      <button
        onClick={onTap}
        aria-label={`Change ${label.toLowerCase()} photo`}
        style={{
          width: "100%",
          aspectRatio: "3 / 4",
          borderRadius: 10,
          overflow: "hidden",
          border: `1px solid ${C.line}`,
          padding: 0,
          cursor: "pointer",
          background: C.surface2,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {url ? (
          <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        ) : (
          <span style={{ fontSize: 11, color: C.dim }}>Tap to pick</span>
        )}
      </button>
      {photo && (
        <span style={{ fontSize: 11, color: C.dim, display: "block", textAlign: "center", marginTop: 4 }}>
          {shortLabel(photo.date)}
          {photo.weightKg !== undefined ? ` · ${kgToDisplay(photo.weightKg, unit)}${weightUnitLabel(unit)}` : ""}
        </span>
      )}
    </div>
  );
}
