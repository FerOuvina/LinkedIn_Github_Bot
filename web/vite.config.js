import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { lingui } from "@lingui/vite-plugin";

// Shared with the Node server so the build and the server can't disagree about
// the path the app is served from.
import { WEB_BASE } from "../scripts/webBase.js";

const API_TARGET = "http://127.0.0.1:4319";

export default defineConfig({
  base: WEB_BASE,
  plugins: [react(), lingui({ macroTransform: true })],
  // In production the Node server serves dist/ and the API from one origin,
  // so only the dev server needs to proxy.
  server: {
    port: 5173,
    proxy: {
      "/api": { target: API_TARGET, changeOrigin: false },
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
