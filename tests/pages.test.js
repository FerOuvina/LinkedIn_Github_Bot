import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stripBase, WEB_BASE } from "../scripts/webBase.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(path.join(ROOT, p), "utf8");

describe("stripBase", () => {
  const base = "/LinkedIn_Github_Boot/";

  it("strips the Pages prefix", () => {
    expect(stripBase("/LinkedIn_Github_Boot/guide", base)).toBe("/guide");
    expect(stripBase("/LinkedIn_Github_Boot/assets/app.js", base)).toBe("/assets/app.js");
  });

  it("handles the bare base path", () => {
    expect(stripBase("/LinkedIn_Github_Boot", base)).toBe("/");
  });

  it("leaves root-served paths untouched, for the local server", () => {
    expect(stripBase("/api/health", base)).toBe("/api/health");
    expect(stripBase("/", base)).toBe("/");
  });

  it("does not strip a lookalike prefix", () => {
    expect(stripBase("/LinkedIn_Github_Boot-other/x", base)).toBe(
      "/LinkedIn_Github_Boot-other/x"
    );
  });

  it("is a no-op when served from a domain root", () => {
    expect(stripBase("/guide", "/")).toBe("/guide");
  });
});

describe("web base configuration", () => {
  it("defaults to the repository's Pages path", () => {
    expect(WEB_BASE).toBe("/LinkedIn_Github_Boot/");
  });

  it("keeps the vite build and the server on the same value", () => {
    const vite = read("web/vite.config.js");
    expect(vite).toContain("WEB_BASE");
    expect(vite).not.toMatch(/base:\s*["']\//);
  });

  it("builds every asset URL relative to the base", () => {
    const html = read("web/dist/index.html");
    const assets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
      .map((m) => m[1])
      .filter((u) => u.startsWith("/"));

    expect(assets.length).toBeGreaterThan(0);
    for (const asset of assets) {
      expect(asset.startsWith(WEB_BASE)).toBe(true);
    }
  });

  it("uses the base for API and docs calls too", () => {
    const api = read("web/src/lib/api.js");
    expect(api).toContain("import.meta.env.BASE_URL");
    expect(api).not.toContain('fetch("/api/');
  });
});

describe("pages deployment", () => {
  const pages = read(".github/workflows/pages.yml");

  it("builds the app rather than deploying the committed dist", () => {
    expect(pages).toContain("working-directory: web");
    expect(pages).toMatch(/run: npm run build/);
    expect(pages).toContain("npm ci");
  });

  it("ships the guides so the deployed app can render them", () => {
    expect(pages).toMatch(/cp -r docs\/\. _site\/docs\//);
  });

  it("keeps the privacy policy on its own page", () => {
    expect(pages).toContain("_site/privacy-policy/index.html");
    expect(pages).toContain("privacy-policy.md");
  });

  it("never publishes repository source or dependencies", () => {
    expect(pages).toMatch(/rm -rf[^\n]*_site\/scripts/);
    expect(pages).toMatch(/rm -rf[^\n]*_site\/tests/);
    expect(pages).toMatch(/rm -rf[^\n]*_site\/node_modules/);
  });

  it("deploys the staged directory, not the repository", () => {
    expect(pages).toContain('path: "_site"');
    expect(pages).not.toContain('path: "."');
  });
});
