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

/**
 * A ~1 token completion. Cheap enough to run daily, and it is the only way to
 * find out whether the account can actually be billed — a model can be listed
 * on the router while the key has no credits left.
 */
async function checkHuggingFace({ fetchImpl, model = HF_MODEL }) {
  const data = await requestJson(`${HF_ROUTER}/models`, { headers: HF_HEADERS }, { fetchImpl });
  const available = new Set((data.data ?? []).map((m) => m.id));

  if (!available.has(model)) {
    const err = new Error(
      `Model "${model}" is not served by the HF router. Set HF_MODEL to an available model.`
    );
    err.status = 400;
    throw err;
  }

  try {
    await requestJson(
      `${HF_ROUTER}/chat/completions`,
      {
        method: "POST",
        headers: HF_HEADERS,
        body: JSON.stringify({
          model,
          max_tokens: 1,
          messages: [{ role: "user", content: "ping" }],
        }),
      },
      { fetchImpl, retries: 0 }
    );
    return `model "${model}" is available and the key has credits`;
  } catch (err) {
    // Only auth and billing failures are conclusive. Anything else (an
    // unsupported probe parameter, say) shouldn't block a working setup.
    if (err.status === 402) {
      throw new Error(
        `No Hugging Face credits left, so the post will fail. Top up at https://huggingface.co/settings/billing — ${err.body ?? err.message}`
      );
    }
    if (err.status === 401 || err.status === 403) {
      throw new Error(`Hugging Face rejected the API key (${err.status}).`);
    }
    return `model "${model}" is available (usage probe inconclusive: ${err.message})`;
  }
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
    check("Hugging Face", () => checkHuggingFace(opts)),
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
