const json = async (res) => {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || body.message || `Request failed (${res.status})`);
  return body;
};

// Vite rewrites this at build time, so it is correct whether the app is served
// from a domain root, the Pages subpath, or the local server.
const BASE = import.meta.env.BASE_URL ?? "/";
const at = (path) => `${BASE.replace(/\/$/, "")}${path}`;

export const api = {
  health: () => fetch(at("/api/health")).then(json),

  preflight: () => fetch(at("/api/preflight")).then(json),

  startLinkedIn: () => fetch(at("/api/auth/linkedin/start")).then(json),

  linkedInResult: (state) =>
    fetch(at(`/api/auth/linkedin/result?state=${encodeURIComponent(state)}`)).then(json),

  // Dry run unless apply is true.
  save: (values, { apply = false, github = true, env = false } = {}) =>
    fetch(at("/api/secrets"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values, apply, github, env }),
    }).then(json),

  dryRun: () => fetch(at("/api/dry-run"), { method: "POST" }).then(json),

  schedule: () => fetch(at("/api/schedule")).then(json),

  previewSchedule: (values) =>
    fetch(at("/api/schedule/preview"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    }).then(json),

  applySchedule: (settings) =>
    fetch(at("/api/schedule/apply"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    }).then(json),

  prompt: () => fetch(at("/api/prompt")).then(json),

  savePrompt: (prompt, settings = {}) =>
    fetch(at("/api/prompt"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, ...settings }),
    }).then(json),
};

export const docsUrl = (file) => at(`/docs/${file}`);

/** Absolute path within the site, for plain <a> tags and non-SPA routes. */
export const sitePath = (path) => at(path);
