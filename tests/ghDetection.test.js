import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(path.join(ROOT, p), "utf8");

const step = read("web/src/components/steps/StepPrerequisites.jsx");
const server = read("scripts/setupServer.js");

describe("github cli detection", () => {
  it("looks beyond PATH for the usual Windows install locations", () => {
    expect(server).toContain("GitHub CLI");
    expect(server).toContain("WinGet");
    expect(server).toContain('"gh.exe"');
  });

  it("does not claim the CLI is missing when it is merely off PATH", () => {
    // installed-but-off-PATH needs "restart your terminal", not "install it".
    expect(server).toContain("onPath");
    expect(step).toContain("not on your path");
    expect(step).toContain("gh.path");
  });

  it("distinguishes not-installed from not-signed-in", () => {
    expect(step).toContain("github cli not installed");
    expect(step).toContain("github cli not signed in");
    expect(step).toContain("gh auth login");
  });
});

describe("the summary panel is honest", () => {
  it("does not claim everything is ready while something is outstanding", () => {
    expect(step).toContain("still to do");
    expect(step).toContain("everything is ready");
  });

  it("treats an unusable CLI as outstanding, even with no env problems", () => {
    // The old message said "All required variables are present" while the CLI
    // check was failing, which read as all-clear.
    expect(step).toContain("!gh?.installed");
    expect(step).toContain("!gh.onPath");
    expect(step).toContain("!gh.authenticated");
    expect(step).not.toContain("All required variables are present");
  });

  it("lists what is missing rather than only counting it", () => {
    expect(step).toContain("health.envMissing.join");
  });

  it("explains that continuing is allowed but saving is not", () => {
    expect(step).toContain("continue anyway");
  });
});