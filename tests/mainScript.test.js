import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

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

const SCHEDULED_CONFIG = {
  languages: ["en", "es"],
  gapMinutes: 5,
  timezone: "UTC",
  days: [1, 2, 3, 4, 5],
  times: { en: "09:00", es: "18:00" },
  crons: { en: "0 9 * * 1-5", es: "0 18 * * 1-5" },
};

function tempConfig(config = SCHEDULED_CONFIG) {
  const dir = mkdtempSync(path.join(tmpdir(), "run-config-"));
  const file = path.join(dir, "post.config.json");
  writeFileSync(file, JSON.stringify(config), "utf8");
  return { file, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

/** The shared window query from the first commits request. */
function commitWindow(calls) {
  const url = calls.find((call) => call.url.includes("/commits?"))?.url;
  return url?.match(/since=[^&]+&until=[^&]+/)?.[0] ?? null;
}

function githubHandlers(commitsByRepo, llmContent = "AI post body") {
  return (url) => {
    if (url.includes("/users/") && url.includes("/repos")) {
      return jsonResponse(REPO_LIST);
    }
    const commitsMatch = url.match(/repos\/me\/([^/]+)\/commits/);
    if (commitsMatch) {
      return jsonResponse(commitsByRepo[commitsMatch[1]] ?? []);
    }
    if (url.includes("api.groq.com")) {
      return jsonResponse({ choices: [{ message: { content: llmContent } }] });
    }
    if (url.includes("api.linkedin.com")) {
      return jsonResponse({}, true, 201);
    }
    return null;
  };
}

describe("run()", () => {
  let logSpy;
  const ORIGINAL = {
    languages: process.env.POST_LANGUAGES,
    gap: process.env.POST_GAP_MINUTES,
    language: process.env.POST_LANGUAGE,
    cron: process.env.SCHEDULE_CRON,
  };

  beforeEach(() => {
    // Keep the committed post.config.json out of the tests unless a test
    // deliberately asks for more than one language.
    process.env.POST_LANGUAGES = "en";
    delete process.env.POST_GAP_MINUTES;
    delete process.env.POST_LANGUAGE;
    delete process.env.SCHEDULE_CRON;

    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();

    for (const [key, value] of [
      ["POST_LANGUAGES", ORIGINAL.languages],
      ["POST_GAP_MINUTES", ORIGINAL.gap],
      ["POST_LANGUAGE", ORIGINAL.language],
      ["SCHEDULE_CRON", ORIGINAL.cron],
    ]) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
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

    const hfCall = calls.find((c) => c.url.includes("api.groq.com"));
    expect(hfCall).toBeDefined();

    const sent = JSON.parse(hfCall.options.body).messages[1].content;
    expect(sent).toContain("alpha: feat: add auth");
    expect(sent).toContain("beta: fix: login crash");
    expect(sent).toContain("https://github.com/me/alpha");
    expect(sent).toContain("https://github.com/me/beta");
    expect(sent).not.toContain("chore: bump deps");
    expect(sent).not.toContain("body ignored");

    const printed = logSpy.mock.calls.flat().join("\n");
    expect(printed).toContain("AI post body");
    expect(printed).not.toContain("My GitHub");

    // dry run must never hit LinkedIn
    expect(calls.some((c) => c.url.includes("api.linkedin.com"))).toBe(false);
  });

  it("rewrites a hallucinated repository link to the real one", async () => {
    mockFetch(
      githubHandlers(
        { alpha: [commit("feat: add auth")] },
        "See https://github.com/me/wrong-repo"
      )
    );
    const run = await loadRun({ dryRun: true });

    await run();

    const printed = logSpy.mock.calls.flat().join("\n");
    expect(printed).toContain("https://github.com/me/alpha");
    expect(printed).not.toContain("https://github.com/me/wrong-repo");
  });

  it("adds links the model left out for any repository in the commits", async () => {
    mockFetch(
      githubHandlers({
        alpha: [commit("feat: add auth")],
        beta: [commit("fix: login crash")],
      })
    );
    const run = await loadRun({ dryRun: true });

    await run();

    const printed = logSpy.mock.calls.flat().join("\n");
    expect(printed).toContain("Repositories:");
    expect(printed).toContain("https://github.com/me/alpha");
    expect(printed).toContain("https://github.com/me/beta");
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
    expect(logSpy).toHaveBeenCalledWith("LinkedIn post published in English.");
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
      if (url.includes("api.groq.com")) {
        return jsonResponse({ error: "boom" }, false, 500);
      }
      return handlers(url);
    });
    const run = await loadRun({ dryRun: true });

    await expect(run()).rejects.toThrow(/boom/);
  });

  it("uses the committed prompt template and replaces placeholders", async () => {
    process.env.HUB_USER = "octocat";
    const calls = mockFetch(
      githubHandlers({ alpha: [commit("feat: add auth")] })
    );
    const run = await loadRun({ dryRun: true });
    await run();

    const hfCall = calls.find((c) => c.url.includes("api.groq.com"));
    const sent = JSON.parse(hfCall.options.body).messages[1].content;

    expect(sent).toContain("You are a thoughtful software engineer");
    expect(sent).toContain("alpha: feat: add auth");
    expect(sent).not.toContain("{commits}");
    expect(sent).not.toContain("{hubUser}");
  });

  it("asks for the post in English by default", async () => {
    const calls = mockFetch(
      githubHandlers({ alpha: [commit("feat: add auth")] })
    );
    const run = await loadRun({ dryRun: true });
    await run();

    const hfCall = calls.find((c) => c.url.includes("api.groq.com"));
    const sent = JSON.parse(hfCall.options.body).messages[1].content;

    expect(sent.startsWith("Write the LinkedIn post in English.")).toBe(true);
  });

  it("asks for the post in the configured language", async () => {
    process.env.POST_LANGUAGES = "es";
    const calls = mockFetch(
      githubHandlers({ alpha: [commit("feat: add auth")] })
    );
    const run = await loadRun({ dryRun: true });
    await run();

    const hfCall = calls.find((c) => c.url.includes("api.groq.com"));
    const sent = JSON.parse(hfCall.options.body).messages[1].content;

    expect(sent.startsWith("Write the LinkedIn post in Spanish.")).toBe(true);
  });

  it("publishes once per language, with the configured gap", async () => {
    process.env.POST_LANGUAGES = "en,es";
    process.env.POST_GAP_MINUTES = "5";
    const calls = mockFetch(
      githubHandlers({ alpha: [commit("feat: add auth")] })
    );
    const run = await loadRun({ dryRun: false });
    const sleepImpl = vi.fn().mockResolvedValue();

    const result = await run({ sleepImpl });

    expect(result).toBe("published");
    expect(calls.filter((c) => c.url.includes("api.groq.com"))).toHaveLength(2);
    expect(calls.filter((c) => c.url.includes("api.linkedin.com"))).toHaveLength(2);
    expect(sleepImpl).toHaveBeenCalledOnce();
    expect(sleepImpl).toHaveBeenCalledWith(5 * 60_000);
  });

  it("prints every language and never waits on a dry run", async () => {
    process.env.POST_LANGUAGES = "en,es";
    const calls = mockFetch(
      githubHandlers({ alpha: [commit("feat: add auth")] })
    );
    const run = await loadRun({ dryRun: true });
    const sleepImpl = vi.fn();

    const result = await run({ sleepImpl });

    expect(result).toBe("dry-run");
    expect(sleepImpl).not.toHaveBeenCalled();
    expect(calls.filter((c) => c.url.includes("api.groq.com"))).toHaveLength(2);
    expect(calls.some((c) => c.url.includes("api.linkedin.com"))).toBe(false);

    const printed = logSpy.mock.calls.flat().join("\n");
    expect(printed).toContain("English LinkedIn post");
    expect(printed).toContain("Spanish LinkedIn post");
  });

  it("posts only the language whose cron fired", async () => {
    process.env.POST_LANGUAGES = "en,es";
    process.env.SCHEDULE_CRON = "0 18 * * 1-5";
    const config = tempConfig();
    const calls = mockFetch(
      githubHandlers({ alpha: [commit("feat: add auth")] })
    );
    const run = await loadRun({ dryRun: false });
    const sleepImpl = vi.fn().mockResolvedValue();

    try {
      const result = await run({ sleepImpl, configPath: config.file });

      expect(result).toBe("published");
      expect(calls.filter((c) => c.url.includes("api.groq.com"))).toHaveLength(1);
      expect(calls.filter((c) => c.url.includes("api.linkedin.com"))).toHaveLength(1);
      expect(sleepImpl).not.toHaveBeenCalled();

      const hfCall = calls.find((c) => c.url.includes("api.groq.com"));
      const sent = JSON.parse(hfCall.options.body).messages[1].content;
      expect(sent.startsWith("Write the LinkedIn post in Spanish.")).toBe(true);

      expect(commitWindow(calls)).toContain("until=");
    } finally {
      config.cleanup();
    }
  });

  it("skips the run when no language owns the fired cron", async () => {
    process.env.POST_LANGUAGES = "en,es";
    process.env.SCHEDULE_CRON = "0 3 * * *";
    const config = tempConfig();
    const calls = mockFetch(githubHandlers({}));
    const run = await loadRun({ dryRun: false });

    try {
      const result = await run({ configPath: config.file });

      expect(result).toBe("not-scheduled");
      expect(calls).toHaveLength(0);
    } finally {
      config.cleanup();
    }
  });

  it("uses the same commit window for both scheduled runs", async () => {
    process.env.POST_LANGUAGES = "en,es";
    const config = tempConfig();
    const calls = mockFetch(
      githubHandlers({ alpha: [commit("feat: add auth")] })
    );
    const run = await loadRun({ dryRun: false });
    const sleepImpl = vi.fn().mockResolvedValue();

    try {
      process.env.SCHEDULE_CRON = "0 9 * * 1-5";
      await run({ sleepImpl, configPath: config.file });
      const first = commitWindow(calls);

      const before = calls.length;
      process.env.SCHEDULE_CRON = "0 18 * * 1-5";
      await run({ sleepImpl, configPath: config.file });
      const second = commitWindow(calls.slice(before));

      expect(first).not.toBeNull();
      expect(second).toBe(first);
    } finally {
      config.cleanup();
    }
  });
});
