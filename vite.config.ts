import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
// `base` must be the repo name for a GitHub Pages project site
// (https://<user>.github.io/ledger/); local dev keeps serving from "/".
export default defineConfig(({ command }) => ({
  plugins: [react()],
  server: { port: 5173 },
  base: command === "build" ? "/ledger/" : "/",
}));
