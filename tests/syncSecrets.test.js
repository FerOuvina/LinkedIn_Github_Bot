import { describe, it, expect, vi } from "vitest";
import { syncSecrets, planSecrets, formatSyncResult, REQUIRED_SECRETS } from "../scripts/syncSecrets.js";

const FULL_ENV = {
  HUB_USER: "octocat",
  GITHUB_TOKEN: "gh-secret-value",
  LINKEDIN_ACCESS_TOKEN: "li-secret-value",
  LINKEDIN_AUTHOR_URN: "urn:li:person:abc",
  GROQ_API_KEY: "gsk-secret-value",
  GROQ_MODEL: "zai-org/GLM-5.3-Flash",
};

/** Fake gh: records every invocation without touching the real CLI. */
function fakeGh({ available = true, failOn } = {}) {
  const calls = [];
  const runCmd = vi.fn(async (cmd, args = [], opts = {}) => {
    calls.push({ cmd, args, input: opts.input });
    if (!available) throw new Error("spawn gh ENOENT");
    if (failOn && args.includes(failOn)) {
      throw Object.assign(new Error("exit 1"), { stderr: "HTTP 404: Not Found" });
    }
    return { stdout: "", stderr: "" };
  });
  return { runCmd, calls };
}

describe("planSecrets", () => {
  it("lists what would be set without leaking values", () => {
    const plan = planSecrets(FULL_ENV);

    expect(plan.set).toEqual(["HUB_USER", "GITHUB_TOKEN", "LINKEDIN_ACCESS_TOKEN", "LINKEDIN_AUTHOR_URN", "GROQ_API_KEY", "GROQ_MODEL"]);
    expect(JSON.stringify(plan)).not.toContain("li-secret-value");
    expect(JSON.stringify(plan)).not.toContain("gh-secret-value");
  });

  it("treats every required secret as required", () => {
    const plan = planSecrets({});
    expect([...plan.missing].sort()).toEqual([...REQUIRED_SECRETS].sort());
    expect(plan.set).toEqual([]);
  });

  it("does not require optional secrets", () => {
    const plan = planSecrets(FULL_ENV);
    expect(plan.missing).toEqual([]);
    expect(plan.skipped).toContain("LINKEDIN_REFRESH_TOKEN");
  });
});

describe("syncSecrets", () => {
  it("writes nothing on a dry run", async () => {
    const { runCmd, calls } = fakeGh();
    const result = await syncSecrets({ env: FULL_ENV, dryRun: true, runCmd });

    expect(result.applied).toBe(false);
    expect(result.set.length).toBeGreaterThan(0);
    expect(calls).toHaveLength(0);
    expect(runCmd).not.toHaveBeenCalled();
  });

  it("refuses to run when required values are missing", async () => {
    const { runCmd } = fakeGh();
    const result = await syncSecrets({ env: { HUB_USER: "octocat" }, dryRun: false, runCmd });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("missing");
    expect(runCmd).not.toHaveBeenCalled();
  });

  it("explains how to fix a missing GitHub CLI", async () => {
    const { runCmd } = fakeGh({ available: false });
    const result = await syncSecrets({ env: FULL_ENV, dryRun: false, runCmd });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("gh-missing");
    expect(formatSyncResult(result)).toContain("gh auth login");
  });

  it("pushes each secret over stdin, never on the command line", async () => {
    const { runCmd, calls } = fakeGh();
    const result = await syncSecrets({ env: FULL_ENV, dryRun: false, runCmd });

    expect(result.applied).toBe(true);

    const secretCalls = calls.filter((c) => c.args[0] === "secret");
    expect(secretCalls.length).toBeGreaterThan(0);

    for (const call of secretCalls) {
      expect(call.cmd).toBe("gh");
      expect(call.args.slice(0, 2)).toEqual(["secret", "set"]);
      // The secret value must not appear in argv.
      expect(call.args.join(" ")).not.toContain("li-secret-value");
      expect(call.args).not.toContain("--body");
    }

    const tokenCall = secretCalls.find((c) => c.args[2] === "LINKEDIN_ACCESS_TOKEN");
    expect(tokenCall.input).toBe("li-secret-value");
  });

  it("passes --repo through when given", async () => {
    const gh = fakeGh();
    await syncSecrets({ env: FULL_ENV, dryRun: false, runCmd: gh.runCmd, repo: "octocat/repo" });

    const secretCalls = gh.calls.filter((c) => c.args[0] === "secret");
    expect(secretCalls.length).toBeGreaterThan(0);
    for (const call of secretCalls) {
      expect(call.args).toContain("--repo");
      expect(call.args).toContain("octocat/repo");
    }
  });

  it("omits --repo when none is given", async () => {
    const gh = fakeGh();
    await syncSecrets({ env: FULL_ENV, dryRun: false, runCmd: gh.runCmd });

    for (const call of gh.calls.filter((c) => c.args[0] === "secret")) {
      expect(call.args).not.toContain("--repo");
    }
  });

  it("reports which secret failed without echoing the value", async () => {
    const { runCmd } = fakeGh({ failOn: "GROQ_API_KEY" });
    const result = await syncSecrets({ env: FULL_ENV, dryRun: false, runCmd });

    expect(result.ok).toBe(false);
    expect(result.failedSecret).toBe("GROQ_API_KEY");
    expect(formatSyncResult(result)).not.toContain("gsk-secret-value");
  });

  it("skips optional secrets that have no value", async () => {
    const gh = fakeGh();
    const result = await syncSecrets({ env: FULL_ENV, dryRun: false, runCmd: gh.runCmd });

    expect(result.written).not.toContain("LINKEDIN_REFRESH_TOKEN");
    expect(gh.calls.map((c) => c.args[2])).not.toContain("LINKEDIN_REFRESH_TOKEN");
  });
});

describe("formatSyncResult", () => {
  it("lists names only for a dry run", () => {
    const out = formatSyncResult(planSecrets(FULL_ENV));
    expect(out).toContain("Would set 6 secret(s)");
    expect(out).toContain("HUB_USER");
    expect(out).not.toContain("octocat");
  });

  it("confirms a real write", async () => {
    const { runCmd } = fakeGh();
    const out = formatSyncResult(await syncSecrets({ env: FULL_ENV, dryRun: false, runCmd }));
    expect(out).toContain("Set 6 secret(s)");
  });
});
