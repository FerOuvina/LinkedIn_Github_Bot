import { requestJson } from "./http.js";
import {
  GIT_HEADERS,
  HF_HEADERS,
  HF_MODEL,
  LINKEDIN_HEADERS,
} from "./consts.js";

const HF_ROUTER = "https://router.huggingface.co/v1";

/** One check never blocks the others: the point is to report every problem at once. */
async function check(name, fn) {
  try {
    const detail = await fn();
    return { name, ok: true, detail };
  } catch (err) {
    return { name, ok: false, detail: err.message, status: err.status };
  }
}

async function checkGitHub({ fetchImpl }) {
  const data = await requestJson(
    "https://api.github.com/user",
    { headers: GIT_HEADERS },
    { fetchImpl }
  );
  return `authenticated as ${data.login}`;
}

async function checkLinkedIn({ fetchImpl }) {
  const data = await requestJson(
    "https://api.linkedin.com/v2/userinfo",
    { headers: LINKEDIN_HEADERS },
    { fetchImpl }
  );
  return `authenticated as ${data.name ?? data.sub ?? "unknown user"}`;
}

async function checkHuggingFaceModel({ fetchImpl, model = HF_MODEL }) {
  const data = await requestJson(`${HF_ROUTER}/models`, { headers: HF_HEADERS }, { fetchImpl });
  const available = new Set((data.data ?? []).map((m) => m.id));

  if (!available.has(model)) {
    const err = new Error(
      `Model "${model}" is not served by the HF router. Set HF_MODEL to an available model.`
    );
    err.status = 400;
    throw err;
  }

  return `model "${model}" is available`;
}

/**
 * Validate every credential up front.
 * @returns {Promise<{ok: boolean, results: Array<{name: string, ok: boolean, detail: string}>}>}
 */
export async function preflight({ fetchImpl = fetch, model = HF_MODEL } = {}) {
  const opts = { fetchImpl, model };

  const results = await Promise.all([
    check("GitHub", () => checkGitHub(opts)),
    check("LinkedIn", () => checkLinkedIn(opts)),
    check("Hugging Face", () => checkHuggingFaceModel(opts)),
  ]);

  return { ok: results.every((r) => r.ok), results };
}

export function formatResults({ ok, results }) {
  const lines = results.map((r) => `  ${r.ok ? "✅" : "❌"} ${r.name}: ${r.detail}`);
  return [
    ok ? "✅ All credentials look good." : "❌ Some credentials need attention:",
    ...lines,
  ].join("\n");
}
