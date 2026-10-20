/** Canonical URL for an "owner/name" repository. */
export function repoUrl(fullName) {
  return `https://github.com/${fullName}`;
}

/** Matches a GitHub repository URL with or without a scheme, .git or a path. */
const REPO_URL =
  /(?:https?:\/\/)?(?:www\.)?github\.com\/([^\s/?#)\]]+)\/([^\s/?#)\]]+)\/?(?=[\s?#)\].,;:!?]|$)/gi;

function repoKey(owner, name) {
  return `${owner}/${name}`.toLowerCase();
}

/**
 * Keep GitHub links in a generated post pointing at repositories the bot
 * actually read. Anything else is a hallucination and is removed rather than
 * published; a wrong link is worse than no link.
 */
export function enforceRepoLinks(text, allowedUrls) {
  if (typeof text !== "string") return text;

  const allowed = [...new Set(allowedUrls)].filter(Boolean);
  if (allowed.length === 0) return text;

  const byKey = new Map();
  const byName = new Map();

  for (const url of allowed) {
    const match = url.match(/github\.com\/([^/]+)\/([^/?#]+)/i);
    if (!match) continue;
    const [, owner, name] = match;
    byKey.set(repoKey(owner, name), url);

    const key = name.toLowerCase();
    byName.set(key, byName.has(key) ? null : url);
  }

  return text.replace(REPO_URL, (matched, owner, rawName) => {
    const trailing = rawName.match(/[.,;:!?]+$/)?.[0] ?? "";
    const name = rawName
      .slice(0, rawName.length - trailing.length)
      .replace(/\.git$/i, "");
    const key = repoKey(owner, name);
    const replacement =
      byKey.get(key) ??
      byName.get(name.toLowerCase()) ??
      (allowed.length === 1 ? allowed[0] : "");

    return replacement + trailing;
  });
}

const LINK_LABELS = {
  en: { one: "Repository", many: "Repositories" },
  es: { one: "Repositorio", many: "Repositorios" },
  pt: { one: "Repositório", many: "Repositórios" },
  fr: { one: "Dépôt", many: "Dépôts" },
};

/**
 * Append any repository link the model left out. The post already lists every
 * repository it was built from, so a missing link is always a generation miss,
 * not a reason to omit it.
 */
export function addMissingRepoLinks(text, allowedUrls, language = "en") {
  if (typeof text !== "string") return text;

  const missing = [...new Set(allowedUrls)].filter(
    (url) => url && !text.includes(url)
  );
  if (missing.length === 0) return text;

  const labels = LINK_LABELS[language] ?? LINK_LABELS.en;
  const label = missing.length === 1 ? labels.one : labels.many;
  const list = missing.map((url) => `- ${url}`).join("\n");

  return `${text.trimEnd()}\n\n${label}:\n${list}`;
}
