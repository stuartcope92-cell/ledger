import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./queryClient";
import App from "./App";
import { applyTheme, getStoredTheme } from "./theme";
import "./index.css";

// Applied before first paint (not inside a component) so there's no flash
// of the wrong theme. No stored preference yet: follow the OS setting,
// defaulting to dark (the app's original look) if that's unavailable too.
applyTheme(
  getStoredTheme() ??
    (window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark"),
);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);

// Offline app-shell + installability. Skipped in dev — a service worker
// caching responses fights Vite's HMR.
const env = (import.meta as { env?: Record<string, string | boolean | undefined> }).env;
if ("serviceWorker" in navigator && env?.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${env.BASE_URL}sw.js`).catch(() => {});
  });
}
