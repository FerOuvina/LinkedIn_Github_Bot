import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "web", "src");

describe("hosted setup view", () => {
  const source = readFileSync(path.join(WEB, "components", "StaticSetup.jsx"), "utf8");

  it("lists the steps", () => {
    for (const title of [
      "Check your machine",
      "Clone and install",
      "Add your API credentials",
      "Connect LinkedIn",
      "Save your credentials",
      "Verify, then try a post",
    ]) {
      expect(source).toContain(title);
    }
  });

  it("mentions the prerequisites the interactive wizard checks for", () => {
    expect(source).toContain("gh auth login");
    expect(source).toContain("Node.js 20 or newer");
  });

  it("never calls the setup server", () => {
    // A read-only view that fetches /api would show errors on Pages.
    expect(source).not.toContain("/api/");
    expect(source).not.toContain("api.health");
    expect(source).not.toContain("api.preflight");
    expect(source).not.toContain("api.save");
    expect(source).not.toContain("api.dryRun");
  });

  it("has no inputs, buttons that write, or fetch calls", () => {
    expect(source).not.toMatch(/<input/);
    expect(source).not.toMatch(/type="password"/);
    expect(source).not.toMatch(/<form/);
    expect(source).not.toMatch(/fetch\(/);
  });

  it("offers no way to save or connect anything", () => {
    expect(source).not.toContain("Connect LinkedIn</button>");
    expect(source).not.toMatch(/Save credentials<\/button>/);
  });

  it("explains why it is read-only", () => {
    expect(source).toContain("read-only");
    expect(source).toContain("npm run setup");
  });
});

describe("mode selection", () => {
  const app = readFileSync(path.join(WEB, "App.jsx"), "utf8");
  const mode = readFileSync(path.join(WEB, "context", "ModeContext.jsx"), "utf8");

  it("shows the wizard only when the setup server answers", () => {
    expect(app).toContain('<Route path="/getting-started">');
    expect(app).toContain('mode === "local"');
    expect(app).toContain("<StaticSetup />");
  });

  it("falls back to the hosted view rather than rendering an error", () => {
    expect(mode).toContain('"hosted"');
    expect(mode).toContain('"local"');
  });

  it("does not wait forever on a server that is not there", () => {
    // Pages has no API, so the fallback must not depend on it responding.
    expect(mode).toMatch(/setTimeout/);
  });
});
