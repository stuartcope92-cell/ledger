// ── Body measurements sub-screen (waist/chest/arms/hips) ───────
// Logged the same way as weigh-ins (BUILD_SPEC-style: date-keyed, edit in
// place), stacked off the You tab like ExerciseProgress/PhotoCompare.
import { useState } from "react";
import { Check, Ruler, Trash2 } from "lucide-react";
import { C } from "../theme";
import { BackBar, Btn, Card, Empty, Field } from "../components/ui";
import { addMeasurement, deleteMeasurement, updateMeasurement, useMeasurements } from "../store";
import { cmToDisplay, displayToCm, lengthUnitLabel } from "../utils/units";
import { useBackClose } from "../utils/useBackClose";
import { shortLabel, todayISO } from "../utils/date";
import type { Measurement, UnitSystem } from "../types";

interface FormState {
  date: string;
  waist: string;
  chest: string;
  arms: string;
  hips: string;
}

const blankForm = (): FormState => ({ date: todayISO(), waist: "", chest: "", arms: "", hips: "" });

export function Measurements({ unit, onBack }: { unit: UnitSystem; onBack: () => void }) {
  const measurements = useMeasurements();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<FormState>(blankForm());
  const [editing, setEditing] = useState<Measurement | null>(null);

  const unitLabel = lengthUnitLabel(unit);

  const openAdd = () => {
    setForm(blankForm());
    setEditing(null);
    setAdding(true);
  };

  // Prefill with values converted to the current display unit — editing
  // shouldn't require the user to think in cm if they're on imperial.
  const openEdit = (m: Measurement) => {
    setForm({
      date: m.date,
      waist: m.waistCm !== undefined ? String(cmToDisplay(m.waistCm, unit)) : "",
      chest: m.chestCm !== undefined ? String(cmToDisplay(m.chestCm, unit)) : "",
      arms: m.armsCm !== undefined ? String(cmToDisplay(m.armsCm, unit)) : "",
      hips: m.hipsCm !== undefined ? String(cmToDisplay(m.hipsCm, unit)) : "",
    });
    setEditing(m);
    setAdding(true);
  };

  const close = () => {
    setAdding(false);
    setForm(blankForm());
    setEditing(null);
  };
  useBackClose(adding, close);

  const toCm = (v: string): number | undefined =>
    v.trim() === "" ? undefined : displayToCm(+v, unit);

  const save = async () => {
    const payload = {
      date: form.date,
      waistCm: toCm(form.waist),
      chestCm: toCm(form.chest),
      armsCm: toCm(form.arms),
      hipsCm: toCm(form.hips),
    };
    if (editing) {
      await updateMeasurement(editing.id, payload);
    } else {
      await addMeasurement(payload);
    }
    close();
  };

  const hasAny = form.waist || form.chest || form.arms || form.hips;

  if (adding) {
    return (
      <div>
        <BackBar onBack={close} title={editing ? "Edit measurements" : "Log measurements"} />
        <Card style={{ marginBottom: 12 }}>
          <Field
            label="Date"
            type="date"
            value={form.date}
            max={todayISO()}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
          <Field
            label={`Waist (${unitLabel})`}
            type="number"
            placeholder="Skip if not measuring"
            value={form.waist}
            onChange={(e) => setForm({ ...form, waist: e.target.value })}
          />
          <Field
            label={`Chest (${unitLabel})`}
            type="number"
            placeholder="Skip if not measuring"
            value={form.chest}
            onChange={(e) => setForm({ ...form, chest: e.target.value })}
          />
          <Field
            label={`Arms (${unitLabel})`}
            type="number"
            placeholder="Skip if not measuring"
            value={form.arms}
            onChange={(e) => setForm({ ...form, arms: e.target.value })}
          />
          <Field
            label={`Hips (${unitLabel})`}
            type="number"
            placeholder="Skip if not measuring"
            value={form.hips}
            onChange={(e) => setForm({ ...form, hips: e.target.value })}
          />
        </Card>
        <Btn onClick={save} disabled={!hasAny} style={{ width: "100%", padding: "12px 0" }}>
          <Check size={16} /> Save
        </Btn>
      </div>
    );
  }

  return (
    <div>
      <BackBar onBack={onBack} title="Body measurements" />
      <Btn onClick={openAdd} style={{ width: "100%", padding: "12px 0", marginBottom: 12 }}>
        <Ruler size={16} /> Log measurements
      </Btn>
      {measurements.length === 0 && (
        <Empty icon={Ruler} msg="No measurements yet. Log waist, chest, arms or hips to start a history." />
      )}
      {measurements.map((m) => {
        const parts: string[] = [];
        if (m.waistCm !== undefined) parts.push(`Waist ${cmToDisplay(m.waistCm, unit)}${unitLabel}`);
        if (m.chestCm !== undefined) parts.push(`Chest ${cmToDisplay(m.chestCm, unit)}${unitLabel}`);
        if (m.armsCm !== undefined) parts.push(`Arms ${cmToDisplay(m.armsCm, unit)}${unitLabel}`);
        if (m.hipsCm !== undefined) parts.push(`Hips ${cmToDisplay(m.hipsCm, unit)}${unitLabel}`);
        return (
          <Card key={m.id} style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button
                onClick={() => openEdit(m)}
                aria-label={`Edit measurements from ${m.date}`}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  color: C.text,
                  textAlign: "left",
                  flex: 1,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700 }}>{shortLabel(m.date)}</div>
                <div style={{ fontSize: 12, color: C.dim, marginTop: 4 }}>{parts.join(" · ")}</div>
              </button>
              <button
                onClick={() => deleteMeasurement(m.id)}
                aria-label={`Delete measurements from ${m.date}`}
                style={{ background: "none", border: "none", color: C.dim, cursor: "pointer" }}
              >
                <Trash2 size={15} />
              </button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
