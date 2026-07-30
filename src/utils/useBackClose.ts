// ── Hardware/browser back-button integration for stacked sub-views ─────
// The app has no router, so nested screens (add-exercise flow, routine
// creator, photo compare, etc.) are just React state toggles — the browser
// has nothing in its history to go back to, so a mobile back gesture
// exits/minimizes the whole app instead of closing the topmost view. This
// hook fixes that: it pushes one history entry per open view onto a
// shared logical stack, and a single global popstate listener pops the
// topmost one and calls its close handler. Falls through to native
// back/minimize behavior once the stack is empty (i.e. at the true root).
import { useEffect, useRef } from "react";

type CloseFn = () => void;

const stack: CloseFn[] = [];
let suppressCount = 0;
let listenerAttached = false;

function ensureListener(): void {
  if (listenerAttached) return;
  listenerAttached = true;
  window.addEventListener("popstate", () => {
    // A pop we triggered ourselves (see `release` below) to keep the
    // browser history and our logical stack in sync after a non-back-
    // button close (Save, a Back button tap, etc.) — not a real
    // navigation, so don't treat it as one.
    if (suppressCount > 0) {
      suppressCount--;
      return;
    }
    const top = stack.pop();
    if (top) top();
  });
}

// Registers `onClose` as the topmost back-able view. Returns a `release`
// function: call it when the view closes through any means other than the
// back button, so the pushed history entry gets consumed without
// triggering any other (still-open, lower) view's close handler.
function pushBackable(onClose: CloseFn): () => void {
  ensureListener();
  stack.push(onClose);
  window.history.pushState({ ledgerBack: true }, "");
  return () => {
    const idx = stack.lastIndexOf(onClose);
    if (idx === -1) return; // already consumed via a real popstate
    stack.splice(idx, 1);
    suppressCount++;
    window.history.back();
  };
}

// Wires a sub-view up to the back button while `active`. `onClose` is
// whatever already closes the view (e.g. the function passed to BackBar) —
// no change needed at the call site beyond passing it here too.
export function useBackClose(active: boolean, onClose: () => void): void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!active) return;
    const release = pushBackable(() => onCloseRef.current());
    return release;
  }, [active]);
}
