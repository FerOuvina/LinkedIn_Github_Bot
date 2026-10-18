const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 500;

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

export class HttpError extends Error {
  constructor(message, { status = null, body = null, url = null, cause } = {}) {
    super(message, { cause });
    this.name = "HttpError";
    this.status = status;
    this.body = body;
    this.url = url;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * fetch + JSON with a hard timeout and bounded retries.
 *
 * Retries only what is safe to repeat: network/timeout failures and retryable
 * status codes on GETs. Non-retryable 4xx responses throw immediately, and
 * non-GET requests are never retried so a publish cannot be duplicated.
 */
export async function requestJson(
  url,
  {
    method = "GET",
    headers,
    body,
    retries = DEFAULT_RETRIES,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retryDelayMs = DEFAULT_RETRY_DELAY_MS,
    ...init
  } = {},
  { fetchImpl = fetch, sleepImpl = sleep } = {}
) {
  const canRetry = method === "GET";
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      await sleepImpl(retryDelayMs * 2 ** (attempt - 1));
    }

    let res;
    try {
      res = await fetchImpl(url, {
        ...init,
        method,
        headers,
        body,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      lastError = new HttpError(
        `${method} ${url} failed after ${timeoutMs}ms: ${err.message}`,
        { url, cause: err }
      );
      if (!canRetry) throw lastError;
      continue;
    }

    if (res.ok) {
      try {
        return await res.json();
      } catch (err) {
        throw new HttpError(`Invalid JSON from ${method} ${url}: ${err.message}`, {
          status: res.status,
          url,
          cause: err,
        });
      }
    }

    const text = await res.text().catch(() => "");
    lastError = new HttpError(`${method} ${url} failed with ${res.status}: ${text}`, {
      status: res.status,
      body: text,
      url,
    });

    if (!canRetry || !RETRYABLE_STATUS.has(res.status)) throw lastError;
  }

  throw lastError;
}
