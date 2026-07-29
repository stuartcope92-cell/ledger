// ── Live barcode scanner ────────────────────────────────────────
// Uses the browser's native BarcodeDetector API on a live camera feed where
// supported (Chrome/Edge, desktop + Android). Safari and Firefox don't
// implement it, so manual barcode entry is always offered too — not just as
// a failure fallback, but because it's a perfectly reasonable way to look
// one up regardless of camera support.
import { useEffect, useRef, useState } from "react";
import { BackBar, Btn, Card, Field } from "./ui";
import { C } from "../theme";

interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}
interface BarcodeDetectorConstructor {
  new (options?: { formats: string[] }): BarcodeDetectorLike;
}
declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorConstructor;
  }
}

type CameraStatus = "starting" | "scanning" | "unsupported" | "denied" | "error";

const STATUS_MESSAGE: Record<Exclude<CameraStatus, "starting" | "scanning">, string> = {
  unsupported: "Live scanning isn't supported in this browser — enter the barcode number instead.",
  denied: "Camera access was denied — enter the barcode number instead.",
  error: "Couldn't start the camera — enter the barcode number instead.",
};

export function BarcodeScanner({
  onDetected,
  onCancel,
}: {
  onDetected: (code: string) => void;
  onCancel: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<CameraStatus>("starting");
  const [manualCode, setManualCode] = useState("");

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    let raf: number | null = null;

    const stop = () => {
      if (raf !== null) cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };

    async function start() {
      if (!window.BarcodeDetector) {
        setStatus("unsupported");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        setStatus("scanning");

        const detector = new window.BarcodeDetector({
          formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"],
        });

        const loop = async () => {
          if (cancelled) return;
          try {
            const found = await detector.detect(video);
            if (found.length > 0) {
              stop();
              onDetected(found[0].rawValue);
              return;
            }
          } catch {
            // transient — e.g. a frame grabbed mid-resize; just keep looping
          }
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
      } catch {
        if (!cancelled) setStatus("denied");
      }
    }
    start();

    return () => {
      cancelled = true;
      stop();
    };
  }, [onDetected]);

  const submitManual = () => {
    const code = manualCode.trim();
    if (code) onDetected(code);
  };

  return (
    <div>
      <BackBar onBack={onCancel} title="Scan barcode" />

      {status === "starting" || status === "scanning" ? (
        <Card style={{ padding: 0, overflow: "hidden", position: "relative", marginBottom: 12 }}>
          <video
            ref={videoRef}
            playsInline
            muted
            style={{ width: "100%", display: "block", background: "#000", maxHeight: 320, objectFit: "cover" }}
          />
          {status === "scanning" && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                pointerEvents: "none",
              }}
            >
              <div style={{ width: "72%", height: 100, border: `2px solid ${C.accent}`, borderRadius: 10 }} />
            </div>
          )}
        </Card>
      ) : (
        <Card style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 13, color: C.dim, margin: 0 }}>{STATUS_MESSAGE[status]}</p>
        </Card>
      )}

      <Card>
        <Field
          label="Or enter the barcode number"
          placeholder="e.g. 5000112548167"
          value={manualCode}
          inputMode="numeric"
          onChange={(e) => setManualCode(e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submitManual();
            }
          }}
        />
        <Btn onClick={submitManual} disabled={!manualCode.trim()} style={{ width: "100%" }}>
          Look up
        </Btn>
      </Card>
    </div>
  );
}
