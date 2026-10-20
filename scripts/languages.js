/** Languages the bot can write posts in. */
export const LANGUAGES = {
  en: "English",
  es: "Spanish"
};

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

export function languageName(code) {
  return LANGUAGES[resolveLanguage(code)];
}

/** Instruction appended to the prompt so the post comes back translated. */
export function languageInstruction(code) {
  return `Write the LinkedIn post in ${languageName(code)}.`;
}
