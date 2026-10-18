import "dotenv/config";
import { requestJson } from "./http.js";
import { GROQ_HEADERS, GROQ_MODEL } from "./consts.js";

export const GROQ_API = "https://api.groq.com/openai/v1";

export const SYSTEM_PROMPT =
  "Start the post with normal greetings, something nice or similar but short, respond ONLY with the LinkedIn post text. Do not add any preamble, explanation, or labels, and DON'T forget to add a space after every emoji.";

/**
 * Single source of truth for the request shape. The preflight probe reuses this,
 * so a model that can't handle the real payload fails the check instead of
 * failing at post time.
 */
export function buildMessages(prompt) {
  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: prompt },
  ];
}

export function buildSummaryPayload(prompt, model = GROQ_MODEL) {
  return { model, messages: buildMessages(prompt) };
}

export async function summarize(prompt, { fetchImpl = fetch, model = GROQ_MODEL } = {}) {
  const data = await requestJson(
    `${GROQ_API}/chat/completions`,
    {
      method: "POST",
      headers: GROQ_HEADERS,
      body: JSON.stringify(buildSummaryPayload(prompt, model)),
      retries: 0,
    },
    { fetchImpl }
  );

  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error(`Unexpected Groq response shape: ${JSON.stringify(data)}`);
  }
  return content;
}

/** One token, but shaped exactly like a real request so format errors surface. */
export async function probeModel({ fetchImpl = fetch, model = GROQ_MODEL } = {}) {
  return requestJson(
    `${GROQ_API}/chat/completions`,
    {
      method: "POST",
      headers: GROQ_HEADERS,
      body: JSON.stringify({ model, max_tokens: 1, messages: buildMessages("ping") }),
      retries: 0,
    },
    { fetchImpl }
  );
}
