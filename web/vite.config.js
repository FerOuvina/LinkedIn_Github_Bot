import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { lingui } from "@lingui/vite-plugin";

// Shared with the Node server so the build and the server can't disagree about
// the path the app is served from.
import { stripBase, WEB_BASE } from "../scripts/webBase.js";
import {
  PRIVACY_PREFIX,
  privacyContentType,
  resolvePrivacyFile,
} from "../scripts/privacyPage.js";

const API_TARGET = "http://127.0.0.1:4319";
const repoRoot = fileURLToPath(new URL("..", import.meta.url));

/** Serve the root privacy page in dev, before Vite's SPA fallback. */
function privacyPagePlugin() {
  return {
    name: "privacy-page",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url) return next();

        const url = new URL(req.url, "http://localhost");
        const pathname = stripBase(url.pathname, WEB_BASE);

        if (pathname === PRIVACY_PREFIX) {
          res.writeHead(302, { Location: `${url.pathname}/${url.search}` });
          res.end();
          return;
        }

        if (!pathname.startsWith(`${PRIVACY_PREFIX}/`)) return next();

        const file = resolvePrivacyFile(pathname);
        const target = file ? path.join(repoRoot, file) : null;

        if (!target || !existsSync(target) || !statSync(target).isFile()) {
          res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("Not found");
          return;
        }

        res.writeHead(200, { "Content-Type": privacyContentType(file) });
        res.end(readFileSync(target));
      });
    },
  };
}

export default defineConfig({
  base: WEB_BASE,
  plugins: [privacyPagePlugin(), react(), lingui({ macroTransform: true })],
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
