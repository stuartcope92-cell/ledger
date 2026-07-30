import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
// `base` must be the repo name for a GitHub Pages project site
// (https://<user>.github.io/ledger/); local dev keeps serving from "/".
// Vercel (and any other host serving from a domain root) needs "/" even in
// a production build — Vercel sets process.env.VERCEL during its builds,
// which is how we tell the two production targets apart.
// Note: `vite preview` also passes command "serve" (same as `vite dev`) —
// mode is what actually distinguishes it, since both build and preview
// default to "production" while dev defaults to "development".
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: { port: 5173, host: true },
  base: mode === "production" && !process.env.VERCEL ? "/ledger/" : "/",
}));
