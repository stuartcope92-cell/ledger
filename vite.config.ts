import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
// `base` must be the repo name for a GitHub Pages project site
// (https://<user>.github.io/ledger/); local dev keeps serving from "/".
// Note: `vite preview` also passes command "serve" (same as `vite dev`) —
// mode is what actually distinguishes it, since both build and preview
// default to "production" while dev defaults to "development".
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: { port: 5173 },
  base: mode === "production" ? "/ledger/" : "/",
}));
