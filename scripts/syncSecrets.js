import "dotenv/config";
import { spawn } from "node:child_process";

/** Values the scheduled job needs; GITHUB_TOKEN is uploaded as GH_PAT. */
export const REQUIRED_SECRETS = [
  "HUB_USER",
  "GITHUB_TOKEN",
  "LINKEDIN_ACCESS_TOKEN",
  "LINKEDIN_AUTHOR_URN",
  "GROQ_API_KEY",
];

/**
 * Local .env names that cannot be repository secret names.
 *
 * GITHUB_TOKEN: the API rejects the name outright (HTTP 422 — `GITHUB_` is
 * reserved), so it is pushed as GH_PAT. The automatic Actions token is an
 * installation token and cannot call /user, which the preflight check needs.
 */
export const SECRET_ALIASES = {
  GITHUB_TOKEN: "GH_PAT",
};

const SOURCE_BY_SECRET = Object.fromEntries(
  Object.entries(SECRET_ALIASES).map(([source, secret]) => [secret, source])
);

/**
 * Never pushed to the repository.
 *
 * LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET: only needed to run the auth
 * flow locally. The scheduled job posts with the access token alone, so
 * publishing these would hand anyone with repo access the ability to mint
 * tokens as your app.
 */
export const LOCAL_ONLY_SECRETS = [
  "LINKEDIN_CLIENT_ID",
  "LINKEDIN_CLIENT_SECRET",
];

/** Optional secrets: only pushed when the user actually has a value for them. */
const OPTIONAL_SECRETS = ["GROQ_MODEL", "LINKEDIN_REFRESH_TOKEN"];

/**
 * Run a command, optionally writing to stdin, so secret values never appear in
 * the process argument list where other users could see them.
 */
function run(cmd, args = [], { input } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(Object.assign(new Error(`exited with ${code}`), { stdout, stderr }));
    });

    if (input !== undefined) child.stdin.end(input);
    else child.stdin.end();
  });
}

/** Values are never returned or logged — only their names. */
export function planSecrets(
  env = process.env,
  names = [...REQUIRED_SECRETS, ...OPTIONAL_SECRETS, ...LOCAL_ONLY_SECRETS]
) {
  const set = [];
  const missing = [];
  const skipped = [];
  const localOnly = [];

  for (const name of names) {
    const value = env[name];

    // Never attempted: the API rejects these names outright.
    if (LOCAL_ONLY_SECRETS.includes(name)) {
      if (value) localOnly.push(name);
      continue;
    }

    const required = REQUIRED_SECRETS.includes(name);
    const secret = SECRET_ALIASES[name] ?? name;

    if (value) set.push(secret);
    else if (required) missing.push(name);
    else skipped.push(name);
  }

  return { set, missing, skipped, localOnly };
}

/**
 * Push .env values to the repository's Actions secrets using the gh CLI,
 * which handles the libsodium encryption GitHub requires.
 */
export async function syncSecrets({
  env = process.env,
  repo,
  dryRun = true,
  runCmd = run,
} = {}) {
  const plan = planSecrets(env);

  if (plan.missing.length > 0) {
    return { ok: false, applied: false, reason: "missing", ...plan };
  }

  if (dryRun) {
    return { ok: true, applied: false, reason: "dry-run", ...plan };
  }

  try {
    await runCmd("gh", ["--version"]);
  } catch {
    return {
      ok: false,
      applied: false,
      reason: "gh-missing",
      ...plan,
      hint: "Install the GitHub CLI (winget install GitHub.cli) and run `gh auth login`.",
    };
  }

  const applied = [];
  for (const name of plan.set) {
    const args = ["secret", "set", name];
    if (repo) args.push("--repo", repo);

    try {
      // Value goes over stdin, never as an argument.
      await runCmd("gh", args, { input: env[SOURCE_BY_SECRET[name] ?? name] });
      applied.push(name);
    } catch (err) {
      return {
        ok: false,
        applied: false,
        reason: "write-failed",
        ...plan,
        failedSecret: name,
        detail: String(err.stderr ?? err.message).slice(0, 300),
      };
    }
  }

  return { ok: true, applied: true, ...plan, written: applied };
}

export function formatSyncResult(result) {
  if (result.reason === "missing") {
    return `❌ Missing from .env: ${result.missing.join(", ")}`;
  }
  if (result.reason === "gh-missing") {
    return `❌ ${result.hint}`;
  }
  if (result.reason === "write-failed") {
    return `❌ Failed to set ${result.failedSecret}: ${result.detail}`;
  }
if (!result.applied) {
    return [
      `Would set ${result.set.length} secret(s): ${result.set.join(", ")}`,
      result.skipped.length > 0 ? `Skipped (not set): ${result.skipped.join(", ")}` : null,
      ...localOnlyNote(result),
      "Re-run with --apply to write them.",
    ]
      .filter(Boolean)
      .join("\n");
  }
  return [
    `✅ Set ${result.written.length} secret(s): ${result.written.join(", ")}`,
    ...localOnlyNote(result),
  ]
    .filter(Boolean)
    .join("\n");
}

/** These stay on your machine, so say where they went instead of trying. */
function localOnlyNote(result) {
  if (!result.localOnly?.length) return [];
  return [`Kept local only (never pushed to the repository): ${result.localOnly.join(", ")}`];
}

