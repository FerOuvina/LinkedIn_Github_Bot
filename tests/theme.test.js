import { describe, it, expect } from "vitest";
import {
  DEFAULT_THEME,
  THEMES,
  isSupportedTheme,
  resolveTheme,
} from "../web/src/theme.js";

describe("theme resolution", () => {
  it("defaults to dark so the original look survives first visit", () => {
    expect(DEFAULT_THEME).toBe("dark");
    expect(THEMES).toEqual(["system", "dark", "light"]);
  });

  it("keeps explicit choices regardless of the system preference", () => {
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(resolveTheme("light", true)).toBe("light");
  });

  it("follows the system preference for the auto choice", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });

  it("rejects unknown stored values", () => {
    expect(isSupportedTheme("dark")).toBe(true);
    expect(isSupportedTheme("light")).toBe(true);
    expect(isSupportedTheme("system")).toBe(true);
    expect(isSupportedTheme("neon")).toBe(false);
    expect(isSupportedTheme(null)).toBe(false);
  });
});
