/**
 * The path the built app is served under.
 *
 * GitHub Pages serves this repo at /LinkedIn_Github_Bot/ because there is no
 * custom domain. The same build also has to work on the local setup server,
 * which serves from the root, so the server strips this prefix when present.
 *
 * Set BASE_PATH=/ (or a domain root) at build time if a custom domain is added.
 *
 * Deliberately dependency-free: web/vite.config.js imports this, and the Pages
 * build installs nothing but web/'s own dependencies, so importing dotenv here
 * would fail to resolve from inside web/.
 */
function normalize(value) {
  const trimmed = String(value).trim();
  if (trimmed === "" || trimmed === "/") return "/";
  return `/${trimmed.replace(/^\/+|\/+$/g, "")}/`;
}

export const WEB_BASE = normalize(process.env.BASE_PATH ?? "/LinkedIn_Github_Bot/");

/** Strip the base prefix from a pathname, for the local server. */
export function stripBase(pathname, base = WEB_BASE) {
  if (base === "/") return pathname;
  if (pathname === base.replace(/\/$/, "")) return "/";
  if (pathname.startsWith(base)) return `/${pathname.slice(base.length)}`;
  return pathname;
}
