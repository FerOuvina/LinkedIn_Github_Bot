import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { WEB_BASE } from "../scripts/webBase.js";
import { createSetupServer } from "../scripts/setupServer.js";

const servers = [];

async function start(options = {}) {
  const s = createSetupServer({ port: 0, ...options });
  const url = await s.listen();
  servers.push(s);
  return {
    ...s,
    url,
    get: (p, init) => fetch(`${url}${p}`, init),
    post: (p, body) =>
      fetch(`${url}${p}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
  };
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
  GROQ_API_KEY: "gsk-secret-value",
};

describe("GET /api/health", () => {
  it("reports the GitHub CLI state, since saving secrets needs it", async () => {
    const ghCheckImpl = vi.fn().mockResolvedValue({ installed: true, authenticated: true });
    const s = await start({ ghCheckImpl });

    const body = await (await s.get("/api/health")).json();

    expect(ghCheckImpl).toHaveBeenCalled();
    expect(body.gh).toEqual({ installed: true, authenticated: true });
  });

  it("distinguishes missing from signed-out", async () => {
    const s = await start({
      ghCheckImpl: async () => ({ installed: true, authenticated: false }),
    });

    expect((await (await s.get("/api/health")).json()).gh.authenticated).toBe(false);
  });

  it("does not report ok overall when health is fine but gh is absent", async () => {
    const s = await start({
      ghCheckImpl: async () => ({ installed: false, authenticated: false }),
    });

    const body = await (await s.get("/api/health")).json();
    expect(body.gh.installed).toBe(false);
    expect(body.ok).toBe(true); // the server itself is healthy
  });

  it("reports an installed CLI that is not on PATH separately", async () => {
    // A CLI installed while the terminal was open looks identical to a
    // missing one unless we look past PATH.
    const ghCheckImpl = vi.fn().mockResolvedValue({
      installed: true,
      authenticated: true,
      onPath: false,
      version: "gh version 2.0.0",
      path: "C:\\Program Files\\GitHub CLI\\gh.exe",
    });

    const s = await start({ ghCheckImpl });
    const body = await (await s.get("/api/health")).json();

    expect(body.gh.installed).toBe(true);
    expect(body.gh.onPath).toBe(false);
    expect(body.gh.path).toContain("gh.exe");
  });

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

  it("skips the GitHub push entirely when only .env is selected", async () => {
    // The GitHub flag used to be computed and then ignored, so an .env-only
    // save still pushed secrets and failed on a reserved name.
    const syncImpl = vi.fn().mockResolvedValue({ ok: true, applied: true, set: [], missing: [], skipped: [], written: [] });
    const dir = mkdtempSync(path.join(tmpdir(), "envonly-"));
    const envPath = path.join(dir, ".env");
    const s = await start({ syncImpl, env: FULL_ENV, envPath });

    const res = await s.post("/api/secrets", { apply: true, github: false, env: true });
    const body = await res.json();

    expect(syncImpl).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.message).toContain(".env");
    expect(readFileSync(envPath, "utf8")).toContain("GROQ_API_KEY=");

    rmSync(dir, { recursive: true, force: true });
  });

  it("still writes .env when the GitHub push fails", async () => {
    const syncImpl = vi.fn().mockResolvedValue({
      ok: false,
      applied: false,
      reason: "write-failed",
      failedSecret: "GROQ_API_KEY",
      detail: "HTTP 500",
      set: [],
      missing: [],
      skipped: [],
    });
    const dir = mkdtempSync(path.join(tmpdir(), "both-"));
    const envPath = path.join(dir, ".env");
    const s = await start({ syncImpl, env: FULL_ENV, envPath });

    const res = await s.post("/api/secrets", { apply: true, github: true, env: true });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.message).toContain("Failed to set GROQ_API_KEY");
    expect(body.message).toContain(".env");
    expect(readFileSync(envPath, "utf8")).toContain("GROQ_API_KEY=");

    rmSync(dir, { recursive: true, force: true });
  });

  it("does not write .env on a preview", async () => {
    const syncImpl = vi.fn().mockResolvedValue({ ok: true, applied: false, reason: "dry-run", set: ["HUB_USER"], missing: [], skipped: [] });
    const dir = mkdtempSync(path.join(tmpdir(), "preview-"));
    const envPath = path.join(dir, ".env");
    const s = await start({ syncImpl, env: FULL_ENV, envPath });

    const res = await s.post("/api/secrets", { apply: false, github: false, env: true });

    expect(res.status).toBe(200);
    expect((await res.json()).message).toContain("Would write");
    expect(existsSync(envPath)).toBe(false);

    rmSync(dir, { recursive: true, force: true });
  });

  it("never echoes a secret value in the response", async () => {
    const syncImpl = vi.fn().mockResolvedValue({ ok: true, applied: false, reason: "dry-run", set: ["GITHUB_TOKEN"], missing: [], skipped: [] });
    const s = await start({ syncImpl, env: FULL_ENV });

    const text = await (await s.post("/api/secrets", { apply: true })).text();
    expect(text).not.toContain("gh-secret-value");
    expect(text).not.toContain("li-secret-value");
  });
});

describe("POST /api/dry-run", () => {
  it("returns what the real bot printed", async () => {
    const dryRunImpl = vi
      .fn()
      .mockResolvedValue({ stdout: "a generated post", stderr: "", code: 0 });

    const s = await start({ dryRunImpl });
    const res = await s.post("/api/dry-run", {});
    const body = await res.json();

    expect(dryRunImpl).toHaveBeenCalledOnce();
    expect(body.ok).toBe(true);
    expect(body.stdout).toContain("a generated post");
  });

  it("reports a failing run rather than pretending it worked", async () => {
    const dryRunImpl = vi
      .fn()
      .mockResolvedValue({ stdout: "", stderr: "Missing env variables", code: 1 });

    const s = await start({ dryRunImpl });
    const res = await s.post("/api/dry-run", {});
    const body = await res.json();

expect(body.ok).toBe(false);
    expect(body.exitCode).toBe(1);
    expect(body.stderr).toContain("Missing env variables");
  });
});

describe("schedule routes", () => {
  let dir;
  let workflow;
  let configPath;

  const WORKFLOW = `name: Daily

on:
  schedule:
    - cron: "0 18 * * *"
  workflow_dispatch:

jobs:
  post:
    runs-on: ubuntu-latest
`;

  const CONFIG = {
    languages: ["en", "es"],
    gapMinutes: 5,
    timezone: "UTC",
    days: [1, 2, 3, 4, 5],
    times: { en: "09:00", es: "18:00" },
    crons: { en: "0 9 * * 1-5", es: "0 18 * * 1-5" },
  };

  const SETTINGS = {
    timeZone: "UTC",
    days: [1, 2, 3, 4, 5],
    times: { en: "09:00", es: "18:00" },
    gapMinutes: 5,
  };

  function startServer(overrides = {}) {
    return start({ workflowPath: workflow, configPath, ...overrides });
  }

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "sched-"));
    workflow = path.join(dir, "linkedin-post.yml");
    configPath = path.join(dir, "post.config.json");
    writeFileSync(workflow, WORKFLOW, "utf8");
    writeFileSync(configPath, JSON.stringify(CONFIG), "utf8");
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("reports the committed crons, config, and zone choices", async () => {
    const s = await startServer();
    const body = await (await s.get("/api/schedule")).json();

    expect(body.ok).toBe(true);
    expect(body.current).toEqual(["0 18 * * *"]);
    expect(body.parsed).toEqual({ hour: 18, minute: 0, days: [] });
    expect(body.config).toEqual(CONFIG);
    expect(body.zones.cities.length).toBeGreaterThan(20);
    expect(body.days).toHaveLength(7);
  });

  it("converts one local time per language into its UTC cron", async () => {
    const s = await startServer();
    const res = await s.post("/api/schedule/preview", {
      ...SETTINGS,
      timeZone: "Asia/Tokyo",
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    // 09:00 and 18:00 in Tokyo are 00:00 and 09:00 UTC.
    expect(body.crons).toEqual({
      en: "0 0 * * 1-5",
      es: "0 9 * * 1-5",
    });
    expect(body.offsetLabel).toBe("UTC+09:00");
    expect(body.runs).toHaveLength(6);
    expect(body.runs.some((run) => run.language === "es")).toBe(true);
  });

  it("warns that cron cannot follow daylight saving", async () => {
    const s = await startServer();
    const body = await (
      await s.post("/api/schedule/preview", {
        ...SETTINGS,
        timeZone: "Europe/Madrid",
      })
    ).json();

    expect(body.crons.en).toMatch(/^\d+ \d+ \* \* 1-5$/);
    expect(body.warnings.join(" ")).toMatch(/daylight saving/i);
  });

  it("rejects an unknown timezone rather than writing a nonsense cron", async () => {
    const s = await startServer();
    const res = await s.post("/api/schedule/preview", {
      ...SETTINGS,
      timeZone: "Mars/Olympus",
    });

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Unknown time zone/);
  });

  it("rejects a missing or invalid language time", async () => {
    const s = await startServer();
    const res = await s.post("/api/schedule/preview", {
      ...SETTINGS,
      times: { en: "09:00" },
    });

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Invalid time for Spanish/);
  });

  it("leaves both files alone when previewing", async () => {
    const s = await startServer();
    await s.post("/api/schedule/preview", SETTINGS);

    expect(readFileSync(workflow, "utf8")).toBe(WORKFLOW);
    expect(JSON.parse(readFileSync(configPath, "utf8"))).toEqual(CONFIG);
  });

  it("writes every cron and the config, and reports what changed", async () => {
    const s = await startServer();
    const res = await s.post("/api/schedule/apply", SETTINGS);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.previous).toEqual(["0 18 * * *"]);
    expect(body.message).toMatch(/Updated the schedule/);

    const after = readFileSync(workflow, "utf8");
    expect(after).toContain('- cron: "0 9 * * 1-5"');
    expect(after).toContain('- cron: "0 18 * * 1-5"');
    expect(after).toContain("workflow_dispatch:");
    expect(JSON.parse(readFileSync(configPath, "utf8")).crons).toEqual({
      en: "0 9 * * 1-5",
      es: "0 18 * * 1-5",
    });
  });

  it("says so when the schedule is already what was asked for", async () => {
    const s = await startServer();
    await s.post("/api/schedule/apply", SETTINGS);
    const body = await (await s.post("/api/schedule/apply", SETTINGS)).json();

    expect(body.ok).toBe(true);
    expect(body.message).toMatch(/nothing changed/i);
  });

  it("writes a single cron when both languages share a time", async () => {
    const s = await startServer();
    await s.post("/api/schedule/apply", {
      ...SETTINGS,
      times: { en: "09:00", es: "09:00" },
    });

    const after = readFileSync(workflow, "utf8");
    expect(after.match(/- cron:/g)).toHaveLength(1);
    expect(after).toContain("English 09:00, Spanish 09:00");
  });

  it("reports a missing workflow instead of throwing", async () => {
    const s = await startServer({ workflowPath: path.join(dir, "absent.yml") });
    const res = await s.post("/api/schedule/apply", SETTINGS);

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Not found/);
  });

  it("reports a workflow without a schedule block", async () => {
    writeFileSync(workflow, "name: Daily\non:\n  workflow_dispatch:\n", "utf8");
    const s = await startServer();
    const res = await s.post("/api/schedule/apply", SETTINGS);

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/schedule/);
  });
});

describe("prompt routes", () => {
  let dir;
  let promptPath;
  let configPath;
  let workflow;

  const DEFAULT_PROMPT = `Write a concise LinkedIn post summarizing the following commits from my GitHub repositories. For the github user use {hubUser}.
Make it professional, readable, and engaging. Use emojis for features and fixes.
Keep it short and include clickable repo URLs if possible.
DON'T forget to add a space after every emoji.
Commits:
{commits}`;

  const CONFIG = {
    languages: ["en", "es"],
    gapMinutes: 5,
    timezone: "UTC",
    days: [1, 2, 3, 4, 5],
    times: { en: "09:00", es: "18:00" },
    crons: { en: "0 9 * * 1-5", es: "0 18 * * 1-5" },
  };

  const WORKFLOW = `name: Daily

on:
  schedule:
    - cron: "0 9 * * 1-5"
    - cron: "0 18 * * 1-5"
  workflow_dispatch:
`;

  function startPrompt(overrides = {}) {
    return start({ promptPath, configPath, workflowPath: workflow, ...overrides });
  }

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "prompt-"));
    promptPath = path.join(dir, "prompt.md");
    configPath = path.join(dir, "post.config.json");
    workflow = path.join(dir, "linkedin-post.yml");
    writeFileSync(promptPath, DEFAULT_PROMPT, "utf8");
    writeFileSync(configPath, JSON.stringify(CONFIG), "utf8");
    writeFileSync(workflow, WORKFLOW, "utf8");
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("reads the committed prompt and settings", async () => {
    const s = await startPrompt();
    const body = await (await s.get("/api/prompt")).json();

    expect(body.ok).toBe(true);
    expect(body.prompt).toBe(DEFAULT_PROMPT);
    expect(body.promptPath).toBe(promptPath);
    expect(body.config).toEqual(CONFIG);
    expect(body.configPath).toBe(configPath);
  });

  it("reports null prompt when the file is missing", async () => {
    const s = await startPrompt({ promptPath: path.join(dir, "absent.md") });
    const body = await (await s.get("/api/prompt")).json();

    expect(body.ok).toBe(true);
    expect(body.prompt).toBeNull();
    expect(body.config).toEqual(CONFIG);
  });

  it("writes the prompt and settings and persists them", async () => {
    const s = await startPrompt();
    const newPrompt = "Custom prompt with {commits} and {hubUser}.";
    const res = await s.post("/api/prompt", {
      prompt: newPrompt,
      languages: ["en", "es"],
      gapMinutes: 10,
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.languagesChanged).toBe(false);
    expect(readFileSync(promptPath, "utf8")).toBe(newPrompt);
    expect(JSON.parse(readFileSync(configPath, "utf8"))).toEqual({
      ...CONFIG,
      gapMinutes: 10,
    });
    expect(readFileSync(workflow, "utf8")).toBe(WORKFLOW);
  });

  it("adds a cron when a language is added", async () => {
    const s = await startPrompt();
    const res = await s.post("/api/prompt", {
      prompt: "p",
      languages: ["en", "pt"],
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.languagesChanged).toBe(true);
    expect(body.config.languages).toEqual(["en", "pt"]);
    expect(body.config.times).toEqual({ en: "09:00", pt: "09:00" });
    expect(body.config.crons).toEqual({
      en: "0 9 * * 1-5",
      pt: "0 9 * * 1-5",
    });
    expect(readFileSync(workflow, "utf8").match(/- cron:/g)).toHaveLength(1);
    expect(readFileSync(workflow, "utf8")).toContain(
      "English 09:00, Portuguese 09:00"
    );
  });

  it("rejects a non-string prompt", async () => {
    const s = await startPrompt();
    const res = await s.post("/api/prompt", { prompt: 123 });

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/prompt must be a string/);
  });

  it("rejects a language list with no supported codes", async () => {
    const s = await startPrompt();
    const res = await s.post("/api/prompt", {
      prompt: "p",
      languages: ["de"],
    });

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/supported code/);
  });

  it("rejects more than two languages", async () => {
    const s = await startPrompt();
    const res = await s.post("/api/prompt", {
      prompt: "p",
      languages: ["en", "es", "pt"],
    });

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/at most 2 languages/);
  });

  it("rejects a non-numeric gap", async () => {
    const s = await startPrompt();
    const res = await s.post("/api/prompt", {
      prompt: "p",
      gapMinutes: "soon",
    });

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/gapMinutes must be a number/);
  });
});

describe("listen", () => {
  it("explains a port clash instead of dying silently", async () => {
    const first = createSetupServer({ port: 0 });
    const port = new URL(await first.listen()).port;

    const second = createSetupServer({ port: Number(port) });
    await expect(second.listen()).rejects.toThrow(/already in use/);

    await first.close();
  });

  it("allows two servers on different ports", async () => {
    const a = createSetupServer({ port: 0 });
    const b = createSetupServer({ port: 0 });
    const [urlA, urlB] = [await a.listen(), await b.listen()];

    expect(urlA).not.toBe(urlB);
    await a.close();
    await b.close();
  });
});

describe("GET /docs", () => {
  let docsDir;

  beforeEach(() => {
    docsDir = mkdtempSync(path.join(tmpdir(), "docs-"));
    writeFileSync(path.join(docsDir, "GUIDE.md"), "# Guide\n\nSome docs.");
    writeFileSync(path.join(docsDir, "img.png"), "notreallyapng");
  });

  afterEach(() => rmSync(docsDir, { recursive: true, force: true }));

  it("serves a markdown guide", async () => {
    const s = await start({ docsDir });
    const res = await s.get("/docs/GUIDE.md");

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");
    expect(await res.text()).toContain("Some docs.");
  });

  it("serves images referenced by the guide", async () => {
    const s = await start({ docsDir });
    expect((await s.get("/docs/img.png")).status).toBe(200);
  });

  it("redirects the bare /docs path to the guide", async () => {
    const s = await start({ docsDir });
    const res = await s.get("/docs", { redirect: "manual" });

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("LINKEDIN_SETUP.md");
  });

  it("404s a guide that does not exist", async () => {
    const s = await start({ docsDir });
    expect((await s.get("/docs/NOPE.md")).status).toBe(404);
  });

  it("never serves files outside docs/, whatever the path", async () => {
    const s = await start({ docsDir });

    for (const path of ["/docs/%2e%2e/.env", "/docs/../.env"]) {
      const body = await (await s.get(path)).text();
      expect(body).not.toContain("GROQ_API_KEY=");
      expect(body).not.toContain("LINKEDIN_ACCESS_TOKEN=");
    }
  });

  it("serves the real LinkedIn setup guide from this repo", async () => {
    const s = await start();
    const res = await s.get("/docs/LINKEDIN_SETUP.md");

    expect(res.status).toBe(200);
    expect(await res.text()).toContain("LinkedIn");
  });
});

describe("static serving", () => {
  let dir;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "webdist-"));
    mkdirSync(path.join(dir, "assets"), { recursive: true });
    writeFileSync(path.join(dir, "index.html"), "<!doctype html><title>wizard</title>");
    writeFileSync(path.join(dir, "assets", "app.js"), "console.log(1)");
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("serves the built wizard at the base path", async () => {
    const s = await start({ webDir: dir });
    const res = await s.get(WEB_BASE);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(await res.text()).toContain("wizard");
  });

  it("serves hashed assets with the right content type", async () => {
    const s = await start({ webDir: dir });
    const res = await s.get("/assets/app.js");

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/javascript");
  });

  it("never serves files outside dist, whatever the path", async () => {
    // The URL parser collapses %2e%2e before the request reaches us, so the
    // status is not the point — leaking the file's contents is.
    const s = await start({ webDir: dir });

    for (const path of [
      "/assets/%2e%2e/%2e%2e/setupServer.js",
      "/assets/../../setupServer.js",
      "/%2e%2e/scripts/consts.js",
    ]) {
      const body = await (await s.get(path)).text();
      expect(body).not.toContain("dotenv/config");
    }
  });

  it("redirects the root to the base path, or the page renders blank", async () => {
    // The build targets /LinkedIn_Github_Boot/, so at the bare root the router
    // matches nothing and the page is blank.
    const s = await start({ webDir: dir });
    const res = await s.get("/", { redirect: "manual" });

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(WEB_BASE);
  });

  it("serves the app at the base path", async () => {
    const s = await start({ webDir: dir });
    const res = await s.get(`${WEB_BASE}`);

    expect(res.status).toBe(200);
    expect(await res.text()).toContain("wizard");
  });

  it("does not redirect when the app is built for a domain root", async () => {
    const s = await start({ webDir: dir, webBase: "/" });
    const res = await s.get("/", { redirect: "manual" });

    expect(res.status).toBe(200);
  });

  it("serves the app shell for client-side routes", async () => {
    const s = await start({ webDir: dir });

    // These are React Router paths, not files on disk.
    for (const route of ["/guide", "/getting-started"]) {
      const res = await s.get(route);
      expect(res.status).toBe(200);
      expect(await res.text()).toContain("wizard");
    }
  });

  it("404s a missing asset rather than silently returning HTML", async () => {
    const s = await start({ webDir: dir });
    const res = await s.get("/assets/gone.js");

    expect(res.status).toBe(404);
    expect(await res.text()).not.toContain("wizard");
  });

  it("keeps serving the API when no build is present", async () => {
    const s = await start({ webDir: path.join(dir, "nope") });

    expect((await s.get("/")).status).toBe(404);
    expect((await s.get("/api/health")).status).toBe(200);
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
it("still 501s when auth is explicitly disabled", async () => {
    const s = await start({ linkedin: null });
    expect((await s.get("/api/auth/linkedin/start")).status).toBe(501);
  });

  it("wires the real LinkedIn auth by default, not a stub", async () => {
    const saved = { ...process.env };
    process.env.LINKEDIN_CLIENT_ID = "client-123";
    process.env.LINKEDIN_CLIENT_SECRET = "secret-456";
    delete process.env.LINKEDIN_WIZARD_REDIRECT_URI;

    try {
      const s = await start();
      const res = await s.get("/api/auth/linkedin/start");
      const body = await res.json();

      expect(res.status).toBe(200);
      const authUrl = new URL(body.url);
      expect(authUrl.origin + authUrl.pathname).toBe(
        "https://www.linkedin.com/oauth/v2/authorization"
      );
      expect(authUrl.searchParams.get("client_id")).toBe("client-123");
      // The wizard has to receive the callback itself, so it uses its own
      // redirect URI — not the CLI script's localhost:3000.
      expect(authUrl.searchParams.get("redirect_uri")).toBe(
        `${s.url}/api/auth/linkedin/callback`
      );
    } finally {
      process.env = saved;
    }
  });

  it("requests w_member_social, without which posting is rejected", async () => {
    const saved = { ...process.env };
    process.env.LINKEDIN_CLIENT_ID = "client-123";
    process.env.LINKEDIN_CLIENT_SECRET = "secret-456";
    delete process.env.LINKEDIN_WIZARD_REDIRECT_URI;

    try {
      const s = await start();
      const { url } = await (await s.get("/api/auth/linkedin/start")).json();
      expect(new URL(url).searchParams.get("scope")).toContain("w_member_social");
    } finally {
      process.env = saved;
    }
  });

  it("honours LINKEDIN_WIZARD_REDIRECT_URI over the derived one", async () => {
    const saved = { ...process.env };
    process.env.LINKEDIN_CLIENT_ID = "client-123";
    process.env.LINKEDIN_CLIENT_SECRET = "secret-456";
    process.env.LINKEDIN_WIZARD_REDIRECT_URI = "http://127.0.0.1:9999/cb";

    try {
      const s = await start();
      const { url } = await (await s.get("/api/auth/linkedin/start")).json();
      expect(new URL(url).searchParams.get("redirect_uri")).toBe("http://127.0.0.1:9999/cb");
    } finally {
      process.env = saved;
    }
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

  it("redirects back to the app instead of putting tokens in the URL", async () => {
    const linkedin = {
      authorizeUrl: vi.fn().mockResolvedValue({ url: "https://linkedin.com/oauth" }),
      exchange: vi.fn().mockResolvedValue({ accessToken: "li-token", authorUrn: "urn:li:person:abc" }),
    };
    const s = await start({ linkedin });

    const { state } = await (await s.get("/api/auth/linkedin/start")).json();
    const res = await s.get(`/api/auth/linkedin/callback?code=the-code&state=${state}`, {
      redirect: "manual",
    });

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/#linkedin-connected");
    // The tokens must not appear in the redirect URL.
    expect(res.headers.get("location")).not.toContain("li-token");
  });

  it("hands the tokens to the wizard exactly once", async () => {
    const linkedin = {
      authorizeUrl: vi.fn().mockResolvedValue({ url: "https://linkedin.com/oauth" }),
      exchange: vi.fn().mockResolvedValue({ accessToken: "li-token", authorUrn: "urn:li:person:abc" }),
    };
    const s = await start({ linkedin });

    const { state } = await (await s.get("/api/auth/linkedin/start")).json();
    await s.get(`/api/auth/linkedin/callback?code=the-code&state=${state}`);

    const first = await s.get(`/api/auth/linkedin/result?state=${state}`);
    expect(first.status).toBe(200);
    expect((await first.json()).accessToken).toBe("li-token");

    const second = await s.get(`/api/auth/linkedin/result?state=${state}`);
    expect(second.status).toBe(404);
  });

  it("404s when the wizard asks for a result that does not exist", async () => {
    const s = await start();
    expect((await s.get("/api/auth/linkedin/result?state=nope")).status).toBe(404);
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

  it("lets you start over after a completed authorization", async () => {
    // A wizard user who mistypes a redirect URI, or clicks twice, must not be
    // locked out: a burned state token used to make every retry a CSRF replay.
    const linkedin = {
      authorizeUrl: vi.fn().mockResolvedValue({ url: "https://linkedin.com/oauth" }),
      exchange: vi.fn().mockResolvedValue({ accessToken: "tok", authorUrn: "urn:li:person:abc" }),
    };
    const s = await start({ linkedin });

    const first = await (await s.get("/api/auth/linkedin/start")).json();
    await s.get(`/api/auth/linkedin/callback?code=a&state=${first.state}`, { redirect: "manual" });

    const second = await (await s.get("/api/auth/linkedin/start")).json();
    expect(second.state).not.toBe(first.state);

    const retry = await s.get(`/api/auth/linkedin/callback?code=b&state=${second.state}`, {
      redirect: "manual",
    });
    expect(retry.status).toBe(302);
  });

  it("still refuses a replay of an already-used state token", async () => {
    const linkedin = {
      authorizeUrl: vi.fn().mockResolvedValue({ url: "https://linkedin.com/oauth" }),
      exchange: vi.fn().mockResolvedValue({ accessToken: "tok" }),
    };
    const s = await start({ linkedin });

    const { state } = await (await s.get("/api/auth/linkedin/start")).json();
    await s.get(`/api/auth/linkedin/callback?code=a&state=${state}`, { redirect: "manual" });

    expect(
      (await s.get(`/api/auth/linkedin/callback?code=a&state=${state}`, { redirect: "manual" })).status
    ).toBe(400);
  });

  it("explains a stray callback rather than calling it a CSRF", async () => {
    const s = await start({
      linkedin: { authorizeUrl: vi.fn(), exchange: vi.fn() },
    });
    // No authorization was ever started.
    const res = await s.get("/api/auth/linkedin/callback?code=orphan");
    expect((await res.json()).error).toMatch(/does not match an authorization in progress/);
  });

  it("refuses to reuse a state token", async () => {
    const linkedin = {
      authorizeUrl: vi.fn().mockResolvedValue({ url: "https://linkedin.com/oauth" }),
      exchange: vi.fn().mockResolvedValue({ accessToken: "t" }),
    };
    const s = await start({ linkedin });

    const { state } = await (await s.get("/api/auth/linkedin/start")).json();
    expect(
      (await s.get(`/api/auth/linkedin/callback?code=a&state=${state}`, { redirect: "manual" })).status
    ).toBe(302);

    // A replayed callback must not mint another token.
    linkedin.exchange.mockClear();
    const replay = await s.get(`/api/auth/linkedin/callback?code=a&state=${state}`);
    expect(replay.status).toBe(400);
    expect(linkedin.exchange).not.toHaveBeenCalled();
  });
});
