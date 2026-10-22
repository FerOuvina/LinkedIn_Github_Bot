import { i18n } from "@lingui/core";

/** Display order for the language switcher. */
export const LOCALES = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
];

export const DEFAULT_LOCALE = "en";

const STORAGE_KEY = "locale";

export function isSupportedLocale(value) {
  return LOCALES.some((locale) => locale.code === value);
}

/** The saved choice, or English on a first visit. */
export function getInitialLocale() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isSupportedLocale(stored)) return stored;
  } catch {
    /* storage can be unavailable in private modes */
  }
  return DEFAULT_LOCALE;
}

/** Switch the whole app and remember the choice for the next visit. */
export function activateLocale(locale) {
  if (!isSupportedLocale(locale)) return;

  i18n.activate(locale);
  document.documentElement.lang = locale;

  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    /* not being able to remember is not worth breaking the page */
  }
}
