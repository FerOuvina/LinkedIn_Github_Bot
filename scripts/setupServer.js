import "dotenv/config";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { preflight } from "./preflight.js";
import { syncSecrets, formatSyncResult } from "./syncSecrets.js";
import { writeEnvFile } from "./envFile.js";
import { stripBase, WEB_BASE } from "./webBase.js";
import { envMissing } from "./validations.js";

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };

function sendJson(res, status, body) {
  res.writeHead(status, JSON_HEADERS);
  res.end(JSON.stringify(body));
}

async function readBody(req, { limit = 1_000_000 } = {}) {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error("Request body too large");
    chunks.push(chunk);
  }

  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

/** Is the GitHub CLI present and signed in? Needed to write Actions secrets. */
function checkGh() {
  return new Promise((resolve) => {
    const child = spawn("gh", ["--version"], { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    child.stdout.on("data", (d) => (out += d));

    child.on("error", () => resolve({ installed: false, authenticated: false }));
    child.on("close", async (code) => {
      if (code !== 0) {
        resolve({ installed: false, authenticated: false });
        return;
      }
      const auth = spawn("gh", ["auth", "status"], { stdio: ["ignore", "pipe", "pipe"] });
      let authOut = "";
      auth.stdout.on("data", (d) => (authOut += d));
      auth.on("error", () => resolve({ installed: true, authenticated: false }));
      auth.on("close", (authCode) =>
        resolve({ installed: true, authenticated: authCode === 0, version: out.split("\n")[0] })
      );
    });
  });
}

/** Run the actual bot in dry-run mode so the wizard tests the real path. */
function defaultDryRun() {
  const script = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "dailySummary.js"
  );

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, "--dry-run"], {
      cwd: path.join(path.dirname(fileURLToPath(import.meta.url)), ".."),
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", reject);
    child.on("close", (code) => resolve({ stdout, stderr, code }));
  });
}

/** Single-use: a replayed callback must not be able to mint a second token. */
function createState() {
  const value = randomBytes(24).toString("hex");
  let consumed = false;
  return {
    value,
    isValid: (candidate) => {
      if (consumed || typeof candidate !== "string") return false;
      const matches = timingSafeEqualString(candidate, value);
      if (matches) consumed = true;
      return matches;
    },
  };
}

