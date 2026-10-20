import { describe, it, expect, vi } from "vitest";
import { checkGh } from "../scripts/setupServer.js";

const FULL_PATH = "C:\\Program Files\\GitHub CLI\\gh.exe";
const CANDIDATES = ["gh", FULL_PATH];
const VERSION = "gh version 2.102.0 (2026-09-30)\n";

/**
 * A fake runner: PATH lookups fail, the absolute path works.
 * This is the case that looks identical to "not installed" without the
 * fallback, which is what the wizard reported.
 */
function runner({ onPathWorks = false, authed = true, absoluteWorks = true } = {}) {
  return vi.fn(async (cmd, args) => {
    const isVersion = args[0] === "--version";
    if (isVersion) {
      if (cmd === "gh") return onPathWorks ? VERSION : null;
      return absoluteWorks ? VERSION : null;
    }
    return authed ? "github.com\n  - Logged in to github.com\n" : null;
  });
}

describe("checkGh", () => {
  it("finds the CLI on PATH", async () => {
    const result = await checkGh({
      candidates: CANDIDATES,
      run: runner({ onPathWorks: true }),
      exists: () => true,
    });

    expect(result).toMatchObject({
      installed: true,
      authenticated: true,
      onPath: true,
      version: VERSION.trim(),
    });
    expect(result.path).toBeUndefined();
  });

  it("finds an installed CLI that is not on PATH", async () => {
    const result = await checkGh({
      candidates: CANDIDATES,
      run: runner({ onPathWorks: false }),
      exists: () => true,
    });

    expect(result.installed).toBe(true);
    expect(result.authenticated).toBe(true);
    // The distinction matters: the fix is to restart the terminal, not to install.
    expect(result.onPath).toBe(false);
    expect(result.path).toBe(FULL_PATH);
  });

  it("reports not installed when it is nowhere", async () => {
    const result = await checkGh({
      candidates: CANDIDATES,
      run: vi.fn(async () => null),
      exists: () => false,
    });

    expect(result).toEqual({ installed: false, authenticated: false, onPath: true });
  });

  it("reports installed but not signed in", async () => {
    const result = await checkGh({
      candidates: CANDIDATES,
      run: runner({ onPathWorks: true, authed: false }),
      exists: () => true,
    });

    expect(result.installed).toBe(true);
    expect(result.authenticated).toBe(false);
  });

  it("skips fallback paths that do not exist on disk", async () => {
    const run = runner({ onPathWorks: false });
    const result = await checkGh({
      candidates: CANDIDATES,
      run,
      exists: () => false, // nothing on disk either
    });

    expect(result.installed).toBe(false);
    // It must not try to run a path it just decided does not exist.
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("stops at the first fallback that works", async () => {
    const run = runner({ onPathWorks: false });
    await checkGh({
      candidates: CANDIDATES,
      run,
      exists: () => true,
    });

    const versionCalls = run.mock.calls.filter(([, args]) => args[0] === "--version");
    expect(versionCalls).toHaveLength(2); // gh, then the absolute path
  });

  it("checks auth status against the binary it actually used", async () => {
    const run = runner({ onPathWorks: false });
    await checkGh({ candidates: CANDIDATES, run, exists: () => true });

    const authCall = run.mock.calls.find(([, args]) => args[0] === "auth");
    expect(authCall[0]).toBe(FULL_PATH);
  });
});