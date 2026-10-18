import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const privacyPage = readFileSync(path.join(ROOT, "index.html"), "utf8");
const css = readFileSync(path.join(ROOT, "web", "src", "index.css"), "utf8");
const tailwind = readFileSync(path.join(ROOT, "web", "tailwind.config.js"), "utf8");
const webIndex = readFileSync(path.join(ROOT, "web", "index.html"), "utf8");

const PALETTE = ["#ff2e88", "#00e5ff", "#ccff00", "#07070a", "#101017", "#26262f"];

describe("privacy policy page", () => {
  it("uses the same palette as the app", () => {
    for (const colour of PALETTE) {
      expect(privacyPage, `privacy page is missing ${colour}`).toContain(colour);
      expect(tailwind, `app theme is missing ${colour}`).toContain(colour);
    }
  });

  it("uses the same fonts", () => {
    for (const font of ["Archivo Black", "Space Grotesk", "JetBrains Mono"]) {
      expect(privacyPage).toContain(font.split(" ")[0]);
      expect(webIndex).toContain(font.split(" ")[0]);
    }
  });

  it("renders markdown and sanitises it, like the in-app guide", () => {
    expect(privacyPage).toContain("marked@15.0.12");
    expect(privacyPage).toContain("dompurify@3.4.17");
    expect(privacyPage).toContain("DOMPurify.sanitize");
  });

  it("pins its CDN scripts to exact versions", () => {
    const urls = [...privacyPage.matchAll(/cdn\.jsdelivr\.net\/npm\/([^/"]+)\//g)].map(
      (m) => m[1]
    );
    expect(urls.length).toBeGreaterThan(0);
    for (const entry of urls) {
      expect(entry, `${entry} is unpinned`).toMatch(/@[\d.]+$/);
    }
  });

  it("has the same scanline treatment as the app", () => {
    expect(privacyPage).toContain("repeating-linear-gradient");
    expect(css).toContain("scanlines");
  });

  it("links back to the site root", () => {
    expect(privacyPage).toContain('href="../"');
  });

  it("still loads the policy markdown next to it", () => {
    expect(privacyPage).toContain("privacy-policy.md");
  });
});

describe("design system", () => {
  it("defines the shared component classes", () => {
    for (const name of [".panel", ".card", ".btn", ".ff-input", ".glitch", ".ff-display"]) {
      expect(css).toContain(name);
    }
  });

  it("ships the marquee and glitch animations", () => {
    expect(tailwind).toContain("marquee");
    expect(css).toContain("glitch");
  });

  it("respects reduced motion", () => {
    expect(css).toContain("prefers-reduced-motion");
    expect(privacyPage).toContain("prefers-reduced-motion") ||
      expect(privacyPage).toContain("blink");
  });

  it("no component still uses the old light-mode theme", async () => {
    const { readdirSync } = await import("node:fs");
    const dir = path.join(ROOT, "web", "src", "components");
    const files = readdirSync(dir).filter((f) => f.endsWith(".jsx"));

    for (const file of files) {
      const source = readFileSync(path.join(dir, file), "utf8");
      expect(source, `${file} still has light-mode classes`).not.toMatch(
        /bg-background-light|dark:bg-background-dark|dark:border-border-dark/
      );
    }
  });
});
