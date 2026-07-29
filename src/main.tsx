import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
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
