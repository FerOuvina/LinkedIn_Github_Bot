/**
 * The standalone privacy page is served from the repository root on Pages and
 * copied beside its markdown. Local development needs the same mapping.
 */
const FILES = {
  "/privacy-policy/": "index.html",
  "/privacy-policy/privacy-policy.md": "privacy-policy.md",
  "/privacy-policy/privacy-policy.es.md": "privacy-policy.es.md",
};

export const PRIVACY_PREFIX = "/privacy-policy";

/** The repository file for a privacy URL, or null when it is not one. */
export function resolvePrivacyFile(pathname) {
  return FILES[pathname] ?? null;
}

export function privacyContentType(file) {
  return file.endsWith(".html")
    ? "text/html; charset=utf-8"
    : "text/markdown; charset=utf-8";
}
