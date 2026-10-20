import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createServer } from "node:http";
import { exec } from "node:child_process";
import { runAuth, authorizeUrl, exchange, openBrowserCommand } from "../scripts/linkedinAuth.js";

// The script shells out dynamically to open the browser; capture that call so
// the exact command can be asserted on.
vi.mock("node:child_process", async (importOriginal) => ({
  ...(await importOriginal()),
  exec: vi.fn(),
}));

const PROFILE = { sub: "abc123", name: "Ada Lovelace" };

function jsonResponse(data, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => data, text: async () => JSON.stringify(data) };
}

const ENV = {
  LINKEDIN_CLIENT_ID: "client-123",
  LINKEDIN_CLIENT_SECRET: "secret-456",
  LINKEDIN_REDIRECT_URI: "",
};

let logSpy;
let savedEnv;

beforeEach(() => {
  savedEnv = { ...process.env };
  Object.assign(process.env, ENV);
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  vi.resetModules();
});

afterEach(() => {
  process.env = savedEnv;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** Point runAuth at a free port and drive the callback ourselves. */
async function withAuthServer(run, { drive }) {
  const server = createServer();
  await new Promise((r) => server.listen(0, r));
  const { port } = server.address();

  process.env.LINKEDIN_REDIRECT_URI = `http://localhost:${port}/callback`;

  // Reuse the auth flow's own server by racing it against our callback.
  const pending = run().catch((e) => e);

  await new Promise((r) => setTimeout(r, 50));
  await drive(port);
  server.close();

  return pending;
}

describe("authorizeUrl / exchange (used by the setup wizard)", () => {
  it("builds an authorize url carrying the client id, scopes and state", () => {
    const { url, state } = authorizeUrl({ state: "the-state", redirectUri: "http://127.0.0.1:4319/cb" });
    const parsed = new URL(url);

    expect(parsed.origin + parsed.pathname).toBe("https://www.linkedin.com/oauth/v2/authorization");
    expect(parsed.searchParams.get("response_type")).toBe("code");
    expect(parsed.searchParams.get("client_id")).toBe("client-123");
    expect(parsed.searchParams.get("state")).toBe("the-state");
    expect(parsed.searchParams.get("redirect_uri")).toBe("http://127.0.0.1:4319/cb");
    expect(parsed.searchParams.get("scope")).toContain("openid");
    expect(parsed.searchParams.get("scope")).toContain("w_member_social");
  });

  it("defaults redirect_uri to LINKEDIN_REDIRECT_URI", () => {
    process.env.LINKEDIN_REDIRECT_URI = "http://localhost:3000/callback";
    const { url } = authorizeUrl();
    expect(new URL(url).searchParams.get("redirect_uri")).toBe("http://localhost:3000/callback");
  });

  it("refuses to build a url without client credentials", () => {
    delete process.env.LINKEDIN_CLIENT_ID;
    expect(() => authorizeUrl()).toThrow(/LINKEDIN_CLIENT_ID/);
  });

  it("exchanges a code and resolves the author URN from the profile", async () => {
    const fetchImpl = vi.fn().mockImplementation(async (url) => {
      if (String(url).includes("/oauth/v2/accessToken")) {
        return jsonResponse({
          access_token: "fresh-token",
          refresh_token: "fresh-refresh",
          expires_in: 5184000,
        });
      }
      return jsonResponse(PROFILE);
    });
    vi.stubGlobal("fetch", fetchImpl);

    const result = await exchange("the-code", { redirectUri: "http://127.0.0.1:4319/cb" });

    expect(result.accessToken).toBe("fresh-token");
    expect(result.refreshToken).toBe("fresh-refresh");
    expect(result.authorUrn).toBe("urn:li:person:abc123");
    expect(result.name).toBe("Ada Lovelace");

    // The code must be exchanged against the same redirect URI it was issued for.
    const tokenCall = fetchImpl.mock.calls.find(([u]) => String(u).includes("accessToken"));
    const body = new URLSearchParams(tokenCall[1].body.toString());
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("code")).toBe("the-code");
    expect(body.get("redirect_uri")).toBe("http://127.0.0.1:4319/cb");
  });

  it("never puts the client secret in the returned tokens", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (url) =>
        String(url).includes("accessToken")
          ? jsonResponse({ access_token: "t", expires_in: 1 })
          : jsonResponse(PROFILE)
      )
    );

    const result = await exchange("the-code");
    expect(JSON.stringify(result)).not.toContain("secret-456");
  });

  it("surfaces a rejected code with LinkedIn's reason", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          { error: "invalid_grant", error_description: "code expired" },
          { ok: false, status: 400 }
        )
      )
    );

    await expect(exchange("stale")).rejects.toThrow(/code expired/);
  });
});

