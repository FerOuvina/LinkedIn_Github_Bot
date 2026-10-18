import { describe, it, expect, vi } from "vitest";
import { preflight, formatResults } from "../scripts/preflight.js";

const GH_OK = { login: "octocat", name: "The Octocat" };
const LI_OK = { name: "Ada Lovelace", sub: "abc123" };

function ok(data) {
  return {
    ok: true,
    status: 200,
    json: async () => data,
    text: async () => JSON.stringify(data),
  };
}

function fail(status, body = "error") {
  return { ok: false, status, json: async () => ({}), text: async () => body };
}

/** Route by host so each check hits the right endpoint. */
function stubFetch(overrides = {}) {
  const fetchImpl = vi.fn().mockImplementation(async (url) => {
    const key = Object.keys(overrides).find((k) => url.includes(k));
    if (key) {
      const handler = overrides[key];
      return typeof handler === "function" ? handler() : handler;
    }
    if (url.includes("api.github.com")) return ok(GH_OK);
    if (url.includes("api.linkedin.com")) return ok(LI_OK);
    if (url.includes("api.groq.com/openai/v1/models")) {
      return ok({ data: [{ id: "llama-3.3-70b-versatile" }, { id: "other/model" }] });
    }
    // The usage probe: a token is enough to prove the key can be billed.
    if (url.includes("api.groq.com")) return ok({ choices: [{ message: { content: "" } }] });
    throw new Error(`Unstubbed: ${url}`);
  });
  return fetchImpl;
}

const results = (health) => Object.fromEntries(health.results.map((r) => [r.name, r]));

