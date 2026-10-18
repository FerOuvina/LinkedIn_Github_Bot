import { describe, it, expect } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ENTRY = path.join(ROOT, "scripts", "dailySummary.js");

/** Run the real CLI as a child process, the way the cron workflow does. */
async function runCli(args = [], env = {}) {
  // Explicitly empty values block dotenv from filling them in from .env.
  const blank = {
    GITHUB_TOKEN: "",
    LINKEDIN_ACCESS_TOKEN: "",
    HUGGINGFACE_API_KEY: "",
    LINKEDIN_AUTHOR_URN: "",
    HUB_USER: "",
  };

  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [ENTRY, ...args], {
      cwd: ROOT,
      env: { ...process.env, ...blank, ...env },
    });
    return { code: 0, stdout, stderr };
  } catch (err) {
    return { code: err.code, stdout: err.stdout, stderr: err.stderr };
  }
}

describe("dailySummary CLI exit codes", () => {
  it("exits non-zero when required env variables are missing", async () => {
    const { code, stderr } = await runCli();

    expect(code).toBe(1);
    expect(stderr).toContain("Missing env variables");
    expect(stderr).toContain("Daily summary failed");
  });

  it("lists every missing variable, not just the first", async () => {
    const { stderr } = await runCli();

    for (const key of [
      "GITHUB_TOKEN",
      "LINKEDIN_TOKEN",
      "LINKEDIN_AUTHOR",
      "HUB_USER",
      "HF_API_KEY",
    ]) {
      expect(stderr).toContain(key);
    }
  });

  it("does not report success when the run fails", async () => {
    const { stdout, stderr } = await runCli();

    expect(stdout).not.toContain("✅");
    expect(stderr).not.toBe("");
  });
});
