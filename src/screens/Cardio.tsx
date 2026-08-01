// ── Cardio tab ─────────────────────────────────────────────────
import { useMemo, useState } from "react";
import { Check, Heart, Plus, Timer } from "lucide-react";
import { C } from "../theme";
import { BackBar, Btn, Card, Empty, Field } from "../components/ui";
import { UndoToast } from "../components/UndoToast";
import { CARDIO_TYPES } from "../seed";
import { cardioCalories } from "../formulas";
import { addCardio, deleteCardio, updateCardio, useCardio } from "../store";
import { todayISO } from "../utils/date";
import { kgToDisplay, unitSystemOf, weightUnitLabel } from "../utils/units";
import { useBackClose } from "../utils/useBackClose";
import { useUndoableDelete } from "../utils/useUndoableDelete";
import type { CardioSession, Profile } from "../types";
import { Trash2 } from "lucide-react";

const blankForm = { type: "Running", duration: 30, pace: 6, incline: 0 };

export function Cardio({ profile }: { profile: Profile }) {
  const allCardio = useCardio();
  const { pendingId: pendingDeleteId, requestDelete, undo } = useUndoableDelete(deleteCardio);
  const cardio = useMemo(
    () => allCardio.filter((c) => c.id !== pendingDeleteId),
    [allCardio, pendingDeleteId],
  );
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(blankForm);
  const [editingCardio, setEditingCardio] = useState<CardioSession | null>(null);
  const unit = unitSystemOf(profile);

  // Live estimated burn, recomputed on every input change.
  const est = cardioCalories({ ...form, weightKg: profile.weightKg });

  const closeForm = () => {
    setAdding(false);
    setForm(blankForm);
    setEditingCardio(null);
  };
  useBackClose(adding, closeForm);

  const openEditCardio = (c: CardioSession) => {
    setForm({ type: c.type, duration: c.duration, pace: c.pace, incline: c.incline });
    setEditingCardio(c);
    setAdding(true);
  };

  const save = async () => {
    if (editingCardio) {
      // Preserve the original date — editing shouldn't move the entry.
      await updateCardio(editingCardio.id, { ...form, cal: est, date: editingCardio.date });
    } else {
      await addCardio({ ...form, cal: est, date: todayISO() });
    }
    closeForm();
  };

  if (adding) {
    return (
      <div>
        <BackBar onBack={closeForm} title={editingCardio ? "Edit cardio" : "Log cardio"} />
        <Card style={{ marginBottom: 12 }}>
          <span
            style={{ fontSize: 12, color: C.dim, display: "block", marginBottom: 6 }}
          >
            Activity
          </span>
          <div
            style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}
          >
            {CARDIO_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setForm({ ...form, type: t })}
                aria-pressed={form.type === t}
                style={{
                  padding: "6px 10px",
                  borderRadius: 8,
                  fontSize: 13,
                  cursor: "pointer",
                  border: `1px solid ${form.type === t ? C.cardio : C.line}`,
                  background: form.type === t ? C.cardio : C.surface2,
                  color: form.type === t ? C.onAccent : C.text,
                }}
              >
                {t}
              </button>
            ))}
          </div>
          <Field
            label="Duration (minutes)"
            type="number"
            value={form.duration}
            onChange={(e) => setForm({ ...form, duration: +e.target.value })}
          />
          <Field
            label="Pace (min / km)"
            type="number"
            value={form.pace}
            onChange={(e) => setForm({ ...form, pace: +e.target.value })}
          />
          <Field
            label="Incline (%)"
            type="number"
            value={form.incline}
            onChange={(e) => setForm({ ...form, incline: +e.target.value })}
          />
        </Card>
        <Card style={{ marginBottom: 12, textAlign: "center", borderColor: C.cardio }}>
          <span style={{ fontSize: 12, color: C.dim }}>Estimated burn</span>
          <div style={{ fontSize: 34, fontWeight: 700, color: C.cardio }}>
            {est} <span style={{ fontSize: 16, color: C.dim }}>kcal</span>
          </div>
          <span style={{ fontSize: 11, color: C.dim }}>
            Based on your weight of {kgToDisplay(profile.weightKg, unit)} {weightUnitLabel(unit)}
          </span>
        </Card>
        <Btn onClick={save} style={{ width: "100%", padding: "12px 0", background: C.cardio }}>
          <Check size={16} /> {editingCardio ? "Save changes" : "Save session"}
        </Btn>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Btn
        onClick={() => setAdding(true)}
        style={{ padding: "12px 0", background: C.cardio }}
      >
        <Plus size={16} /> Log cardio
      </Btn>
      {cardio.length === 0 && (
        <Empty icon={Heart} msg="No cardio yet. Log a run, ride or walk." />
      )}
      {cardio.map((c) => (
        <Card key={c.id}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <button
              onClick={() => openEditCardio(c)}
              aria-label={`Edit ${c.type} session`}
              style={{ background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", color: C.text }}
            >
              <strong style={{ fontSize: 15 }}>{c.type}</strong>
              <div
                style={{
                  fontSize: 12,
                  color: C.dim,
                  marginTop: 4,
                  display: "flex",
                  gap: 10,
                }}
              >
                <span>
                  <Timer size={11} style={{ verticalAlign: -1 }} /> {c.duration}m
                </span>
                <span>{c.pace} min/km</span>
                {c.incline > 0 && <span>{c.incline}% incline</span>}
              </div>
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ textAlign: "right" }}>
                <div style={{ color: C.cardio, fontWeight: 700, fontSize: 17 }}>
                  {c.cal}
                </div>
                <span style={{ fontSize: 10, color: C.dim }}>kcal</span>
              </div>
              <button
                onClick={() => requestDelete(c.id)}
                aria-label={`Delete ${c.type} session`}
                style={{ background: "none", border: "none", color: C.dim, cursor: "pointer" }}
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        </Card>
      ))}

      {pendingDeleteId && <UndoToast message="Cardio session deleted" onUndo={undo} />}
    </div>
  );
}