describe("openBrowserCommand", () => {
  it("passes the real URL to `start`, not undefined", () => {
    const { command, shell } = openBrowserCommand("https://www.linkedin.com/oauth/v2/authorization?x=1");

    expect(command).toBe('start "" "https://www.linkedin.com/oauth/v2/authorization?x=1"');
    expect(command).not.toContain("undefined");
    expect(shell).toBe("cmd.exe");
  });

  it("throws on a missing URL rather than shelling out with it", () => {
    // start "" "undefined" makes Windows say it cannot find 'undefined'.
    expect(() => openBrowserCommand(undefined)).toThrow(/authorize URL is missing/);
    expect(() => openBrowserCommand("")).toThrow(/authorize URL is missing/);
  });

  it("keeps the empty title arg, which start reads as the window title", () => {
    expect(openBrowserCommand("https://x.test").command).toMatch(/^start "" "/);
  });
});

describe("the browser flow prints a usable URL", () => {
  it("never prints or opens an undefined URL", async () => {
    // A refactor once returned a plain string here while the call sites still
    // read .href, so Windows reported it could not find 'undefined'.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (url) =>
        String(url).includes("accessToken")
          ? jsonResponse({ access_token: "t", expires_in: 5184000 })
          : jsonResponse(PROFILE)
      )
    );

    const output = () => logSpy.mock.calls.flat().join("\n");
    const pending = runAuth().catch((e) => e);

    // The shell call is behind a dynamic import, so it lands after the log
    // line. Wait for both rather than guessing at a delay.
    const deadline = Date.now() + 4000;
    while (
      (!/state=[a-f0-9]+/.test(output()) || exec.mock.calls.length === 0) &&
      Date.now() < deadline
    ) {
      await new Promise((r) => setTimeout(r, 25));
    }

    expect(output()).not.toContain("undefined");
    expect(output()).toMatch(/https:\/\/www\.linkedin\.com\/oauth\/v2\/authorization\?\S+/);

    // The command actually handed to the shell — this is what Windows choked on.
    const command = exec.mock.calls.at(-1)?.[0];
    expect(command).toBeDefined();
    expect(command).not.toContain("undefined");
    expect(command).toMatch(/^start "" "https:\/\/www\.linkedin\.com\/oauth/);

    // Deliver the callback so the flow settles and the port is released. The
    // race keeps a missed callback from hanging the whole suite.
    const state = /state=([a-f0-9]+)/.exec(output())?.[1];
    await fetch(`http://localhost:3000/callback?code=the-code&state=${state}`).catch(
      () => {}
    );
    await Promise.race([pending, new Promise((r) => setTimeout(r, 2000))]);
  });
});