function timingSafeEqualString(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function createSetupServer({
  port = 4319,
  host = "127.0.0.1",
  webDir,
  preflightImpl = preflight,
  syncImpl = syncSecrets,
  env = process.env,
  envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".env"),
  linkedin = null,
  dryRunImpl,
  ghCheckImpl,
  docsDir,
  webBase = WEB_BASE,
} = {}) {
  const state = createState();
  /** Tokens waiting to be collected by the wizard. In memory only. */
  const pending = new Map();
  const runDryRunImpl = dryRunImpl ?? defaultDryRun;
  const resolvedDocsDir =
    docsDir ?? path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "docs");

  const resolvedWebDir =
    webDir ?? path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "web", "dist");

  const MIME = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".svg": "image/svg+xml",
    ".json": "application/json",
    ".ico": "image/x-icon",
    ".png": "image/png",
    ".jpg": "image/jpeg",
  };

  /** Serve the built wizard. Client routes fall back to the app shell. */
  function serveStatic(pathname, res) {
    const distRoot = path.resolve(resolvedWebDir);
    const indexFile = path.join(distRoot, "index.html");

    const send = (file) => {
      res.writeHead(200, {
        "Content-Type": MIME[path.extname(file)] ?? "application/octet-stream",
      });
      res.end(readFileSync(file));
    };

    // Assets must be real files: returning HTML for a missing JS file produces
    // a confusing "unexpected token <" error in the console.
    if (pathname.startsWith("/assets/")) {
      const target = path.join(distRoot, pathname.replace(/^\/+/, ""));
      if (!target.startsWith(distRoot)) return false;
      if (!existsSync(target) || !statSync(target).isFile()) return false;
      send(target);
      return true;
    }

    // Anything else is a client route (/guide, /getting-started).
    if (!existsSync(indexFile)) return false;
    send(indexFile);
    return true;
  }

  const routes = {
    "GET /api/health": async (_req, res) => {
      sendJson(res, 200, {
        ok: true,
        node: process.version,
        hasWebUi: existsSync(path.join(resolvedWebDir, "index.html")),
        envMissing,
        gh: await (ghCheckImpl ?? checkGh)(),
      });
    },



    "GET /api/preflight": async (_req, res) => {
      const result = await preflightImpl();
      sendJson(res, 200, result);
    },

    // Dry run by default. Writes GitHub secrets and/or the local .env, so the
    // scheduled job and local runs both end up with the same credentials.
    "POST /api/secrets": async (req, res) => {
      const body = await readBody(req);
      const apply = body.apply === true;
      const targets = {
        github: body.github !== false,
        env: body.env === true,
      };

      const values = body.values && typeof body.values === "object" ? body.values : env;
      const result = await syncImpl({
        env: values,
        repo: body.repo,
        dryRun: !apply,
      });

      if (result.ok && apply && targets.env) {
        const envResult = writeEnvFile(envPath, values);
        result.envUpdated = envResult.updated;
      }

      sendJson(res, result.ok ? 200 : 400, {
        ...result,
        message: formatSyncResult(result),
      });
    },

    // Credentials collected in the browser, to be written on the next save.
    "POST /api/env/preview": async (req, res) => {
      const body = await readBody(req);
      const names = Object.keys(body.values ?? {}).filter(
        (k) => body.values[k] !== undefined && body.values[k] !== ""
      );
      sendJson(res, 200, { ok: true, names, count: names.length });
    },

    "GET /api/auth/linkedin/start": async (_req, res) => {
      if (!linkedin) {
        sendJson(res, 501, { ok: false, error: "LinkedIn auth is not wired into the server yet." });
        return;
      }
      const { url } = await linkedin.authorizeUrl({ state: state.value });
      sendJson(res, 200, { ok: true, url, state: state.value });
    },

    "GET /api/auth/linkedin/callback": async (req, res, url) => {
      if (!linkedin) {
        sendJson(res, 501, { ok: false, error: "LinkedIn auth is not wired into the server yet." });
        return;
      }

      const error = url.searchParams.get("error");
      if (error) {
        sendJson(res, 400, {
          ok: false,
          error: url.searchParams.get("error_description") ?? error,
        });
        return;
      }

      if (!state.isValid(url.searchParams.get("state"))) {
        sendJson(res, 400, { ok: false, error: "state mismatch — possible CSRF, aborting" });
        return;
      }

      try {
        const tokens = await linkedin.exchange(url.searchParams.get("code"), {
          redirectUri: env.LINKEDIN_REDIRECT_URI,
        });

        // Hold the tokens server-side and redirect the popup back to the app.
        // Putting them in a URL would leak them into history and referrers.
        pending.set(state.value, tokens);

        res.writeHead(302, { Location: "/#linkedin-connected" });
        res.end();
      } catch (err) {
        sendJson(res, 502, { ok: false, error: err.message });
      }
    },

    // The wizard polls this once LinkedIn has redirected back.
    "GET /api/auth/linkedin/result": async (req, res, url) => {
      const key = url.searchParams.get("state");
      const tokens = key ? pending.get(key) : null;

      if (!tokens) {
        sendJson(res, 404, { ok: false, error: "No completed authorization found." });
        return;
      }

      pending.delete(key); // single read, like the state token
      sendJson(res, 200, { ok: true, ...tokens });
    },

    // Runs the real bot in dry-run mode and returns what it printed.
    "POST /api/dry-run": async (_req, res) => {
      try {
        const { stdout, stderr, code } = await runDryRunImpl();
        sendJson(res, 200, { ok: code === 0, exitCode: code, stdout, stderr });
      } catch (err) {
        sendJson(res, 500, { ok: false, error: err.message });
      }
    },
  };

  /** Serve markdown guides and their images straight from docs/. */
  function serveDocs(pathname, res) {
    const relative = pathname.replace(/^\/docs\/?/, "");
    if (!relative) {
      res.writeHead(302, { Location: "/docs/LINKEDIN_SETUP.md" });
      res.end();
      return true;
    }

    const target = path.join(resolvedDocsDir, relative);

    if (!target.startsWith(path.resolve(resolvedDocsDir))) return false;
    if (!existsSync(target) || !statSync(target).isFile()) return false;

    const ext = path.extname(target);
    res.writeHead(200, {
      "Content-Type":
        ext === ".md"
          ? "text/plain; charset=utf-8"
          : MIME[ext] ?? "application/octet-stream",
    });
    res.end(readFileSync(target));
    return true;
  }

  const server = createServer(async (req, res) => {
    const rawUrl = new URL(req.url, `http://${host}:${port}`);
    // The built app may be mounted under a base path (Pages) or at the root
    // (local). Both must work, so strip the prefix if it is present.
    const url = new URL(
      stripBase(rawUrl.pathname, webBase) + rawUrl.search,
      `http://${host}:${port}`
    );
    const handler = routes[`${req.method} ${url.pathname}`];

    if (!handler) {
      if (url.pathname === "/docs" || url.pathname.startsWith("/docs/")) {
        if (!serveDocs(url.pathname, res)) {
          sendJson(res, 404, { ok: false, error: `No doc at ${url.pathname}` });
        }
        return;
      }
      // An unknown /api path must stay a JSON 404, never the app shell.
      if (!url.pathname.startsWith("/api/") && serveStatic(url.pathname, res)) return;
      sendJson(res, 404, { ok: false, error: `No route for ${req.method} ${url.pathname}` });
      return;
    }

    try {
      await handler(req, res, url);
    } catch (err) {
      if (!res.headersSent) sendJson(res, 500, { ok: false, error: err.message });
    }
  });

  return {
    server,
    listen: () =>
      new Promise((resolve, reject) => {
        server.once("error", (err) => {
          reject(
            err.code === "EADDRINUSE"
              ? new Error(
                  `Port ${port} is already in use — another setup server may already be running. Close it, or set PORT to something else.`
                )
              : err
          );
        });
        server.listen(port, host, () =>
          resolve(`http://${host}:${server.address().port}`)
        );
      }),
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  try {
    const { listen } = createSetupServer();
    const url = await listen();
    const built = existsSync(
      path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "web", "dist", "index.html")
    );

    console.log(`\n  Setup server listening on ${url}\n`);

    if (built) {
      console.log("  Open that address to run the setup wizard.");
    } else {
      console.log("  The browser UI has not been built yet, so the API only.");
      console.log("  Build it with:  npm install && npm run build   (inside web/)");
      console.log("  Or skip the wizard entirely and use:  npm run preflight");
    }

    console.log("\n  Press Ctrl+C to stop.\n");
  } catch (err) {
    console.error(`\n  ❌ Could not start the setup server: ${err.message}\n`);
    process.exitCode = 1;
  }
}

