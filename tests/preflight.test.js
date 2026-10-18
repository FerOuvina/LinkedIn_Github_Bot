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
    if (url.includes("router.huggingface.co/v1/models")) {
      return ok({ data: [{ id: "zai-org/GLM-5.3-Flash" }, { id: "other/model" }] });
    }
    // The usage probe: a token is enough to prove the key can be billed.
    if (url.includes("router.huggingface.co")) return ok({ choices: [{ message: { content: "" } }] });
    throw new Error(`Unstubbed: ${url}`);
  });
  return fetchImpl;
}

const results = (health) => Object.fromEntries(health.results.map((r) => [r.name, r]));

describe("preflight", () => {
  it("passes when every credential works", async () => {
    const health = await preflight({ fetchImpl: stubFetch(), model: "zai-org/GLM-5.3-Flash" });

    expect(health.ok).toBe(true);
    expect(results(health).GitHub.detail).toContain("octocat");
    expect(results(health).LinkedIn.detail).toContain("Ada Lovelace");
    expect(results(health)["Hugging Face"].detail).toContain("is available");
  });

  it("probes usage so an exhausted balance is caught before posting", async () => {
    const fetchImpl = stubFetch();
    const health = await preflight({ fetchImpl, model: "zai-org/GLM-5.3-Flash" });
    const hf = results(health)["Hugging Face"];

    expect(hf.ok).toBe(true);
    expect(hf.detail).toContain("has credits");

    const probe = fetchImpl.mock.calls.find(([u]) => String(u).includes("chat/completions"));
    expect(probe).toBeDefined();
    expect(JSON.parse(probe[1].body).max_tokens).toBe(1);
  });

  it("fails the check when the account has no credits", async () => {
    const fetchImpl = async (url) => {
      const u = String(url);
      if (u.includes("/models")) {
        return ok({ data: [{ id: "zai-org/GLM-5.3-Flash" }] });
      }
      if (u.includes("chat/completions")) {
        return fail(402, JSON.stringify({ error: "You have no remaining credits." }));
      }
      return ok({});
    };

    const health = await preflight({ fetchImpl, model: "zai-org/GLM-5.3-Flash" });
    const hf = results(health)["Hugging Face"];

    expect(hf.ok).toBe(false);
    expect(hf.detail).toContain("No Hugging Face credits");
    expect(hf.detail).toContain("billing");
  });

  it("fails when the API key is rejected", async () => {
    const fetchImpl = async (url) => {
      const u = String(url);
      if (u.includes("/models")) return ok({ data: [{ id: "zai-org/GLM-5.3-Flash" }] });
      if (u.includes("chat/completions")) {
        return fail(401, JSON.stringify({ error: "invalid token" }));
      }
      return ok({});
    };

    const health = await preflight({ fetchImpl, model: "zai-org/GLM-5.3-Flash" });
    const hf = results(health)["Hugging Face"];

    expect(hf.ok).toBe(false);
    expect(hf.detail).toContain("rejected the API key");
  });

  it("stays green when the probe fails for an inconclusive reason", async () => {
    const fetchImpl = async (url) => {
      const u = String(url);
      if (u.includes("/models")) return ok({ data: [{ id: "zai-org/GLM-5.3-Flash" }] });
      if (u.includes("chat/completions")) {
        return fail(400, JSON.stringify({ error: "unsupported parameter" }));
      }
      return ok({});
    };

    const health = await preflight({ fetchImpl, model: "zai-org/GLM-5.3-Flash" });
    const hf = results(health)["Hugging Face"];

    expect(hf.ok).toBe(true);
    expect(hf.detail).toContain("inconclusive");
  });

  it("checks all three services in a single pass", async () => {
    const fetchImpl = stubFetch();
    await preflight({ fetchImpl, model: "zai-org/GLM-5.3-Flash" });

    const urls = fetchImpl.mock.calls.map(([u]) => String(u));
    expect(urls.some((u) => u.includes("api.github.com"))).toBe(true);
    expect(urls.some((u) => u.includes("api.linkedin.com"))).toBe(true);
    expect(urls.some((u) => u.includes("router.huggingface.co"))).toBe(true);
  });

  it("reports every failure at once rather than stopping at the first", async () => {
    const fetchImpl = stubFetch({
      "api.github.com": fail(401, "Bad credentials"),
      "api.linkedin.com": fail(401, "invalid token"),
    });

    const health = await preflight({ fetchImpl, model: "zai-org/GLM-5.3-Flash" });
    const byName = results(health);

    expect(health.ok).toBe(false);
    expect(byName.GitHub.ok).toBe(false);
    expect(byName.LinkedIn.ok).toBe(false);
    expect(byName["Hugging Face"].ok).toBe(true); // unaffected by the others
  });

  it("names the failing service and keeps the status", async () => {
    const fetchImpl = stubFetch({ "api.linkedin.com": fail(401, "invalid token") });
    const health = await preflight({ fetchImpl, model: "zai-org/GLM-5.3-Flash" });

    const li = results(health).LinkedIn;
    expect(li.ok).toBe(false);
    expect(li.status).toBe(401);
    expect(li.detail).toContain("401");
  });

  it("flags a retired HF model instead of failing later at post time", async () => {
    const fetchImpl = stubFetch();
    const health = await preflight({ fetchImpl, model: "jialinyyzz/humanizer" });
    const hf = results(health)["Hugging Face"];

    expect(hf.ok).toBe(false);
    expect(hf.detail).toContain("jialinyyzz/humanizer");
    expect(hf.detail).toContain("HF_MODEL");
  });

  it("surfaces a network failure as a failed check, not a crash", async () => {
    const fetchImpl = stubFetch({
      "router.huggingface.co": () => {
        throw new Error("getaddrinfo ENOTFOUND");
      },
    });

    const health = await preflight({ fetchImpl, model: "zai-org/GLM-5.3-Flash" });

    expect(health.ok).toBe(false);
    expect(results(health)["Hugging Face"].detail).toContain("ENOTFOUND");
  });
});

describe("formatResults", () => {
  it("summarises an all-clear", async () => {
    const health = await preflight({ fetchImpl: stubFetch(), model: "zai-org/GLM-5.3-Flash" });
    const out = formatResults(health);

    expect(out).toContain("All credentials look good");
    expect(out).not.toContain("❌");
    expect(out.split("\n")).toHaveLength(4);
  });

  it("lists each broken credential with a reason", async () => {
    const fetchImpl = stubFetch({ "api.github.com": fail(401, "Bad credentials") });
    const out = formatResults(await preflight({ fetchImpl, model: "zai-org/GLM-5.3-Flash" }));

    expect(out).toContain("need attention");
    expect(out).toContain("❌ GitHub");
    expect(out).toContain("✅ LinkedIn");
  });
});
