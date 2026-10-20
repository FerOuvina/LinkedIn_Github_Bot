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

export function languageName(code) {
  return LANGUAGES[resolveLanguage(code)];
}

/** Instruction appended to the prompt so the post comes back translated. */
export function languageInstruction(code) {
  return `Write the LinkedIn post in ${languageName(code)}.`;
}
