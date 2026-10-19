import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WEB = path.join(ROOT, "web");
const src = path.join(WEB, "src");

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.jsx?$/.test(entry) && !/\.test\.js$/.test(entry) ? [full] : [];
  });
}

/** Icons the components ask for, whether literal, in a ternary, or as data. */
function collectUsedIcons() {
  const text = sourceFiles(src)
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");

  const found = new Set();

  // Icons written straight into the element.
  for (const m of text.matchAll(/material-symbols-outlined[^>]*>\s*([a-z_0-9]+)\s*</g)) {
    found.add(m[1]);
  }

  // Icons chosen by an expression, e.g. {isActive ? "radio_button_checked" : "x"}.
  // The sidebar nests three deep, so every literal in the element's children
  // counts. Only the children: className values sit before the tag's closing
  // ">" and would otherwise contribute "text", "flex" and friends.
  for (const m of text.matchAll(
    /material-symbols-outlined[\s\S]{0,400}?>([\s\S]{0,400}?)<\//g
  )) {
    for (const q of m[1].matchAll(/["']([a-z][a-z0-9_]{2,})["']/g)) {
      found.add(q[1]);
    }
  }

  // Icons passed in as data.
  for (const m of text.matchAll(/\["([a-z_0-9]+)",\s*"[^"]+"\]/g)) found.add(m[1]);
  for (const m of text.matchAll(/icon:\s*"([a-z_0-9]+)"/g)) found.add(m[1]);

  return found;
}

function iconNamesFrom(html) {
  const match = html.match(/icon_names=([A-Za-z0-9_,]+)/);
  if (!match) return null;
  return new Set(match[1].split(","));
}

describe("icon font", () => {
  const webIndex = readFileSync(path.join(WEB, "index.html"), "utf8");
  const privacyIndex = readFileSync(path.join(ROOT, "index.html"), "utf8");

  it("loads a restricted icon set, not the full font", () => {
    // The unrestricted variable icon font is multiple megabytes.
    for (const html of [webIndex, privacyIndex]) {
      expect(html, "icon font is not restricted to a list of icons").toContain(
        "icon_names="
      );
    }
  });

  it("restricts it to the icons actually used", () => {
    const allowed = iconNamesFrom(webIndex);
    expect(allowed, "could not read icon_names").toBeTruthy();
    expect(allowed.size).toBeLessThan(60);

    const used = collectUsedIcons();
    expect(used.size).toBeGreaterThan(10);

    // An icon missing from the list renders as its literal name instead.
    const missing = [...used].filter((icon) => !allowed.has(icon));
    expect(
      missing,
      `icons used but not in icon_names: ${missing.join(", ")}`
    ).toEqual([]);
  });

  it("gives both pages the same icon list", () => {
    const a = iconNamesFrom(webIndex);
    const b = iconNamesFrom(privacyIndex);
    expect([...a].sort()).toEqual([...b].sort());
  });
});

describe("bundle splitting", () => {
  const dist = path.join(WEB, "dist", "assets");

  it("ships a main chunk that excludes the markdown renderer", () => {
    const files = readdirSync(dist).filter((f) => f.endsWith(".js"));
    const main = files.find((f) => f.startsWith("index-"));
    expect(main, "main chunk not found").toBeTruthy();

    const source = readFileSync(path.join(dist, main), "utf8");
    expect(source).not.toContain("DOMPurify");
  });

  it("puts the guide in its own chunk", () => {
    const files = readdirSync(dist).filter((f) => f.endsWith(".js"));
    expect(files.some((f) => f.startsWith("Guide-"))).toBe(true);
  });

  it("loads the guide lazily", () => {
    const app = readFileSync(path.join(src, "App.jsx"), "utf8");
    expect(app).toContain("lazy(() => import(");
    expect(app).toContain("<Suspense");
    // The static import would defeat the split.
    expect(app).not.toMatch(/^import Guide from/m);
  });
});
