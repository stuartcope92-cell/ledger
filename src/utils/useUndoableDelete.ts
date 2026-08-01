// ── Undo-after-delete ────────────────────────────────────────────
// Delete doesn't hit the network immediately: the item is hidden from view
// and a timer starts. Undo cancels the timer with no network call ever
// made; letting it expire commits the real delete. Shared across
// meals/workouts/cardio so each screen only needs to filter its list by
// `pendingId` and render one <UndoToast>.
import { useCallback, useRef, useState } from "react";

const UNDO_WINDOW_MS = 5000;

export function useUndoableDelete(onCommit: (id: string) => Promise<void>) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const commitPending = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const requestDelete = useCallback(
    (id: string) => {
      // A second delete before the first's undo window closes commits the
      // first immediately rather than losing track of it.
      if (timerRef.current) {
        const prevId = pendingId;
        commitPending();
        if (prevId) void onCommit(prevId);
      }
      setPendingId(id);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        setPendingId(null);
        void onCommit(id);
      }, UNDO_WINDOW_MS);
    },
    [commitPending, onCommit, pendingId],
  );

  const undo = useCallback(() => {
    commitPending();
    setPendingId(null);
  }, [commitPending]);

  return { pendingId, requestDelete, undo };
}
