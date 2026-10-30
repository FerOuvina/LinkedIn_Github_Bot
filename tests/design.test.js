import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const privacyPage = readFileSync(path.join(ROOT, "index.html"), "utf8");
const css = readFileSync(path.join(ROOT, "web", "src", "index.css"), "utf8");
const tailwind = readFileSync(path.join(ROOT, "web", "tailwind.config.js"), "utf8");
const webIndex = readFileSync(path.join(ROOT, "web", "index.html"), "utf8");

const PALETTE = ["void", "panel", "shell", "edge", "bone", "ash", "primary", "crimson", "cyan", "acid"];

function paletteValue(source, name) {
  const hex = source.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, "i"));
  if (hex) return hex[1].toLowerCase();

  const rgb = source.match(
    new RegExp(`--${name}:\\s*(\\d+)\\s+(\\d+)\\s+(\\d+)`, "i")
  );
  if (!rgb) return null;

  return `#${rgb
    .slice(1, 4)
    .map((channel) => Number(channel).toString(16).padStart(2, "0"))
    .join("")}`;
}

describe("privacy policy page", () => {
  it("uses the same palette as the app", () => {
    for (const name of PALETTE) {
      expect(
        paletteValue(privacyPage, name),
        `privacy page is missing --${name}`
      ).toBeTruthy();
      expect(
        paletteValue(css, name),
        `app theme is missing --${name}`
      ).toBe(paletteValue(privacyPage, name));
    }
  });

  it("offers a light palette and remembers the choice", () => {
    for (const source of [css, privacyPage]) {
      expect(source).toContain(':root[data-theme="light"]');
    }

    for (const source of [privacyPage, webIndex]) {
      expect(source).toContain('localStorage.getItem("theme")');
    }

    expect(css).toContain("--void: 246 241 232");
    expect(privacyPage).toContain("--void: #f6f1e8");
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

  it("strips the markdown's own title so the page shows one heading", () => {
    const policy = readFileSync(path.join(ROOT, "privacy-policy.md"), "utf8");

    // The markdown starts with its own "# Privacy Policy".
    expect(policy.trimStart()).toMatch(/^#\s/);

    // Pull the regex the page actually ships, rather than restating it here.
    const literal = privacyPage.match(
      /markdown\.replace\((\/\^\\s\*#[\s\S]*?\/[a-z]*)/
    );
    expect(literal, "could not find the title-stripping regex in the page").toBeTruthy();

    const lastSlash = literal[1].lastIndexOf("/");
    const re = new RegExp(literal[1].slice(1, lastSlash), literal[1].slice(lastSlash + 1));

    const stripped = policy.replace(re, "");
    expect(stripped.trimStart()).not.toMatch(/^#\s/);
    // The body must survive, otherwise the page would render nothing.
    expect(stripped.trim().length).toBeGreaterThan(50);
    expect(stripped).toContain("Data Storage");
  });

  it("renders exactly one page title", () => {
    const h1s = [...privacyPage.matchAll(/<h1[^>]*>/g)];
    expect(h1s).toHaveLength(1);
  });

  it("keeps the header slim", () => {
    // It was eating a large part of the viewport at 4rem.
    const height = privacyPage.match(/\.bar\s*\{[^}]*height:\s*([\d.]+)rem/);
    expect(height, "header height not found").toBeTruthy();
    expect(Number(height[1])).toBeLessThanOrEqual(3.5);
  });

  it("keeps the page title small enough to read", () => {
    const size = privacyPage.match(/h1\s*\{[\s\S]*?font-size:\s*clamp\([^,]+,\s*[^,]+,\s*([\d.]+)rem\)/);
    expect(size, "title size not found").toBeTruthy();
    expect(Number(size[1])).toBeLessThanOrEqual(3);
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
