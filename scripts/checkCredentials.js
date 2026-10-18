import { pathToFileURL } from "node:url";
import { envMissing } from "./validations.js";
import { preflight, formatResults } from "./preflight.js";

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  try {
    if (envMissing.length > 0) {
      console.error(`❌ Missing env variables: ${envMissing.join(", ")}`);
      process.exitCode = 1;
    } else {
      const health = await preflight();
      console.log(formatResults(health));
      if (!health.ok) process.exitCode = 1;
    }
  } catch (err) {
    console.error(`❌ Credential check failed: ${err.message}`);
    process.exitCode = 1;
  }
}
