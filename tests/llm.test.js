import { describe, it, expect, vi } from "vitest";
import {
  GROQ_API,
  SYSTEM_PROMPT,
  buildMessages,
  buildSummaryPayload,
  summarize,
  probeModel,
} from "../scripts/llm.js";

const MODEL = "qwen/qwen3.8-27b";

function ok(data) {
  return { ok: true, status: 200, json: async () => data, text: async () => JSON.stringify(data) };
}

function fail(status, body = "error") {
  return { ok: false, status, json: async () => ({}), text: async () => body };
}

describe("buildMessages", () => {
  it("sends a system prompt plus the user prompt", () => {
    const messages = buildMessages("write a post");

    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe("system");
    expect(messages[0].content).toBe(SYSTEM_PROMPT);
    expect(messages[1]).toEqual({ role: "user", content: "write a post" });
  });
});

describe("summarize", () => {
  it("posts to the Groq chat completions endpoint and returns the text", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      ok({ choices: [{ message: { content: "a post" } }] })
    );

    expect(await summarize("prompt", { fetchImpl, model: MODEL })).toBe("a post");

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(`${GROQ_API}/chat/completions`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual(buildSummaryPayload("prompt", MODEL));
  });

  it("throws a clear error on an unexpected response shape", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok({ unexpected: true }));

    await expect(summarize("p", { fetchImpl, model: MODEL })).rejects.toThrow(
      /Unexpected Groq response shape/
    );
  });

  it("throws when the model returns no content", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok({ choices: [{ message: { content: "" } }] }));

    await expect(summarize("p", { fetchImpl, model: MODEL })).rejects.toThrow(
      /Unexpected Groq response shape/
    );
  });

  it("never retries, since a blind retry could post twice", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(fail(503));

    await expect(summarize("p", { fetchImpl, model: MODEL })).rejects.toThrow();
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});

describe("probeModel", () => {
  it("sends the same message shape as a real request", async () => {
    // Regression guard: a probe using a different shape (e.g. a bare user
    // message) passes on models that reject the real system+user payload.
    const fetchImpl = vi.fn().mockResolvedValue(ok({ choices: [{ message: { content: "" } }] }));

    await probeModel({ fetchImpl, model: MODEL });

    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    const real = buildSummaryPayload("ping", MODEL);

    expect(body.messages).toEqual(real.messages);
    expect(body.model).toBe(real.model);
  });

  it("asks for a single token to stay cheap", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok({ choices: [{ message: { content: "" } }] }));

    await probeModel({ fetchImpl, model: MODEL });

    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).max_tokens).toBe(1);
  });

  it("surfaces a model that rejects the real payload shape", async () => {
    // What the prompt-guard model actually returned.
    const fetchImpl = vi.fn().mockResolvedValue(
      fail(400, "messages must contains a single user message for text classification models")
    );

    await expect(probeModel({ fetchImpl, model: MODEL })).rejects.toThrow(
      /single user message/
    );
  });
});
