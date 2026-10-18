import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(path.join(ROOT, p), "utf8");

const ci = read(".github/workflows/ci.yml");
const post = read(".github/workflows/linkedin-post.yml");
const pages = read(".github/workflows/pages.yml");
const pkg = JSON.parse(read("package.json"));
const nvmrc = read(".nvmrc").trim();

const WORKFLOWS = { ci, post, pages };

describe("workflow versioning", () => {
  it.each(Object.entries(WORKFLOWS))(
    "%s pins actions/checkout to v4",
    (_name, text) => {
      expect(text).toContain("actions/checkout@v4");
      expect(text).not.toMatch(/actions\/checkout@v[123]\b/);
    }
  );

  it.each(Object.entries(WORKFLOWS))(
    "%s uses checkout@v4 for every checkout step",
    (_name, text) => {
      const checkouts = text.match(/actions\/checkout@[\w.]+/g) ?? [];
      expect(checkouts.length).toBeGreaterThan(0);
      expect(checkouts.every((c) => c === "actions/checkout@v4")).toBe(true);
    }
  );

  it("defines the Node version once, in .nvmrc", () => {
    expect(nvmrc).toMatch(/^\d+$/);
    expect(ci).toContain('node-version-file: ".nvmrc"');
    expect(post).toContain('node-version-file: ".nvmrc"');
  });

  it.each([
    ["ci", ci],
    ["post", post],
  ])("%s pins the runtime instead of drifting on a literal", (_name, text) => {
    expect(text).not.toMatch(/node-version:\s*\d/);
  });

  it("CI and production run the same Node major", () => {
    const declared = pkg.engines?.node;
    expect(declared).toMatch(/^>=\d+$/);

    const minimum = Number(declared.slice(2));
    const pinned = Number(nvmrc);

    // .nvmrc (what CI and production actually use) must satisfy engines.
    expect(pinned).toBeGreaterThanOrEqual(minimum);
  });
});

describe("dependency installation", () => {
  it.each([
    ["ci", ci],
    ["post", post],
  ])("%s uses npm ci for a reproducible install", (_name, text) => {
    expect(text).toContain("run: npm ci");
    expect(text).not.toMatch(/npm install/);
  });

  it("has a committed lockfile for npm ci to use", () => {
    expect(existsSync(path.join(ROOT, "package-lock.json"))).toBe(true);
  });
});

describe("workflow permissions", () => {
  it.each(Object.entries(WORKFLOWS))(
    "%s declares an explicit permissions block",
    (_name, text) => {
      expect(text).toMatch(/^permissions:\s*$/m);
    }
  );

  it("CI and the posting job need read-only repository access", () => {
    for (const text of [ci, post]) {
      expect(text).toMatch(/^permissions:\r?\n\s+contents: read\s*$/m);
    }
  });

  it("only the Pages job can write", () => {
    expect(pages).toMatch(/^permissions:\r?\n\s+contents: read\r?\n\s+pages: write\r?\n\s+id-token: write\s*$/m);
    expect(post).not.toContain("pages: write");
    expect(ci).not.toContain("pages: write");
  });
});

describe("pages deployment", () => {
  it("publishes a staged directory, not the whole repository", () => {
    expect(pages).toContain('path: "_site"');
    expect(pages).not.toContain('path: "."');
  });

  it("stages only the files the site actually loads", () => {
    expect(pages).toMatch(/cp index\.html privacy-policy\.md _site\//);
  });

  it("triggers only on real site files", () => {
    expect(pages).toContain('- "index.html"');
    expect(pages).toContain('- "privacy-policy.md"');
    expect(pages).not.toContain("style.css");
    expect(pages).not.toContain("assets/");
  });
});

describe("external scripts are pinned", () => {
  const html = read("index.html");
  const urls = [...html.matchAll(/https:\/\/[^'"]+\.js/g)].map((m) => m[0]);

  it("loads third-party scripts", () => {
    expect(urls.length).toBeGreaterThan(0);
  });

  it.each(urls)("pins %s to an exact version", (url) => {
    const withoutHost = url.replace(/^https:\/\/[^/]+\//, "");
    expect(withoutHost).toMatch(/@[\w.]+/);
  });
});

describe("package entry points", () => {
  it("points main at a file that exists", () => {
    expect(pkg.main).toBe("scripts/dailySummary.js");
    expect(existsSync(path.join(ROOT, pkg.main))).toBe(true);
  });

  it("exposes a start script pointing at the same entry point", () => {
    expect(pkg.scripts.start).toContain(pkg.main);
    expect(existsSync(path.join(ROOT, pkg.main))).toBe(true);
  });
});
