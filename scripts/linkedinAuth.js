import "dotenv/config";
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { pathToFileURL } from "node:url";

// Read lazily so tests (and .env reloads) are not frozen at import time.
const clientId = () => process.env.LINKEDIN_CLIENT_ID;
const clientSecret = () => process.env.LINKEDIN_CLIENT_SECRET;
const redirectUri = () =>
  process.env.LINKEDIN_REDIRECT_URI || "http://localhost:3000/callback";
const scopes = () =>
  (process.env.LINKEDIN_SCOPES || "openid profile w_member_social")
    .split(" ")
    .filter(Boolean);

const AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization";
const TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const USERINFO_URL = "https://api.linkedin.com/v2/userinfo";

function requireConfig() {
  const missing = [];
  if (!clientId()) missing.push("LINKEDIN_CLIENT_ID");
  if (!clientSecret()) missing.push("LINKEDIN_CLIENT_SECRET");
  if (missing.length > 0) {
    throw new Error(
      `Missing ${missing.join(" and ")}. Add them to your .env — see docs/LINKEDIN_SETUP.md.`
    );
  }
}

/** Step 1+2: send the user to LinkedIn and capture the code they get back. */
async function authorizeWithBrowser() {
  const redirect = redirectUri();
  const { port, pathname } = new URL(redirect);
  const state = randomBytes(16).toString("hex");

  const code = await new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url, redirect);

      if (url.pathname !== pathname) {
        res.writeHead(404).end("Not found");
        return;
      }

      const params = url.searchParams;
      const error = params.get("error");

      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(
        error
          ? `<h1>Authorization failed</h1><p>${params.get("error_description") ?? error}</p>`
          : "<h1>✅ Got it — you can close this tab.</h1>"
      );
      server.close();

      if (error) reject(new Error(params.get("error_description") ?? error));
      else if (params.get("state") !== state) reject(new Error("state mismatch — possible CSRF, aborting"));
      else if (!params.get("code")) reject(new Error("LinkedIn returned no authorization code"));
      else resolve(params.get("code"));
    });

    server.on("error", (err) =>
      reject(
        new Error(
          `Could not listen on port ${port} (${err.code}). Is the redirect URI registered as "${redirect}" in your LinkedIn app?`
        )
      )
    );
    server.listen(port);

    const authUrl = new URL(AUTH_URL);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", clientId());
    authUrl.searchParams.set("redirect_uri", redirect);
    authUrl.searchParams.set("scope", scopes().join(" "));
    authUrl.searchParams.set("state", state);

    console.log("\nOpening your browser to authorize this app.\n");
    console.log(`If it doesn't open, paste this into your browser:\n${authUrl.href}\n`);
    console.log("Waiting for LinkedIn to redirect back...\n");

    import("node:child_process").then(({ exec }) =>
      exec(`start "" "${authUrl.href}"`, { shell: "cmd.exe" }, () => {})
    );
  });

  return code;
}

/** Step 3: trade the code for tokens. */
async function exchangeCode(code) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId(),
      client_secret: clientSecret(),
      redirect_uri: redirectUri(),
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      `LinkedIn rejected the code: ${data.error ?? res.status} — ${data.error_description ?? ""}`
    );
  }
  return data;
}

/** No browser needed: mint a new access token from a stored refresh token. */
async function refreshAccessToken() {
  const refreshToken = process.env.LINKEDIN_REFRESH_TOKEN;
  if (!refreshToken) {
    throw new Error("LINKEDIN_REFRESH_TOKEN is not set — run the full auth flow once first.");
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId(),
      client_secret: clientSecret(),
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      `Refresh failed: ${data.error ?? res.status} — ${data.error_description ?? "the refresh token is dead, run the full auth flow again"}`
    );
  }
  return data;
}

async function fetchProfile(accessToken) {
  const res = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Could not read your profile: ${data.message ?? res.status}`);
  }
  return data;
}

/** LinkedIn returns snake_case; normalise so callers can't silently get undefined. */
function normalizeTokens(tokens) {
  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresIn: tokens.expires_in,
  };
}

function report({ accessToken, refreshToken, expiresIn, profile }) {
  if (!accessToken) throw new Error("LinkedIn returned no access token");
  const urn = `urn:li:person:${profile.sub}`;

  console.log("\n───────────── copy these ─────────────\n");
  console.log(`LINKEDIN_ACCESS_TOKEN=${accessToken}`);
  console.log(`LINKEDIN_AUTHOR_URN=${urn}`);
  if (refreshToken) console.log(`LINKEDIN_REFRESH_TOKEN=${refreshToken}`);
  console.log("\n──────────────────────────────────────\n");

  console.log(`Signed in as: ${profile.name ?? "unknown"} (${urn})`);
  if (expiresIn) {
    console.log(`Access token expires in ${Math.round(expiresIn / 86400)} days.`);
  }

  if (refreshToken) {
    console.log(
      "\nStore LINKEDIN_REFRESH_TOKEN too — it lets you renew later with\nnpm run auth:linkedin -- --refresh, without a browser."
    );
  } else {
    // Programmatic refresh tokens are only issued to approved partner apps, so
    // most apps get none. Saying so beats printing a line that never appears.
    console.log(
      "\nNo refresh token was issued. LinkedIn only grants those to approved\npartner apps, so renew by running `npm run auth:linkedin` again in ~60\ndays — the consent screen is skipped while you're still signed in."
    );
  }

  console.log(
    "\nNext: add these to .env for local runs, and as GitHub repository secrets\n(Settings → Secrets and variables → Actions) for the scheduled job."
  );
}

export async function runAuth({ refreshOnly = false } = {}) {
  requireConfig();

  if (refreshOnly) {
    const tokens = await refreshAccessToken();
    const profile = await fetchProfile(tokens.access_token);
    report({ ...normalizeTokens(tokens), profile });
    return;
  }

  const code = await authorizeWithBrowser();
  const tokens = await exchangeCode(code);
  const profile = await fetchProfile(tokens.access_token);
  report({ ...normalizeTokens(tokens), profile });
}

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  try {
    await runAuth({ refreshOnly: process.argv.includes("--refresh") });
  } catch (err) {
    console.error(`\n❌ ${err.message}\n`);
    process.exitCode = 1;
  }
}