describe("linkedinAuth", () => {
  it("refuses to run without client credentials", async () => {
    delete process.env.LINKEDIN_CLIENT_ID;
    delete process.env.LINKEDIN_CLIENT_SECRET;

    await expect(runAuth()).rejects.toThrow(/LINKEDIN_CLIENT_ID/);
  });

  it("names every missing variable at once", async () => {
    delete process.env.LINKEDIN_CLIENT_ID;
    delete process.env.LINKEDIN_CLIENT_SECRET;

    await expect(runAuth()).rejects.toThrow(/CLIENT_ID and LINKEDIN_CLIENT_SECRET/);
  });

  it("reports a bad refresh token with a useful message", async () => {
    process.env.LINKEDIN_REFRESH_TOKEN = "stale-refresh-token";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({ error: "invalid_grant" }, { ok: false, status: 400 })
      )
    );

    const err = await runAuth({ refreshOnly: true }).catch((e) => e);

    expect(err.message).toContain("invalid_grant");
    expect(err.message).toContain("run the full auth flow again");
  });

  it("refuses --refresh without a stored refresh token", async () => {
    delete process.env.LINKEDIN_REFRESH_TOKEN;

    await expect(runAuth({ refreshOnly: true })).rejects.toThrow(
      /LINKEDIN_REFRESH_TOKEN is not set/
    );
  });

  it("prints the token, URN and refresh token on success", async () => {
    process.env.LINKEDIN_REFRESH_TOKEN = "old-refresh";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (url) => {
        if (String(url).includes("/oauth/v2/accessToken")) {
          return jsonResponse({
            access_token: "new-access-token",
            refresh_token: "new-refresh-token",
            expires_in: 5184000,
          });
        }
        return jsonResponse(PROFILE);
      })
    );

    await runAuth({ refreshOnly: true });

    const output = logSpy.mock.calls.flat().join("\n");
    expect(output).toContain("LINKEDIN_ACCESS_TOKEN=new-access-token");
    expect(output).toContain("LINKEDIN_AUTHOR_URN=urn:li:person:abc123");
    expect(output).toContain("LINKEDIN_REFRESH_TOKEN=new-refresh-token");
    expect(output).toContain("Ada Lovelace");
    expect(output).toContain("60 days");
  });

  it("explains the absence of a refresh token instead of printing an empty line", async () => {
    process.env.LINKEDIN_REFRESH_TOKEN = "old";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (url) => {
        if (String(url).includes("accessToken")) {
          // No refresh_token: what LinkedIn returns for non-partner apps.
          return jsonResponse({ access_token: "new-access-token", expires_in: 5184000 });
        }
        return jsonResponse(PROFILE);
      })
    );

    await runAuth({ refreshOnly: true });

    const output = logSpy.mock.calls.flat().join("\n");
    expect(output).toContain("No refresh token was issued");
    expect(output).toContain("partner apps");
    expect(output).not.toContain("LINKEDIN_REFRESH_TOKEN=");
  });

  it("tells you how to renew when a refresh token is present", async () => {
    process.env.LINKEDIN_REFRESH_TOKEN = "old";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (url) => {
        if (String(url).includes("accessToken")) {
          return jsonResponse({
            access_token: "tok",
            refresh_token: "ref",
            expires_in: 5184000,
          });
        }
        return jsonResponse(PROFILE);
      })
    );

    await runAuth({ refreshOnly: true });

    const output = logSpy.mock.calls.flat().join("\n");
    expect(output).toContain("--refresh");
  });

  it("sends the refresh grant rather than the authorization code grant", async () => {
    process.env.LINKEDIN_REFRESH_TOKEN = "old-refresh";
    const fetchImpl = vi.fn().mockImplementation(async (url) => {
      if (String(url).includes("/oauth/v2/accessToken")) {
        return jsonResponse({ access_token: "t", refresh_token: "r", expires_in: 100 });
      }
      return jsonResponse(PROFILE);
    });
    vi.stubGlobal("fetch", fetchImpl);

    await runAuth({ refreshOnly: true });

    const tokenCall = fetchImpl.mock.calls.find(([u]) => String(u).includes("accessToken"));
    const body = new URLSearchParams(tokenCall[1].body.toString());
    expect(body.get("grant_type")).toBe("refresh_token");
    expect(body.get("refresh_token")).toBe("old-refresh");
    // No redirect_uri is sent on a refresh, per LinkedIn's spec.
    expect(body.get("redirect_uri")).toBeNull();
  });

  it("fails clearly when the profile can't be read", async () => {
    process.env.LINKEDIN_REFRESH_TOKEN = "r";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (url) => {
        if (String(url).includes("accessToken")) {
          return jsonResponse({ access_token: "t" });
        }
        return jsonResponse({ message: " insufficient scope" }, { ok: false, status: 403 });
      })
    );

    await expect(runAuth({ refreshOnly: true })).rejects.toThrow(/insufficient scope/);
  });
});
