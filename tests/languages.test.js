import { describe, it, expect } from "vitest";
import {
  LANGUAGES,
  MAX_POST_LANGUAGES,
  normalizeLanguages,
  parseLanguages,
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
    expect(Object.keys(LANGUAGES)).toEqual(["en", "es", "pt", "fr"]);
  });

  it("names the added languages", () => {
    expect(languageName("pt")).toBe("Portuguese");
    expect(languageName("fr")).toBe("French");
  });
});

describe("parseLanguages", () => {
  it("parses a comma-separated list in order", () => {
    expect(parseLanguages("en,es")).toEqual(["en", "es"]);
    expect(parseLanguages(" ES , en ")).toEqual(["es", "en"]);
  });

  it("accepts an array and dedupes it", () => {
    expect(parseLanguages(["es", "es", "en"])).toEqual(["es", "en"]);
  });

  it("drops unsupported codes", () => {
    expect(parseLanguages("en,de,pt")).toEqual(["en", "pt"]);
  });

  it("returns an empty list when nothing is usable", () => {
    expect(parseLanguages("de")).toEqual([]);
    expect(parseLanguages("")).toEqual([]);
    expect(parseLanguages(undefined)).toEqual([]);
  });
});

describe("normalizeLanguages", () => {
  it("caps the selection at two", () => {
    expect(normalizeLanguages(["en", "es", "pt"])).toEqual(["en", "es"]);
    expect(MAX_POST_LANGUAGES).toBe(2);
  });

  it("falls back to English when nothing is usable", () => {
    expect(normalizeLanguages("de")).toEqual(["en"]);
  });
});
