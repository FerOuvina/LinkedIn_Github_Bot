import { envMissing } from "./validations.js";
import run from "./mainScript.js";

// Check if any env is missing
if (envMissing.length > 0) {
  throw new Error(`Missing env variables: ${envMissing.join(", ")}`);
} else {
  run().catch((err) => console.error(err));
}
