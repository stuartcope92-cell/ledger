// ── Photos tab — progress photo timeline + comparison ───────────
import { useRef, useState } from "react";
import { ArrowLeftRight, Camera, Check, Images, Trash2, Upload } from "lucide-react";
import { C } from "../theme";
import { BackBar, Btn, Card, Empty, Field, Row } from "../components/ui";
import { useObjectUrl } from "../utils/useObjectUrl";
import { addProgressPhoto, deleteProgressPhoto, useMeasurements, useProgressPhotos } from "../store";
import { compressImage } from "../utils/image";
import { shortLabel, todayISO } from "../utils/date";
import { kgToDisplay, unitSystemOf, weightUnitLabel } from "../utils/units";
import { PhotoCompare } from "./PhotoCompare";
import type { Profile, ProgressPhoto, UnitSystem } from "../types";

interface Pending {
  blob: Blob;
  date: string;
  note: string;
}

export function Photos({ profile }: { profile: Profile }) {
  const photos = useProgressPhotos();
  const measurements = useMeasurements();
  const [pending, setPending] = useState<Pending | null>(null);
  const [showCompare, setShowCompare] = useState(false);
  const [viewing, setViewing] = useState<ProgressPhoto | null>(null);
  const unit = unitSystemOf(profile);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const onPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const compressed = await compressImage(file);
    setPending({ blob: compressed, date: todayISO(), note: "" });
  };

  const save = async () => {
    if (!pending) return;
    await addProgressPhoto({
      date: pending.date,
      blob: pending.blob,
      weightKg: profile.weightKg,
      note: pending.note.trim() || undefined,
    });
    setPending(null);
  };

  if (showCompare) {
    return (
      <PhotoCompare
        photos={photos}
        measurements={measurements}
        unit={unit}
        onBack={() => setShowCompare(false)}
      />
    );
  }

  if (pending) {
    return (
      <PendingPhotoEditor
        pending={pending}
        setPending={setPending}
        onSave={save}
        onCancel={() => setPending(null)}
      />
    );
  }

  if (viewing) {
    return (
      <PhotoViewer
        photo={viewing}
        unit={unit}
        onClose={() => setViewing(null)}
        onDelete={() => {
          deleteProgressPhoto(viewing.id);
          setViewing(null);
        }}
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <Btn onClick={() => cameraInputRef.current?.click()} style={{ flex: 1, padding: "12px 0" }}>
          <Camera size={16} /> Take photo
        </Btn>
        <Btn
          onClick={() => uploadInputRef.current?.click()}
          kind="ghost"
          style={{ flex: 1, padding: "12px 0" }}
        >
          <Upload size={16} /> Upload
        </Btn>
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={onPicked}
          style={{ display: "none" }}
        />
        <input
          ref={uploadInputRef}
          type="file"
          accept="image/*"
          onChange={onPicked}
          style={{ display: "none" }}
        />
      </div>

      <div>
        <Btn
          kind="ghost"
          onClick={() => setShowCompare(true)}
          disabled={photos.length < 2}
          style={{ width: "100%", padding: "12px 0" }}
        >
          <ArrowLeftRight size={16} /> Compare progress
        </Btn>
        {photos.length < 2 && (
          <p style={{ fontSize: 11, color: C.dim, textAlign: "center", marginTop: 4 }}>
            Add at least two photos to compare
          </p>
        )}
      </div>

      {photos.length === 0 && (
        <Empty icon={Images} msg="No progress photos yet. Take or upload one to start a timeline." />
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        {photos.map((p) => (
          <PhotoThumb key={p.id} photo={p} onClick={() => setViewing(p)} />
        ))}
      </div>
    </div>
  );
}

export function PhotoThumb({ photo, onClick }: { photo: ProgressPhoto; onClick: () => void }) {
  const url = useObjectUrl(photo.blob);
  return (
    <button
      onClick={onClick}
      aria-label={`View progress photo from ${photo.date}`}
      style={{
        position: "relative",
        aspectRatio: "3 / 4",
        borderRadius: 10,
        overflow: "hidden",
        border: `1px solid ${C.line}`,
        padding: 0,
        cursor: "pointer",
        background: C.surface2,
      }}
    >
      {url && (
        <img
          src={url}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      )}
      <span
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          fontSize: 10,
          color: "#fff",
          background: "rgba(0,0,0,0.55)",
          padding: "3px 4px",
          textAlign: "center",
        }}
      >
        {shortLabel(photo.date)}
      </span>
    </button>
  );
}

function PendingPhotoEditor({
  pending,
  setPending,
  onSave,
  onCancel,
}: {
  pending: Pending;
  setPending: (p: Pending) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const url = useObjectUrl(pending.blob);
  return (
    <div>
      <BackBar onBack={onCancel} title="Add progress photo" />
      <Card style={{ marginBottom: 12, padding: 0, overflow: "hidden" }}>
        {url && (
          <img
            src={url}
            alt="New progress photo preview"
            style={{ width: "100%", maxHeight: 360, objectFit: "cover", display: "block" }}
          />
        )}
      </Card>
      <Card style={{ marginBottom: 12 }}>
        <Field
          label="Date"
          type="date"
          value={pending.date}
          max={todayISO()}
          onChange={(e) => setPending({ ...pending, date: e.target.value })}
        />
        <Field
          label="Note (optional)"
          placeholder="e.g. front, after cut…"
          value={pending.note}
          onChange={(e) => setPending({ ...pending, note: e.target.value })}
        />
      </Card>
      <Btn onClick={onSave} disabled={!pending.date} style={{ width: "100%", padding: "12px 0" }}>
        <Check size={16} /> Save photo
      </Btn>
    </div>
  );
}

function PhotoViewer({
  photo,
  unit,
  onClose,
  onDelete,
}: {
  photo: ProgressPhoto;
  unit: UnitSystem;
  onClose: () => void;
  onDelete: () => void;
}) {
  const url = useObjectUrl(photo.blob);
  const hasDetails = photo.weightKg !== undefined || !!photo.note;
  return (
    <div>
      <BackBar onBack={onClose} title={shortLabel(photo.date)} />
      <Card style={{ marginBottom: 12, padding: 0, overflow: "hidden" }}>
        {url && (
          <img src={url} alt={`Progress photo from ${photo.date}`} style={{ width: "100%", display: "block" }} />
        )}
      </Card>
      {hasDetails && (
        <Card style={{ marginBottom: 12 }}>
          {photo.weightKg !== undefined && (
            <Row label="Weight" val={`${kgToDisplay(photo.weightKg, unit)} ${weightUnitLabel(unit)}`} last={!photo.note} />
          )}
          {photo.note && <Row label="Note" val={photo.note} last />}
        </Card>
      )}
      <Btn
        kind="ghost"
        onClick={onDelete}
        style={{ width: "100%", padding: "12px 0", color: C.warn, borderColor: C.warn }}
      >
        <Trash2 size={16} /> Delete photo
      </Btn>
    </div>
  );
}
