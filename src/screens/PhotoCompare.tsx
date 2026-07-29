// ── Compare progress: preset time-based matchups + manual picking ─
import { useMemo, useState } from "react";
import { differenceInCalendarDays, parseISO, subMonths, subYears } from "date-fns";
import { Images } from "lucide-react";
import { C } from "../theme";
import { BackBar, Btn, Card, Empty } from "../components/ui";
import { useObjectUrl } from "../utils/useObjectUrl";
import { shortLabel, toISO } from "../utils/date";
import { PhotoThumb } from "./Photos";
import type { ProgressPhoto } from "../types";

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
  onBack,
}: {
  photos: ProgressPhoto[];
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
      ? Math.round((afterPhoto.weightKg - beforePhoto.weightKg) * 10) / 10
      : undefined;

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
          <ComparisonSlot label="Before" photo={beforePhoto} onTap={() => setPicking("before")} />
          <ComparisonSlot label="After" photo={afterPhoto} onTap={() => setPicking("after")} />
        </div>
        {daysApart !== undefined && (
          <div style={{ textAlign: "center", marginTop: 12, fontSize: 12, color: C.dim }}>
            {daysApart} day{daysApart === 1 ? "" : "s"} apart
            {weightDelta !== undefined && (
              <>
                {" · "}
                <span style={{ color: C.body, fontWeight: 600 }}>
                  {weightDelta > 0 ? "+" : ""}
                  {weightDelta} kg
                </span>
              </>
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
  onTap,
}: {
  label: string;
  photo: ProgressPhoto | undefined;
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
          {photo.weightKg !== undefined ? ` · ${photo.weightKg}kg` : ""}
        </span>
      )}
    </div>
  );
}
