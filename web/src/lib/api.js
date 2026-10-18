const json = async (res) => {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || body.message || `Request failed (${res.status})`);
  return body;
};

export const api = {
  health: () => fetch("/api/health").then(json),

  preflight: () => fetch("/api/preflight").then(json),

  startLinkedIn: () => fetch("/api/auth/linkedin/start").then(json),

  linkedInResult: (state) =>
    fetch(`/api/auth/linkedin/result?state=${encodeURIComponent(state)}`).then(json),

  // Dry run unless apply is true.
  save: (values, { apply = false, github = true, env = false } = {}) =>
    fetch("/api/secrets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values, apply, github, env }),
    }).then(json),

  dryRun: () => fetch("/api/dry-run", { method: "POST" }).then(json),
};
