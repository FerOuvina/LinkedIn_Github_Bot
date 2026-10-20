import { describe, it, expect } from "vitest";
import {
  LANGUAGES,
  resolveLanguage,
  languageName,
  languageInstruction,
} from "../scripts/languages.js";

describe("languages", () => {
  it("resolves known language codes", () => {
    expect(resolveLanguage("es")).toBe("es");
    expect(resolveLanguage("EN")).toBe("en");
  });

  it("falls back to English for unknown or empty values", () => {
    expect(resolveLanguage("de")).toBe("en");
    expect(resolveLanguage("")).toBe("en");
    expect(resolveLanguage(undefined)).toBe("en");
  });

  it("names the resolved language", () => {
    expect(languageName("es")).toBe("Spanish");
    expect(languageName("de")).toBe("English");
  });

  it("builds the prompt instruction", () => {
    expect(languageInstruction("es")).toBe("Write the LinkedIn post in Spanish.");
    expect(languageInstruction("en")).toBe("Write the LinkedIn post in English.");
  });

  it("only exposes configured languages", () => {
    expect(Object.keys(LANGUAGES)).toEqual(["en", "es"]);
  });
});
