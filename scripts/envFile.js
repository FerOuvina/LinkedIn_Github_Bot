import { readFileSync, writeFileSync, existsSync } from "node:fs";

/**
 * Merge values into a .env file, preserving comments, ordering and unrelated
 * variables. Only the keys given are touched.
 */
export function mergeEnv(existing = "", updates = {}) {
  // Blank values are dropped up front, so a cleared form field can never
  // overwrite a working credential with an empty one.
  const wanted = Object.fromEntries(
    Object.entries(updates).filter(
      ([, v]) => v !== undefined && v !== null && v !== ""
    )
  );

  const seen = new Set();
  const out = [];

  for (const line of existing.split(/\r?\n/)) {
    const key = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/)?.[1];

    if (key && Object.hasOwn(wanted, key)) {
      if (!seen.has(key)) {
        out.push(`${key}=${wanted[key]}`);
        seen.add(key);
      }
      continue; // drop duplicate keys rather than writing them twice
    }
    out.push(line);
  }

  // Drop trailing blank lines so appended keys don't get stranded by them.
  while (out.length > 0 && out[out.length - 1].trim() === "") out.pop();

  for (const [key, value] of Object.entries(wanted)) {
    if (!seen.has(key)) {
      out.push(`${key}=${value}`);
      seen.add(key);
    }
  }

  return out.join("\n") + "\n";
}

/**
 * Write credentials to the project's .env so local runs keep working.
 * @returns {{ok: boolean, updated: string[]}}
 */
export function writeEnvFile(path, updates) {
  const entries = Object.entries(updates).filter(([, v]) => v !== undefined && v !== null && v !== "");
  if (entries.length === 0) return { ok: true, updated: [] };

  const existing = existsSync(path) ? readFileSync(path, "utf8") : "";
  const next = mergeEnv(existing, Object.fromEntries(entries));
  writeFileSync(path, next, "utf8");

  return { ok: true, updated: entries.map(([k]) => k) };
}
