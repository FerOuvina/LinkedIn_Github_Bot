import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createServer } from "node:http";
import { runAuth } from "../scripts/linkedinAuth.js";

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
