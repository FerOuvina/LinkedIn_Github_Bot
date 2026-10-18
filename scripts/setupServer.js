import "dotenv/config";
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { preflight } from "./preflight.js";
import { syncSecrets, formatSyncResult } from "./syncSecrets.js";
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
  linkedin = null,
} = {}) {
  const state = createState();
  const resolvedWebDir =
    webDir ?? path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "web", "dist");

  const routes = {
    "GET /api/health": async (_req, res) => {
      sendJson(res, 200, {
        ok: true,
        node: process.version,
        hasWebUi: existsSync(path.join(resolvedWebDir, "index.html")),
        envMissing,
      });
    },

    "GET /api/preflight": async (_req, res) => {
      const result = await preflightImpl();
      sendJson(res, 200, result);
    },

    // Dry run by default; {"apply": true} actually writes to GitHub.
    "POST /api/secrets": async (req, res) => {
      const body = await readBody(req);
      const result = await syncImpl({
        env,
        repo: body.repo,
        dryRun: body.apply !== true,
      });

      sendJson(res, result.ok ? 200 : 400, { ...result, message: formatSyncResult(result) });
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
        sendJson(res, 200, { ok: true, ...tokens });
      } catch (err) {
        sendJson(res, 502, { ok: false, error: err.message });
      }
    },
  };

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, `http://${host}:${port}`);
    const handler = routes[`${req.method} ${url.pathname}`];

    if (!handler) {
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
      new Promise((resolve) => {
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
  const { listen } = createSetupServer();
  const url = await listen();
  console.log(`\n  Setup server listening on ${url}\n`);
  console.log("  API only for now — the browser UI lands in a later step.");
  console.log("  Press Ctrl+C to stop.\n");
}

