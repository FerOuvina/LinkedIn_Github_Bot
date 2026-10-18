import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const API_TARGET = "http://127.0.0.1:4319";

export default defineConfig({
  plugins: [react()],
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
