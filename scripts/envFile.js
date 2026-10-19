import { readFileSync, writeFileSync, existsSync } from "node:fs";

/**
 * Strip one layer of wrapping quotes from an already-quoted value.
 *
 * Double quotes are only stripped when the content has no quote or backslash,
 * since there is no way to tell what was meant as an escape. Single quotes are
 * literal, so they can always be stripped.
 */
const WRAPPED = [
  /^"([^"\\]*)"$/,
  /^'([\s\S]*)'$/,
];

/**
 * Quote a value so it survives a round trip through dotenv.
 *
 * Bare values are not safe: dotenv strips `#` comments and trims surrounding
 * whitespace. The quoting rules are narrow and were checked against the parser
 * rather than assumed:
 *
 *   - double quotes expand `\n` and `\r`, and nothing else
 *   - single quotes are fully literal — the only way to embed a `"`
 *   - a backslash is never an escape, so doubling it would corrupt the value
 */
export function formatEnvValue(value) {
  const str = String(value);

  // Idempotent: a value pasted into the wizard already wrapped in quotes must
  // not come back out with a second pair around it.
  const already = WRAPPED.map((re) => str.match(re)).find(Boolean);
  const raw = already ? already[1] : str;

  const hasNewline = /[\r\n]/.test(raw);

  // Only single quotes can carry a `"`, but they cannot expand a newline.
  if (raw.includes('"') && !raw.includes("'") && !hasNewline) {
    return `'${raw}'`;
  }

  return `"${raw.replace(/\r/g, "\\r").replace(/\n/g, "\\n")}"`;
}

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
        out.push(`${key}=${formatEnvValue(wanted[key])}`);
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
      out.push(`${key}=${formatEnvValue(value)}`);
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
