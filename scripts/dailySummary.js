import { pathToFileURL } from "node:url";
import { envMissing } from "./validations.js";
import { preflight, formatResults } from "./preflight.js";
import run from "./mainScript.js";

/**
 * Entry point for the scheduled job.
 *
 * Returns a process exit code rather than throwing: a day with no commits is a
 * successful no-op, while a failed API call must fail the workflow so it is
 * visible instead of silently reporting success.
 */
export async function main() {
  if (envMissing.length > 0) {
    throw new Error(`Missing env variables: ${envMissing.join(", ")}`);
  }

  // Validate every credential before posting anything, so one run reports all
  // the broken ones instead of failing on them one at a time.
  const health = await preflight();
  console.log(formatResults(health));

  if (!health.ok) {
    const failed = health.results.filter((r) => !r.ok).map((r) => r.name);
    throw new Error(`Credential check failed: ${failed.join(", ")}`);
  }

  const result = await run();

  switch (result) {
    case "published":
      console.log("✅ Posted to LinkedIn.");
      break;
    case "dry-run":
      console.log("✅ Dry run complete — nothing was posted.");
      break;
    case "no-activity":
      console.log("ℹ️ No commits in the last 24h — nothing to post.");
      break;
    case "no-significant-commits":
      console.log("ℹ️ Commits found, but none scored high enough to post.");
      break;
    case "not-scheduled":
      console.log("ℹ️ No language is scheduled for this run.");
      break;
    default:
      throw new Error(`Unexpected run() result: ${result}`);
  }

  return 0;
}

// Only self-execute when invoked directly, not when imported by a test.
const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((err) => {
      console.error(`❌ Daily summary failed: ${err.message}`);
      if (err.status || err.body) {
        console.error(`   status: ${err.status ?? "n/a"}`);
        console.error(`   body: ${err.body ?? "n/a"}`);
      }
      // Non-zero exit marks the workflow run as failed.
      process.exitCode = 1;
    });
}
