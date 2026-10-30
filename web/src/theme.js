export const THEMES = ["system", "dark", "light"];
export const DEFAULT_THEME = "dark";

const STORAGE_KEY = "theme";
const META_COLORS = { dark: "#07070a", light: "#f6f1e8" };

export function isSupportedTheme(value) {
  return THEMES.includes(value);
}

export function getInitialTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isSupportedTheme(stored)) return stored;
  } catch {
    return DEFAULT_THEME;
  }
  return DEFAULT_THEME;
}

export function resolveTheme(choice, systemPrefersDark) {
  if (choice === "light" || choice === "dark") return choice;
  return systemPrefersDark ? "dark" : "light";
}

export function applyTheme(choice) {
  const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolved = resolveTheme(choice, systemPrefersDark);

  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", META_COLORS[resolved]);

  return resolved;
}

export function setTheme(choice) {
  if (!isSupportedTheme(choice)) return;
  try {
    localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    applyTheme(choice);
    return;
  }
  applyTheme(choice);
}
