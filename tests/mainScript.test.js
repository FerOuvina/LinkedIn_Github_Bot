import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const REPO_LIST = [
  { name: "alpha", owner: { login: "me" } },
  { name: "beta", owner: { login: "me" } },
];

function commit(message) {
  return { commit: { message: `${message}\n\nbody ignored` } };
}

function jsonResponse(data, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
  };
}

/** Route fetch calls to canned GitHub/HF responses and record the calls. */
function mockFetch(handlers) {
  const calls = [];
  vi.stubGlobal("fetch", async (url, options = {}) => {
    calls.push({ url: String(url), options });
    const handler = handlers(String(url));
    if (!handler) throw new Error(`Unmocked fetch: ${url}`);
    return handler;
  });
  return calls;
}

async function loadRun({ dryRun }) {
  vi.resetModules();
  const argv = process.argv;
  process.argv = dryRun ? [...argv, "--dry-run"] : argv;
  try {
    const mod = await import("../scripts/mainScript.js");
    return mod.default;
  } finally {
    process.argv = argv;
  }
}

function githubHandlers(commitsByRepo) {
  return (url) => {
    if (url.includes("/users/") && url.includes("/repos")) {
      return jsonResponse(REPO_LIST);
    }
    const commitsMatch = url.match(/repos\/me\/([^/]+)\/commits/);
    if (commitsMatch) {
      return jsonResponse(commitsByRepo[commitsMatch[1]] ?? []);
    }
    if (url.includes("router.huggingface.co")) {
      return jsonResponse({ choices: [{ message: { content: "AI post body" } }] });
    }
    if (url.includes("api.linkedin.com")) {
      return jsonResponse({}, true, 201);
    }
    return null;
  };
}

describe("run()", () => {
  let logSpy;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns early when the account had no activity", async () => {
    mockFetch(githubHandlers({}));
    const run = await loadRun({ dryRun: true });

    const result = await run();

    expect(result).toBe("no-activity");
    expect(logSpy).toHaveBeenCalledWith(
      "No commits today — nothing to post."
    );
  });

  it("returns early when every commit scores below the threshold", async () => {
    mockFetch(githubHandlers({ alpha: [commit("chore: bump deps")] }));
    const run = await loadRun({ dryRun: true });

    const result = await run();

    expect(result).toBe("no-significant-commits");
    expect(logSpy).toHaveBeenCalledWith(
      "No significant commits to post today."
    );
  });

  it("sends scored commits to the LLM and prints the post on --dry-run", async () => {
    const calls = mockFetch(
      githubHandlers({
        alpha: [commit("feat: add auth"), commit("chore: bump deps")],
        beta: [commit("fix: login crash")],
      })
    );
    const run = await loadRun({ dryRun: true });

    const result = await run();

    expect(result).toBe("dry-run");

    const hfCall = calls.find((c) => c.url.includes("router.huggingface.co"));
    expect(hfCall).toBeDefined();

    const sent = JSON.parse(hfCall.options.body).messages[1].content;
    expect(sent).toContain("alpha: feat: add auth");
    expect(sent).toContain("beta: fix: login crash");
    expect(sent).not.toContain("chore: bump deps");
    expect(sent).not.toContain("body ignored");

    const printed = logSpy.mock.calls.flat().join("\n");
    expect(printed).toContain("AI post body");
    expect(printed).toContain("My GitHub");

    // dry run must never hit LinkedIn
    expect(calls.some((c) => c.url.includes("api.linkedin.com"))).toBe(false);
  });

  it("publishes to LinkedIn when not in dry-run mode", async () => {
    const calls = mockFetch(
      githubHandlers({ alpha: [commit("feat: add auth")] })
    );
    const run = await loadRun({ dryRun: false });

    const result = await run();

    expect(result).toBe("published");

    const liCall = calls.find((c) => c.url.includes("api.linkedin.com/v2/ugcPosts"));
    expect(liCall).toBeDefined();

    const body = JSON.parse(liCall.options.body);
    expect(body.lifecycleState).toBe("PUBLISHED");
    expect(
      body.specificContent["com.linkedin.ugc.ShareContent"].shareCommentary.text
    ).toContain("AI post body");
    expect(logSpy).toHaveBeenCalledWith("LinkedIn post published.");
  });

  it("fetches each repo's commits exactly once", async () => {
    const calls = mockFetch(
      githubHandlers({
        alpha: [commit("feat: add auth")],
        beta: [commit("fix: login crash")],
      })
    );
    const run = await loadRun({ dryRun: true });

    await run();

    const commitCalls = calls.filter((c) =>
      c.url.includes("/repos/me/") && c.url.includes("/commits")
    );
    expect(commitCalls).toHaveLength(2);
    expect(
      calls.filter((c) => c.url.includes("/users/") && c.url.includes("/repos"))
    ).toHaveLength(1);
  });

  it("never re-sends the LinkedIn POST when it fails", async () => {
    const calls = mockFetch((url) => {
      const handlers = githubHandlers({ alpha: [commit("feat: add auth")] });
      if (url.includes("api.linkedin.com")) return jsonResponse({ error: "nope" }, false, 500);
      return handlers(url);
    });
    const run = await loadRun({ dryRun: false });

    await expect(run()).rejects.toThrow();

    const liCalls = calls.filter((c) => c.url.includes("api.linkedin.com"));
    expect(liCalls).toHaveLength(1);
  });

  it("throws when the LLM call fails", async () => {
    mockFetch((url) => {
      const handlers = githubHandlers({ alpha: [commit("feat: add auth")] });
      if (url.includes("router.huggingface.co")) {
        return jsonResponse({ error: "boom" }, false, 500);
      }
      return handlers(url);
    });
    const run = await loadRun({ dryRun: true });

    await expect(run()).rejects.toThrow(/boom/);
  });
});
