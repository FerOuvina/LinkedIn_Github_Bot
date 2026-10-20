import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  DEFAULT_GAP_MINUTES,
  loadPostConfig,
  normalizeConfig,
  normalizeGap,
  readPostConfig,
  writePostConfig,
} from "../scripts/postConfig.js";

describe("normalizeGap", () => {
  it("rounds and clamps to the supported range", () => {
    expect(normalizeGap(5)).toBe(5);
    expect(normalizeGap("7.6")).toBe(8);
    expect(normalizeGap(0)).toBe(1);
    expect(normalizeGap(999)).toBe(60);
  });

  it("falls back to the default for non-numbers", () => {
    expect(normalizeGap(undefined)).toBe(DEFAULT_GAP_MINUTES);
    expect(normalizeGap("abc")).toBe(DEFAULT_GAP_MINUTES);
  });
});

describe("normalizeConfig", () => {
  it("keeps valid settings", () => {
    expect(normalizeConfig({ languages: ["en", "es"], gapMinutes: 10 })).toEqual({
      languages: ["en", "es"],
      gapMinutes: 10,
    });
  });

  it("defaults missing or invalid settings", () => {
    expect(normalizeConfig({})).toEqual({
      languages: ["en"],
      gapMinutes: DEFAULT_GAP_MINUTES,
    });
    expect(normalizeConfig({ languages: ["de"], gapMinutes: "nope" })).toEqual({
      languages: ["en"],
      gapMinutes: DEFAULT_GAP_MINUTES,
    });
  });
});

describe("file config", () => {
  let dir;
  let configPath;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "post-config-"));
    configPath = path.join(dir, "post.config.json");
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("returns the defaults when the file is missing", () => {
    expect(readPostConfig(configPath)).toEqual({
      languages: ["en"],
      gapMinutes: DEFAULT_GAP_MINUTES,
    });
  });

  it("returns the defaults when the file is invalid", () => {
    writeFileSync(configPath, "{not json", "utf8");

    expect(readPostConfig(configPath).languages).toEqual(["en"]);
  });

  it("writes and reads back normalized settings", () => {
    const written = writePostConfig(configPath, {
      languages: ["es", "en"],
      gapMinutes: 0,
    });

    expect(written).toEqual({ languages: ["es", "en"], gapMinutes: 1 });
    expect(JSON.parse(readFileSync(configPath, "utf8"))).toEqual(written);
    expect(readPostConfig(configPath)).toEqual(written);
  });
});

describe("loadPostConfig", () => {
  let dir;
  let configPath;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "post-config-"));
    configPath = path.join(dir, "post.config.json");
    writeFileSync(
      configPath,
      JSON.stringify({ languages: ["en", "es"], gapMinutes: 5 }),
      "utf8"
    );
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("uses the committed file", () => {
    expect(loadPostConfig({ env: {}, filePath: configPath })).toEqual({
      languages: ["en", "es"],
      gapMinutes: 5,
    });
  });

  it("lets environment variables override the file", () => {
    expect(
      loadPostConfig({
        env: { POST_LANGUAGES: "es", POST_GAP_MINUTES: "12" },
        filePath: configPath,
      })
    ).toEqual({ languages: ["es"], gapMinutes: 12 });
  });

  it("supports the legacy single-language variable when there is no file", () => {
    expect(
      loadPostConfig({
        env: { POST_LANGUAGE: "es" },
        filePath: path.join(dir, "absent.json"),
      })
    ).toEqual({ languages: ["es"], gapMinutes: DEFAULT_GAP_MINUTES });
  });

  it("prefers the file over the legacy variable", () => {
    expect(
      loadPostConfig({ env: { POST_LANGUAGE: "es" }, filePath: configPath })
    ).toEqual({ languages: ["en", "es"], gapMinutes: 5 });
  });

  it("falls back to English when the language list is empty", () => {
    writeFileSync(configPath, JSON.stringify({ languages: [] }), "utf8");

    expect(loadPostConfig({ env: {}, filePath: configPath }).languages).toEqual([
      "en",
    ]);
  });
});
