import { describe, it, expect, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { createSetupServer } from "../scripts/setupServer.js";

const servers = [];

async function start(options = {}) {
  const s = createSetupServer({ port: 0, ...options });
  const url = await s.listen();
  servers.push(s);
  return { ...s, url, get: (p) => fetch(`${url}${p}`), post: (p, body) => fetch(`${url}${p}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) };
}

afterEach(async () => {
  while (servers.length) await servers.pop().close();
  vi.restoreAllMocks();
});

const okPreflight = async () => ({
  ok: true,
  results: [{ name: "GitHub", ok: true, detail: "authenticated as octocat" }],
});

const FULL_ENV = {
  HUB_USER: "octocat",
  GITHUB_TOKEN: "gh-secret-value",
  LINKEDIN_ACCESS_TOKEN: "li-secret-value",
  LINKEDIN_AUTHOR_URN: "urn:li:person:abc",
  HUGGINGFACE_API_KEY: "hf-secret-value",
};

describe("GET /api/health", () => {
  it("reports ok, the node version and missing env names", async () => {
    const s = await start();
    const res = await s.get("/api/health");
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.node).toBe(process.version);
    expect(Array.isArray(body.envMissing)).toBe(true);
  });

  it("reports whether the web UI has been built", async () => {
    const s = await start({ webDir: "C:/definitely/not/here" });
    expect((await (await s.get("/api/health")).json()).hasWebUi).toBe(false);
  });
});

describe("GET /api/preflight", () => {
  it("returns the preflight result", async () => {
    const s = await start({ preflightImpl: okPreflight });
    const res = await s.get("/api/preflight");
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.results[0].name).toBe("GitHub");
  });
});

describe("POST /api/secrets", () => {
  it("defaults to a dry run and does not write", async () => {
    const syncImpl = vi.fn().mockResolvedValue({ ok: true, applied: false, reason: "dry-run", set: ["HUB_USER"], missing: [], skipped: [] });
    const s = await start({ syncImpl, env: FULL_ENV });

    const res = await s.post("/api/secrets", {});
    const body = await res.json();

    expect(syncImpl).toHaveBeenCalledWith(expect.objectContaining({ dryRun: true, repo: undefined }));
    expect(body.applied).toBe(false);
    expect(body.message).toContain("Would set");
  });

  it("writes when apply is explicitly true", async () => {
    const syncImpl = vi.fn().mockResolvedValue({ ok: true, applied: true, set: [], missing: [], skipped: [], written: ["HUB_USER"] });
    const s = await start({ syncImpl, env: FULL_ENV });

    const res = await s.post("/api/secrets", { apply: true, repo: "octocat/repo" });
    const body = await res.json();

    expect(syncImpl).toHaveBeenCalledWith(expect.objectContaining({ dryRun: false, repo: "octocat/repo" }));
    expect(res.status).toBe(200);
    expect(body.applied).toBe(true);
  });

  it("returns 400 when required secrets are missing", async () => {
    const syncImpl = vi.fn().mockResolvedValue({
      ok: false,
      applied: false,
      reason: "missing",
      set: [],
      missing: ["GITHUB_TOKEN"],
      skipped: [],
    });
    const s = await start({ syncImpl, env: {} });

    const res = await s.post("/api/secrets", { apply: true });
    expect(res.status).toBe(400);
    expect((await res.json()).message).toContain("GITHUB_TOKEN");
  });

  it("never echoes a secret value in the response", async () => {
    const syncImpl = vi.fn().mockResolvedValue({ ok: true, applied: false, reason: "dry-run", set: ["GITHUB_TOKEN"], missing: [], skipped: [] });
    const s = await start({ syncImpl, env: FULL_ENV });

    const text = await (await s.post("/api/secrets", { apply: true })).text();
    expect(text).not.toContain("gh-secret-value");
    expect(text).not.toContain("li-secret-value");
  });
});

describe("network exposure", () => {
  // The server hands out LinkedIn tokens. It must never listen on the LAN.
  it("binds to loopback by default", async () => {
    const s = await start();
    expect(s.server.address().address).toBe("127.0.0.1");
  });

  it("does not bind to all interfaces", async () => {
    const source = readFileSync(
      new URL("../scripts/setupServer.js", import.meta.url),
      "utf8"
    );

    expect(source).toContain('host = "127.0.0.1"');
    expect(source).not.toContain('"0.0.0.0"');
  });

  it("is reachable over loopback", async () => {
    const s = await start();
    expect(s.url).toContain("127.0.0.1");
    expect((await s.get("/api/health")).status).toBe(200);
  });
});

describe("routing", () => {
  it("404s an unknown route as JSON", async () => {
    const s = await start();
    const res = await s.get("/api/nope");
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.ok).toBe(false);
    expect(body.error).toContain("/api/nope");
  });

  it("rejects a wrong method with 404 rather than 500", async () => {
    const s = await start();
    expect((await s.post("/api/health", {})).status).toBe(404);
  });

  it("reports a bad JSON body as a 500 rather than crashing", async () => {
    const s = await start();
    const res = await fetch(`${s.url}/api/secrets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not json",
    });

    expect(res.status).toBe(500);
    expect((await res.json()).ok).toBe(false);
  });

  it("does not crash when a handler throws", async () => {
    const s = await start({
      preflightImpl: async () => {
        throw new Error("boom");
      },
    });

    const res = await s.get("/api/preflight");
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("boom");
  });
});

