import { requestJson } from "./http.js";

const GITHUB_API = "https://api.github.com";
/** Run `worker` over `items` with at most `limit` in flight at once. */
export async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, () =>
    (async () => {
      while (cursor < items.length) {
        const index = cursor++;
        results[index] = await worker(items[index], index);
      }
    })()
  );

  await Promise.all(runners);
  return results;
}

export async function fetchOwnedRepos(user, { headers, ...httpOpts }) {
  const data = await requestJson(
    `${GITHUB_API}/users/${user}/repos?per_page=30`,
    { headers },
    httpOpts
  );

  if (!Array.isArray(data)) {
    throw new Error(`GitHub repo list request failed: ${JSON.stringify(data)}`);
  }

  return data;
}

/**
 * Fetch commits for every repo once, concurrently.
 * Returns a Map of "owner/name" -> commit messages (subject line only).
 */
export async function fetchRepoActivity(repos, { since, headers, concurrency = 6, ...httpOpts }) {
  const sinceIso = new Date(since).toISOString();

  const perRepo = await mapWithConcurrency(repos, concurrency, async (repo) => {
    const fullName = `${repo.owner?.login}/${repo.name}`;

    try {
      const data = await requestJson(
        `${GITHUB_API}/repos/${repo.owner?.login}/${repo.name}/commits?since=${sinceIso}`,
        { headers },
        httpOpts
      );

      if (!Array.isArray(data)) {
        throw new Error(`Unexpected commits response: ${JSON.stringify(data)}`);
      }

      return [
        fullName,
        data.map((c) => c.commit?.message?.split("\n")[0] ?? ""),
      ];
    } catch (err) {
      console.error(`Skipping ${fullName}: ${err.message}`);
      return [fullName, []];
    }
  });

  const activity = new Map();
  for (const [fullName, messages] of perRepo) {
    if (messages.length > 0) activity.set(fullName, messages);
  }
  return activity;
}

/** Rank repos by commit count and return the top `limit` with their messages. */
export function topActiveRepos(activity, limit = 3) {
  return [...activity.entries()]
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([fullName, messages]) => ({ fullName, messages }));
}
