/** Languages the bot can write posts in. */
export const LANGUAGES = {
  en: "English",
  es: "Spanish",
  pt: "Portuguese",
  fr: "French"
};

/** At most two languages are posted per setup. */
export const MAX_POST_LANGUAGES = 2;

/** Unknown or empty values fall back to English. */
export function resolveLanguage(code) {
  const key = String(code ?? "").trim().toLowerCase();
  return Object.hasOwn(LANGUAGES, key) ? key : "en";
}

/**
 * Parse a language list ("en,es", ["en", "es"]). Unknown codes are dropped;
 * an empty result means the caller should apply its own default.
 */
export function parseLanguages(value) {
  const parts = Array.isArray(value) ? value : String(value ?? "").split(",");
  const codes = [];

  for (const part of parts) {
    const key = String(part).trim().toLowerCase();
    if (Object.hasOwn(LANGUAGES, key) && !codes.includes(key)) codes.push(key);
  }

  return codes;
}

/** Parse a language list, keep at most two, and never return an empty list. */
export function normalizeLanguages(value) {
  const codes = parseLanguages(value);
  if (codes.length === 0) return ["en"];
  return codes.slice(0, MAX_POST_LANGUAGES);
}

export function languageName(code) {
  return LANGUAGES[resolveLanguage(code)];
}

/** Instruction appended to the prompt so the post comes back translated. */
export function languageInstruction(code) {
  return `Write the LinkedIn post in ${languageName(code)}.`;
}
