import { requestJson } from "./http.js";
import {
  GIT_HEADERS,
  GROQ_HEADERS,
  GROQ_MODEL,
  LINKEDIN_HEADERS,
} from "./consts.js";

const GROQ_API = "https://api.groq.com/openai/v1";

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
async function checkGroq({ fetchImpl, model = GROQ_MODEL }) {
  const data = await requestJson(`${GROQ_API}/models`, { headers: GROQ_HEADERS }, { fetchImpl });
  const available = new Set((data.data ?? []).map((m) => m.id));

  if (!available.has(model)) {
    const err = new Error(
      `Groq does not serve "${model}". Set GROQ_MODEL to one of: ${[...available].slice(0, 5).join(", ")}`
    );
    err.status = 400;
    throw err;
  }

  try {
    await requestJson(
      `${GROQ_API}/chat/completions`,
      {
        method: "POST",
        headers: GROQ_HEADERS,
        body: JSON.stringify({
          model,
          max_tokens: 1,
          messages: [{ role: "user", content: "ping" }],
        }),
      },
      { fetchImpl, retries: 0 }
    );
    return `model "${model}" is available and the key works`;
  } catch (err) {
    // Only auth and billing failures are conclusive. Anything else (an
    // unsupported probe parameter, say) shouldn't block a working setup.
    const body = String(err.body ?? "");

    if (err.status === 429 || /rate limit/i.test(body)) {
      throw new Error(
        `Groq rate limit hit while checking the key. Wait a moment and re-run — the model itself looks fine.`
      );
    }
    if (err.status === 401 || err.status === 403) {
      throw new Error(`Groq rejected the API key (${err.status}).`);
    }
    if (/credit|billing|insufficient/i.test(body)) {
      throw new Error(
        `Groq account has no credits left. Check https://console.groq.com — ${body}`
      );
    }
    return `model "${model}" is available (usage probe inconclusive: ${err.message})`;
  }
}

/**
 * Validate every credential up front.
 * @returns {Promise<{ok: boolean, results: Array<{name: string, ok: boolean, detail: string}>}>}
 */
export async function preflight({ fetchImpl = fetch, model = GROQ_MODEL } = {}) {
  const opts = { fetchImpl, model };

  const results = await Promise.all([
    check("GitHub", () => checkGitHub(opts)),
    check("LinkedIn", () => checkLinkedIn(opts)),
    check("Groq", () => checkGroq(opts)),
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
