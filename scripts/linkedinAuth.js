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

/**
 * Build the URL the browser should be sent to. Exported so the setup wizard can
 * open a popup of its own instead of taking over a local server.
 * @returns {{url: string}}
 */
export function authorizeUrl({ state = randomBytes(16).toString("hex"), redirectUri: redirect = redirectUri() } = {}) {
  requireConfig();

  const url = new URL(AUTH_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId());
  url.searchParams.set("redirect_uri", redirect);
  url.searchParams.set("scope", scopes().join(" "));
  url.searchParams.set("state", state);

  return { url: url.href, state };
}

/**
 * The command that opens the authorize URL. Extracted so it can be asserted on:
 * building it inline once shipped `start "" "undefined"`, which Windows reported
 * as "cannot find 'undefined'" and no test could see.
 * @returns {{command: string, shell: string}}
 */
export function openBrowserCommand(url) {
  if (typeof url !== "string" || !url) {
    throw new Error("Cannot open the browser: the authorize URL is missing.");
  }
  // `start` treats the first quoted argument as a window title, hence "".
  return { command: `start "" "${url}"`, shell: "cmd.exe" };
}

/** Step 1+2: send the user to LinkedIn and capture the code they get back. */
async function authorizeWithBrowser() {
  const redirect = redirectUri();
  const { port, pathname } = new URL(redirect);
  const { state, url: authUrl } = authorizeUrl({ state: randomBytes(16).toString("hex"), redirectUri: redirect });

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

    console.log("\nOpening your browser to authorize this app.\n");
    console.log(`If it doesn't open, paste this into your browser:\n${authUrl}\n`);
    console.log("Waiting for LinkedIn to redirect back...\n");

    const { command, shell } = openBrowserCommand(authUrl);
    import("node:child_process").then(({ exec }) =>
      exec(command, { shell }, () => {})
    );
  });

  return code;
}

/**
 * Step 3: trade the code for tokens, then read the profile to learn who the
 * account is. Exported for the setup wizard.
 * @returns {Promise<{accessToken: string, refreshToken?: string, authorUrn: string, expiresIn?: number}>}
 */
export async function exchange(code, { redirectUri: redirect = redirectUri() } = {}) {
  requireConfig();

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId(),
      client_secret: clientSecret(),
      redirect_uri: redirect,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      `LinkedIn rejected the code: ${data.error ?? res.status} — ${data.error_description ?? ""}`
    );
  }

  const profile = await fetchProfile(data.access_token);

  return {
    ...normalizeTokens(data),
    authorUrn: `urn:li:person:${profile.sub}`,
    name: profile.name,
  };
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

function report({ accessToken, refreshToken, expiresIn, authorUrn, name }) {
  if (!accessToken) throw new Error("LinkedIn returned no access token");

  console.log("\n───────────── copy these ─────────────\n");
  console.log(`LINKEDIN_ACCESS_TOKEN=${accessToken}`);
  console.log(`LINKEDIN_AUTHOR_URN=${authorUrn}`);
  if (refreshToken) console.log(`LINKEDIN_REFRESH_TOKEN=${refreshToken}`);
  console.log("\n──────────────────────────────────────\n");

  console.log(`Signed in as: ${name ?? "unknown"} (${authorUrn})`);
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
    report({ ...normalizeTokens(tokens), authorUrn: `urn:li:person:${profile.sub}`, name: profile.name });
    return;
  }

  const code = await authorizeWithBrowser();
  report(await exchange(code));
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
