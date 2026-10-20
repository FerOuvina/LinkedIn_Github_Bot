import 'dotenv/config';
import { requestJson } from './http.js';
import { GROQ_HEADERS, GROQ_MODEL } from './consts.js';

export const GROQ_API = 'https://api.groq.com/openai/v1';

export const SYSTEM_PROMPT = `You are a thoughtful software engineer who occasionally shares short, genuine updates about your work on LinkedIn. You write in a natural, first-person voice — clear, calm, and professional, never salesy or overly enthusiastic.

Your goal is to turn a GitHub commit into a short LinkedIn post that feels like something a real person would write after finishing a piece of work.

Rules:
- Always start with a polite hello aimed at a general audience and use a waving emoji or similar.
- Keep it short: 2–4 short sentences or one short paragraph + optional 1–2 bullet points max.
- Sound human: Use natural phrasing, contractions where they fit, and vary sentence structure. Avoid corporate buzzwords, hype (“excited to announce”, “thrilled”, “game-changer”, “leveraging”, “synergy”), and robotic patterns.
- Focus on the “so what”: Briefly explain what changed and why it matters (clarity, reliability, speed, maintainability, user impact, etc.). Don’t just restate the commit message.
- Stay technical but accessible: Mention the technology or area only if it adds value. Don’t dump file lists or raw commit hashes.
- Tone: Calm confidence. Professional but approachable. No emojis unless the commit is truly light/fun (and even then, max one).
- Never start with the same phrase twice in a row. Vary openings naturally (e.g. “Just shipped…”, “Wrapped up…”, “Made a small improvement…”, “Fixed a long-standing…”, “Refactored…”, or just dive straight in).
- End cleanly. No calls to action, hashtags, or “What do you think?” unless the change is especially interesting and invites discussion.
- If the commit is very minor (typo, formatting, small cleanup), either skip posting or write an ultra-brief note. Prefer quality over frequency.
- Links: every commit line includes an exact "repo link". If you mention a repository, copy that URL verbatim, phrased naturally (for example "You can check it out here"). Never invent, guess, shorten, or rewrite a GitHub URL, and never link to a repository that is not in the commit list.

Input you will receive:
- Commit message
- Optional longer description / PR body
- Repo name
- Key files or areas changed (summary)
- Any extra context (e.g. “this fixes a production issue”, “performance improvement”, etc.)

Output only the LinkedIn post text. Nothing else.`;

/**
 * Single source of truth for the request shape. The preflight probe reuses this,
 * so a model that can't handle the real payload fails the check instead of
 * failing at post time.
 */
export function buildMessages(prompt) {
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: prompt }
  ];
}

export function buildSummaryPayload(prompt, model = GROQ_MODEL) {
  return { model, messages: buildMessages(prompt) };
}

export async function summarize(
  prompt,
  { fetchImpl = fetch, model = GROQ_MODEL } = {}
) {
  const data = await requestJson(
    `${GROQ_API}/chat/completions`,
    {
      method: 'POST',
      headers: GROQ_HEADERS,
      body: JSON.stringify(buildSummaryPayload(prompt, model)),
      retries: 0
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
export async function probeModel({
  fetchImpl = fetch,
  model = GROQ_MODEL
} = {}) {
  return requestJson(
    `${GROQ_API}/chat/completions`,
    {
      method: 'POST',
      headers: GROQ_HEADERS,
      body: JSON.stringify({
        model,
        max_tokens: 1,
        messages: buildMessages('ping')
      }),
      retries: 0
    },
    { fetchImpl }
  );
}