describe("preflight", () => {
  it("passes when every credential works", async () => {
    const health = await preflight({ fetchImpl: stubFetch(), model: "llama-3.3-70b-versatile" });

    expect(health.ok).toBe(true);
    expect(results(health).GitHub.detail).toContain("octocat");
    expect(results(health).LinkedIn.detail).toContain("Ada Lovelace");
    expect(results(health).Groq.detail).toContain("is available");
  });

  it("probes usage so an exhausted balance is caught before posting", async () => {
    const fetchImpl = stubFetch();
    const health = await preflight({ fetchImpl, model: "llama-3.3-70b-versatile" });
    const groq = results(health).Groq;

    expect(groq.ok).toBe(true);
    expect(groq.detail).toContain("the key works");

    const probe = fetchImpl.mock.calls.find(([u]) => String(u).includes("chat/completions"));
    expect(probe).toBeDefined();
    expect(JSON.parse(probe[1].body).max_tokens).toBe(1);
  });

  it("reports a rate limit as retryable rather than as a broken key", async () => {
    const fetchImpl = async (url) => {
      const u = String(url);
      if (u.includes("/models")) return ok({ data: [{ id: "llama-3.3-70b-versatile" }] });
      if (u.includes("chat/completions")) {
        return fail(429, JSON.stringify({ error: "Rate limit reached" }));
      }
      return ok({});
    };

    const health = await preflight({ fetchImpl, model: "llama-3.3-70b-versatile" });
    const groq = results(health).Groq;

    // A rate limit is not a misconfiguration, so it must not read as a dead key.
    expect(groq.detail).toContain("rate limit");
    expect(groq.detail).not.toContain("rejected the API key");
  });

  it("fails the check when the account is out of credits", async () => {
    const fetchImpl = async (url) => {
      const u = String(url);
      if (u.includes("/models")) {
        return ok({ data: [{ id: "llama-3.3-70b-versatile" }] });
      }
      if (u.includes("chat/completions")) {
        return fail(402, JSON.stringify({ error: "You have no remaining credits." }));
      }
      return ok({});
    };

    const health = await preflight({ fetchImpl, model: "llama-3.3-70b-versatile" });
    const groq = results(health).Groq;

    expect(groq.ok).toBe(false);
    expect(groq.detail).toContain("no credits left");
    expect(groq.detail).toContain("console.groq.com");
  });

  it("fails when the API key is rejected", async () => {
    const fetchImpl = async (url) => {
      const u = String(url);
      if (u.includes("/models")) return ok({ data: [{ id: "llama-3.3-70b-versatile" }] });
      if (u.includes("chat/completions")) {
        return fail(401, JSON.stringify({ error: "invalid token" }));
      }
      return ok({});
    };

    const health = await preflight({ fetchImpl, model: "llama-3.3-70b-versatile" });
    const groq = results(health).Groq;

    expect(groq.ok).toBe(false);
    expect(groq.detail).toContain("rejected the API key");
  });

  it("stays green when the probe fails for an inconclusive reason", async () => {
    const fetchImpl = async (url) => {
      const u = String(url);
      if (u.includes("/models")) return ok({ data: [{ id: "llama-3.3-70b-versatile" }] });
      if (u.includes("chat/completions")) {
        return fail(400, JSON.stringify({ error: "unsupported parameter" }));
      }
      return ok({});
    };

    const health = await preflight({ fetchImpl, model: "llama-3.3-70b-versatile" });
    const groq = results(health).Groq;

    expect(groq.ok).toBe(true);
    expect(groq.detail).toContain("inconclusive");
  });

  it("checks all three services in a single pass", async () => {
    const fetchImpl = stubFetch();
    await preflight({ fetchImpl, model: "llama-3.3-70b-versatile" });

    const urls = fetchImpl.mock.calls.map(([u]) => String(u));
    expect(urls.some((u) => u.includes("api.github.com"))).toBe(true);
    expect(urls.some((u) => u.includes("api.linkedin.com"))).toBe(true);
    expect(urls.some((u) => u.includes("api.groq.com"))).toBe(true);
  });

  it("reports every failure at once rather than stopping at the first", async () => {
    const fetchImpl = stubFetch({
      "api.github.com": fail(401, "Bad credentials"),
      "api.linkedin.com": fail(401, "invalid token"),
    });

    const health = await preflight({ fetchImpl, model: "llama-3.3-70b-versatile" });
    const byName = results(health);

    expect(health.ok).toBe(false);
    expect(byName.GitHub.ok).toBe(false);
    expect(byName.LinkedIn.ok).toBe(false);
    expect(byName.Groq.ok).toBe(true); // unaffected by the others
  });

  it("names the failing service and keeps the status", async () => {
    const fetchImpl = stubFetch({ "api.linkedin.com": fail(401, "invalid token") });
    const health = await preflight({ fetchImpl, model: "llama-3.3-70b-versatile" });

    const li = results(health).LinkedIn;
    expect(li.ok).toBe(false);
    expect(li.status).toBe(401);
    expect(li.detail).toContain("401");
  });

  it("flags an unavailable model instead of failing later at post time", async () => {
    const fetchImpl = stubFetch();
    const health = await preflight({ fetchImpl, model: "jialinyyzz/humanizer" });
    const groq = results(health).Groq;

    expect(groq.ok).toBe(false);
    expect(groq.detail).toContain("jialinyyzz/humanizer");
    expect(groq.detail).toContain("GROQ_MODEL");
  });

  it("surfaces a network failure as a failed check, not a crash", async () => {
    const fetchImpl = stubFetch({
      "api.groq.com": () => {
        throw new Error("getaddrinfo ENOTFOUND");
      },
    });

    const health = await preflight({ fetchImpl, model: "llama-3.3-70b-versatile" });

    expect(health.ok).toBe(false);
    expect(results(health).Groq.detail).toContain("ENOTFOUND");
  });
});

describe("formatResults", () => {
  it("summarises an all-clear", async () => {
    const health = await preflight({ fetchImpl: stubFetch(), model: "llama-3.3-70b-versatile" });
    const out = formatResults(health);

    expect(out).toContain("All credentials look good");
    expect(out).not.toContain("❌");
    expect(out.split("\n")).toHaveLength(4);
  });

  it("lists each broken credential with a reason", async () => {
    const fetchImpl = stubFetch({ "api.github.com": fail(401, "Bad credentials") });
    const out = formatResults(await preflight({ fetchImpl, model: "llama-3.3-70b-versatile" }));

    expect(out).toContain("need attention");
    expect(out).toContain("❌ GitHub");
    expect(out).toContain("✅ LinkedIn");
  });
});
