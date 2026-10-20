import { describe, it, expect, vi } from "vitest";
import {
  mapWithConcurrency,
  fetchOwnedRepos,
  fetchRepoActivity,
  topActiveRepos,
} from "../scripts/github.js";

const HEADERS = { Authorization: "Bearer test" };
const SINCE = "2026-01-01T00:00:00.000Z";
/** Skip real backoff sleeps; retry behaviour is asserted separately in http.test.js. */
const FAST = { sleepImpl: async () => {} };

function jsonResponse(data, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
  };
}

function commits(...messages) {
  return messages.map((m) => ({ commit: { message: m } }));
}

describe("mapWithConcurrency", () => {
  it("preserves input order in the output", async () => {
    const out = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (n) => n * 2);
    expect(out).toEqual([2, 4, 6, 8, 10]);
  });

  it("never exceeds the concurrency limit", async () => {
    let inFlight = 0;
    let peak = 0;

    await mapWithConcurrency(Array.from({ length: 12 }, (_, i) => i), 3, async (n) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 1));
      inFlight--;
      return n;
    });

    expect(peak).toBeLessThanOrEqual(3);
    expect(peak).toBeGreaterThan(1);
  });

  it("handles an empty list", async () => {
    expect(await mapWithConcurrency([], 4, async () => 1)).toEqual([]);
  });

  it("propagates a worker rejection", async () => {
    await expect(
      mapWithConcurrency([1], 1, async () => {
        throw new Error("nope");
      })
    ).rejects.toThrow("nope");
  });
});

describe("fetchOwnedRepos", () => {
  it("returns the repo array", async () => {
    const repos = [{ name: "a", owner: { login: "me" } }];
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(repos));

    expect(await fetchOwnedRepos("octocat", { headers: HEADERS, fetchImpl, ...FAST })).toEqual(repos);
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(fetchImpl.mock.calls[0][0]).toContain("/users/octocat/repos?per_page=30");
  });

  it("throws a diagnostic error when GitHub returns a non-array", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ message: "API rate limit exceeded" }, { ok: false, status: 403 }));

    await expect(
      fetchOwnedRepos("octocat", { headers: HEADERS, fetchImpl, ...FAST })
    ).rejects.toThrow(/rate limit exceeded/);
  });
});

describe("fetchRepoActivity", () => {
  const repos = [
    { name: "alpha", owner: { login: "me" } },
    { name: "beta", owner: { login: "me" } },
  ];

  it("fetches each repo's commits exactly once", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(commits("feat: add auth")));

    await fetchRepoActivity(repos, { since: SINCE, headers: HEADERS, fetchImpl, ...FAST });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("passes the since parameter through", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(commits("feat: x")));

    await fetchRepoActivity(repos, { since: SINCE, headers: HEADERS, fetchImpl, ...FAST });

    for (const [url, options] of fetchImpl.mock.calls) {
      expect(url).toContain(`since=${SINCE}`);
      expect(options.headers).toBe(HEADERS);
    }
  });

  it("passes an explicit until parameter through", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(commits("feat: x")));
    const until = "2026-01-02T00:00:00.000Z";

    await fetchRepoActivity(repos, {
      since: SINCE,
      until,
      headers: HEADERS,
      fetchImpl,
      ...FAST,
    });

    for (const [url] of fetchImpl.mock.calls) {
      expect(url).toContain(`since=${SINCE}`);
      expect(url).toContain(`until=${until}`);
    }
  });

  it("keys results by owner/name and keeps only subject lines", async () => {
    const fetchImpl = vi.fn().mockImplementation(async (url) =>
      url.includes("/alpha/")
        ? jsonResponse(commits("feat: add auth\n\nlong body here"))
        : jsonResponse([])
    );

    const activity = await fetchRepoActivity(repos, { since: SINCE, headers: HEADERS, fetchImpl, ...FAST });

    expect([...activity.keys()]).toEqual(["me/alpha"]);
    expect(activity.get("me/alpha")).toEqual(["feat: add auth"]);
  });

  it("honours the concurrency limit when scanning repos", async () => {
    let inFlight = 0;
    let peak = 0;

    const fetchImpl = vi.fn().mockImplementation(async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 1));
      inFlight--;
      return jsonResponse(commits("feat: x"));
    });

    const many = Array.from({ length: 10 }, (_, i) => ({
      name: `repo${i}`,
      owner: { login: "me" },
    }));

    await fetchRepoActivity(many, { since: SINCE, headers: HEADERS, concurrency: 3, fetchImpl, ...FAST });

    expect(peak).toBeLessThanOrEqual(3);
    expect(fetchImpl).toHaveBeenCalledTimes(10);
  });

  it("omits repos with no commits", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse([]));

    const activity = await fetchRepoActivity(repos, { since: SINCE, headers: HEADERS, fetchImpl, ...FAST });

    expect(activity.size).toBe(0);
  });

  it("skips a failing repo instead of aborting the whole run", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchImpl = vi.fn().mockImplementation(async (url) => {
      if (url.includes("/alpha/")) return jsonResponse(commits("feat: still works"));
      throw new Error("network down");
    });

    const activity = await fetchRepoActivity(repos, { since: SINCE, headers: HEADERS, fetchImpl, ...FAST });

    expect([...activity.keys()]).toEqual(["me/alpha"]);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Skipping me/beta"));

    vi.restoreAllMocks();
  });

  it("skips a repo whose response is not an array", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ message: "Not Found" }, { ok: false, status: 404 }));

    const activity = await fetchRepoActivity(repos, { since: SINCE, headers: HEADERS, fetchImpl, ...FAST });

    expect(activity.size).toBe(0);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Not Found"));

    vi.restoreAllMocks();
  });
});

describe("topActiveRepos", () => {
  const activity = new Map([
    ["me/a", ["1", "2", "3"]],
    ["me/b", ["1", "2", "3", "4"]],
    ["me/c", ["1"]],
    ["me/d", ["1", "2"]],
  ]);

  it("ranks by commit count descending", () => {
    expect(topActiveRepos(activity, 2).map((r) => r.fullName)).toEqual(["me/b", "me/a"]);
  });

  it("caps at the limit and carries the messages through", () => {
    const [top] = topActiveRepos(activity, 1);
    expect(top).toEqual({ fullName: "me/b", messages: ["1", "2", "3", "4"] });
  });

  it("breaks ties alphabetically so ranking is deterministic", () => {
    const tied = new Map([
      ["me/z", ["1"]],
      ["me/a", ["1"]],
    ]);
    expect(topActiveRepos(tied, 2).map((r) => r.fullName)).toEqual(["me/a", "me/z"]);
  });

  it("returns an empty list when there was no activity", () => {
    expect(topActiveRepos(new Map(), 3)).toEqual([]);
  });
});
