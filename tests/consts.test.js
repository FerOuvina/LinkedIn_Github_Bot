import { describe, it, expect, vi, afterEach } from "vitest";

/** Import consts.js with a controlled environment (dotenv never overrides existing vars). */
async function loadConsts(env) {
  vi.resetModules();
  const saved = process.env;
  process.env = { ...saved, ...env };
  try {
    return await import("../scripts/consts.js");
  } finally {
    process.env = saved;
  }
}

const CLEARED = {
  GITHUB_TOKEN: undefined,
  LINKEDIN_ACCESS_TOKEN: undefined,
  HUGGINGFACE_API_KEY: undefined,
  LINKEDIN_AUTHOR_URN: undefined,
  HUB_USER: undefined,
};

const FILLED = {
  GITHUB_TOKEN: "gh-token",
  LINKEDIN_ACCESS_TOKEN: "li-token",
  HUGGINGFACE_API_KEY: "hf-key",
  LINKEDIN_AUTHOR_URN: "urn:li:person:abc123",
  HUB_USER: "octocat",
};

afterEach(() => {
  vi.resetModules();
});

describe("token constants", () => {
  it("reads each value from the matching environment variable", async () => {
    const { GITHUB_TOKEN, LINKEDIN_TOKEN, HF_API_KEY, LINKEDIN_AUTHOR, HUB_USER } =
      await loadConsts(FILLED);

    expect(GITHUB_TOKEN).toBe("gh-token");
    expect(LINKEDIN_TOKEN).toBe("li-token");
    expect(HF_API_KEY).toBe("hf-key");
    expect(LINKEDIN_AUTHOR).toBe("urn:li:person:abc123");
    expect(HUB_USER).toBe("octocat");
  });

  it("leaves the constants undefined when the variables are absent", async () => {
    const { GITHUB_TOKEN, LINKEDIN_TOKEN, HF_API_KEY, LINKEDIN_AUTHOR, HUB_USER } =
      await loadConsts(CLEARED);

    const missing = {
      GITHUB_TOKEN,
      LINKEDIN_TOKEN,
      HF_API_KEY,
      LINKEDIN_AUTHOR,
      HUB_USER,
    };

    expect(
      Object.entries(missing)
        .filter(([, v]) => !v)
        .map(([k]) => k)
    ).toEqual([
      "GITHUB_TOKEN",
      "LINKEDIN_TOKEN",
      "HF_API_KEY",
      "LINKEDIN_AUTHOR",
      "HUB_USER",
    ]);
  });
});

describe("request headers", () => {
  it("builds GitHub headers from the token", async () => {
    const { GIT_HEADERS } = await loadConsts(FILLED);

    expect(GIT_HEADERS).toEqual({
      Authorization: "Bearer gh-token",
      "User-Agent": "daily-summary-bot",
      Accept: "application/vnd.github+json",
    });
  });

  it("builds LinkedIn headers with the Rest.li protocol version", async () => {
    const { LINKEDIN_HEADERS } = await loadConsts(FILLED);

    expect(LINKEDIN_HEADERS).toEqual({
      Authorization: "Bearer li-token",
      "X-Restli-Protocol-Version": "2.0.0",
      "Content-Type": "application/json",
    });
  });

  it("builds Hugging Face headers from the API key", async () => {
    const { HF_HEADERS } = await loadConsts(FILLED);

    expect(HF_HEADERS).toEqual({
      Authorization: "Bearer hf-key",
      "Content-Type": "application/json",
    });
  });
});