describe("LinkedIn auth routes", () => {
  it("501s when no auth implementation is injected", async () => {
    const s = await start();
    expect((await s.get("/api/auth/linkedin/start")).status).toBe(501);
  });

  it("returns an authorize url and a state token", async () => {
    const linkedin = {
      authorizeUrl: vi.fn().mockResolvedValue({ url: "https://linkedin.com/oauth?x=1" }),
      exchange: vi.fn(),
    };
    const s = await start({ linkedin });

    const res = await s.get("/api/auth/linkedin/start");
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(body.url).toContain("linkedin.com");
    expect(body.state).toMatch(/^[a-f0-9]{48}$/);
    expect(linkedin.authorizeUrl).toHaveBeenCalledWith({ state: body.state });
  });

  it("rejects a callback with the wrong state", async () => {
    const linkedin = { authorizeUrl: vi.fn(), exchange: vi.fn() };
    const s = await start({ linkedin });

    const started = await (await s.get("/api/auth/linkedin/start")).json();
    const res = await s.get(`/api/auth/linkedin/callback?code=abc&state=wrong`);

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/state mismatch/);
    expect(linkedin.exchange).not.toHaveBeenCalled();
    expect(started.state).not.toBe("wrong");
  });

  it("surfaces an oauth error from LinkedIn", async () => {
    const linkedin = { authorizeUrl: vi.fn(), exchange: vi.fn() };
    const s = await start({ linkedin });

    const res = await s.get("/api/auth/linkedin/callback?error=access_denied&error_description=User+said+no");

    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("User said no");
  });

  it("exchanges the code and returns the tokens", async () => {
    const linkedin = {
      authorizeUrl: vi.fn().mockResolvedValue({ url: "https://linkedin.com/oauth" }),
      exchange: vi.fn().mockResolvedValue({ accessToken: "li-token", authorUrn: "urn:li:person:abc" }),
    };
    const s = await start({ linkedin });

    const { state } = await (await s.get("/api/auth/linkedin/start")).json();
    const res = await s.get(`/api/auth/linkedin/callback?code=the-code&state=${state}`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.accessToken).toBe("li-token");
    expect(linkedin.exchange).toHaveBeenCalledWith("the-code", {
      redirectUri: process.env.LINKEDIN_REDIRECT_URI,
    });
  });

  it("returns 502 when the exchange fails", async () => {
    const linkedin = {
      authorizeUrl: vi.fn().mockResolvedValue({ url: "https://linkedin.com/oauth" }),
      exchange: vi.fn().mockRejectedValue(new Error("code already used")),
    };
    const s = await start({ linkedin });

    const { state } = await (await s.get("/api/auth/linkedin/start")).json();
    const res = await s.get(`/api/auth/linkedin/callback?code=x&state=${state}`);

    expect(res.status).toBe(502);
    expect((await res.json()).error).toContain("code already used");
  });

  it("refuses to reuse a state token", async () => {
    const linkedin = {
      authorizeUrl: vi.fn().mockResolvedValue({ url: "https://linkedin.com/oauth" }),
      exchange: vi.fn().mockResolvedValue({ accessToken: "t" }),
    };
    const s = await start({ linkedin });

    const { state } = await (await s.get("/api/auth/linkedin/start")).json();
    expect((await s.get(`/api/auth/linkedin/callback?code=a&state=${state}`)).status).toBe(200);

    // A replayed callback must not mint another token.
    linkedin.exchange.mockClear();
    const replay = await s.get(`/api/auth/linkedin/callback?code=a&state=${state}`);
    expect(replay.status).toBe(400);
    expect(linkedin.exchange).not.toHaveBeenCalled();
  });
});
