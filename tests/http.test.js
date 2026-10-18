import { describe, it, expect, vi } from "vitest";
import { requestJson, HttpError } from "../scripts/http.js";

const URL = "https://api.example.com/thing";
const FAST = { sleepImpl: async () => {} };

function ok(data = { hello: "world" }) {
  return { ok: true, status: 200, json: async () => data, text: async () => JSON.stringify(data) };
}

function fail(status = 500, body = "server exploded") {
  return { ok: false, status, json: async () => ({}), text: async () => body };
}

describe("requestJson", () => {
  it("returns the parsed body on success", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok());
    expect(await requestJson(URL, {}, { fetchImpl, ...FAST })).toEqual({ hello: "world" });
  });

  it("passes method, headers and body through, plus a timeout signal", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok());

    await requestJson(
      URL,
      { method: "POST", headers: { A: "b" }, body: "{}" },
      { fetchImpl, timeoutMs: 1234, ...FAST }
    );

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(URL);
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ A: "b" });
    expect(init.body).toBe("{}");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init.signal.aborted).toBe(false);
  });

  it("throws an HttpError carrying status and body on a 4xx", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(fail(404, "Not Found"));

    const err = await requestJson(URL, {}, { fetchImpl, ...FAST }).catch((e) => e);

    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(404);
    expect(err.body).toBe("Not Found");
    expect(err.message).toContain("404");
    expect(err.message).toContain("Not Found");
  });

  it("does not retry a 404", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(fail(404));
    await requestJson(URL, {}, { fetchImpl, ...FAST }).catch(() => {});
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("does not retry a 403 rate limit", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(fail(403));
    await requestJson(URL, {}, { fetchImpl, ...FAST }).catch(() => {});
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it.each([408, 425, 429, 500, 502, 503, 504])("retries a %i", async (status) => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(fail(status))
      .mockResolvedValueOnce(ok({ recovered: true }));

    const data = await requestJson(URL, {}, { fetchImpl, ...FAST });

    expect(data).toEqual({ recovered: true });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("retries a network failure and then succeeds", async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error("ECONNRESET"))
      .mockResolvedValueOnce(ok({ recovered: true }));

    expect(await requestJson(URL, {}, { fetchImpl, ...FAST })).toEqual({ recovered: true });
  });

  it("gives up after exhausting retries and reports the last error", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(fail(503));

    const err = await requestJson(URL, { retries: 2 }, { fetchImpl, ...FAST }).catch((e) => e);

    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(503);
    expect(fetchImpl).toHaveBeenCalledTimes(3); // original + 2 retries
  });

  it("honours retries: 0", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(fail(500));
    await requestJson(URL, { retries: 0 }, { fetchImpl, ...FAST }).catch(() => {});
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("backs off exponentially between retries", async () => {
    const delays = [];
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(fail(500))
      .mockResolvedValueOnce(fail(500))
      .mockResolvedValueOnce(ok());

    await requestJson(
      URL,
      { retries: 2, retryDelayMs: 100 },
      { fetchImpl, sleepImpl: async (ms) => delays.push(ms) }
    );

    expect(delays).toEqual([100, 200]);
  });

  it("never retries a POST, so a publish cannot be duplicated", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(fail(500));

    await requestJson(URL, { method: "POST" }, { fetchImpl, ...FAST }).catch(() => {});

    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("never retries a POST that fails at the network level", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("socket hang up"));

    const err = await requestJson(URL, { method: "POST" }, { fetchImpl, ...FAST }).catch((e) => e);

    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(err).toBeInstanceOf(HttpError);
    expect(err.message).toContain("socket hang up");
  });

  it("aborts via AbortSignal.timeout so a hung request cannot stall forever", async () => {
    const fetchImpl = vi.fn().mockImplementation((_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () =>
          reject(new DOMException("This operation was aborted", "AbortError"))
        );
      })
    );

    const err = await requestJson(URL, { timeoutMs: 20, retries: 0 }, { fetchImpl }).catch(
      (e) => e
    );

    expect(err).toBeInstanceOf(HttpError);
    expect(err.message).toContain("20ms");
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("throws a clear error when the body is not valid JSON", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("Unexpected token <");
      },
      text: async () => "<html>",
    });

    await expect(requestJson(URL, {}, { fetchImpl, ...FAST })).rejects.toThrow(
      /Invalid JSON/
    );
  });
});
