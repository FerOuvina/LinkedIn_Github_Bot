import "dotenv/config";
import { pathToFileURL } from "node:url";
import { syncSecrets, formatSyncResult } from "./syncSecrets.js";

/** CLI wrapper so the same logic backs both `npm run sync:secrets` and the server. */
export async function main(argv = process.argv.slice(2)) {
  const apply = argv.includes("--apply");
  const repoArg = argv.find((a) => a.startsWith("--repo="));
  const repo = repoArg ? repoArg.slice("--repo=".length) : undefined;

  const result = await syncSecrets({ dryRun: !apply, repo });

  console.log(formatSyncResult(result));
  return result.ok ? 0 : 1;
}

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  try {
    process.exitCode = await main();
  } catch (err) {
    console.error(`❌ ${err.message}`);
    process.exitCode = 1;
  }
}
