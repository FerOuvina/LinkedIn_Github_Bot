import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  DEFAULT_DAYS,
  DEFAULT_GAP_MINUTES,
  DEFAULT_TIME,
  DEFAULT_TIMEZONE,
  loadPostConfig,
  normalizeConfig,
  normalizeGap,
  readPostConfig,
  writePostConfig,
} from "../scripts/postConfig.js";

const DEFAULTS = {
  languages: ["en"],
  gapMinutes: DEFAULT_GAP_MINUTES,
  timezone: DEFAULT_TIMEZONE,
  days: [...DEFAULT_DAYS],
  times: { en: DEFAULT_TIME },
  crons: { en: "0 13 * * 1-5" },
};

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
  it("keeps valid settings and converts each time to a cron", () => {
    expect(
      normalizeConfig({
        languages: ["en", "es"],
        gapMinutes: 10,
        timezone: "UTC",
        days: [1, 2, 3, 4, 5],
        times: { en: "09:00", es: "18:00" },
      })
    ).toEqual({
      languages: ["en", "es"],
      gapMinutes: 10,
      timezone: "UTC",
      days: [1, 2, 3, 4, 5],
      times: { en: "09:00", es: "18:00" },
      crons: { en: "0 9 * * 1-5", es: "0 18 * * 1-5" },
    });
  });

  it("defaults missing or invalid settings", () => {
    expect(normalizeConfig({})).toEqual(DEFAULTS);
    expect(
      normalizeConfig({
        languages: ["de"],
        gapMinutes: "nope",
        timezone: "Mars/Olympus",
        times: { en: "99:99" },
      })
    ).toEqual(DEFAULTS);
  });

  it("caps the language list at two", () => {
    expect(
      normalizeConfig({ languages: ["en", "es", "pt", "fr"] }).languages
    ).toEqual(["en", "es"]);
  });

  it("gives a new language the first configured time", () => {
    const config = normalizeConfig({
      languages: ["en", "pt"],
      timezone: "UTC",
      times: { en: "08:30" },
    });

    expect(config.times).toEqual({ en: "08:30", pt: "08:30" });
    expect(config.crons).toEqual({
      en: "30 8 * * 1-5",
      pt: "30 8 * * 1-5",
    });
  });

  it("keeps stored crons instead of recomputing them", () => {
    // A stored cron is what the workflow actually runs; recomputing would break
    // the match with github.event.schedule after a DST change.
    const config = normalizeConfig({
      languages: ["en"],
      timezone: "Europe/Madrid",
      times: { en: "09:00" },
      crons: { en: "0 7 * * 1-5" },
    });

    expect(config.crons.en).toBe("0 7 * * 1-5");
  });

  it("keeps an explicitly empty day list (every day)", () => {
    expect(normalizeConfig({ days: [] }).days).toEqual([]);
    expect(normalizeConfig({ days: [1, 1, 9] }).days).toEqual([1]);
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
    expect(readPostConfig(configPath)).toEqual(DEFAULTS);
  });

  it("returns the defaults when the file is invalid", () => {
    writeFileSync(configPath, "{not json", "utf8");

    expect(readPostConfig(configPath).languages).toEqual(["en"]);
  });

  it("writes and reads back normalized settings", () => {
    const written = writePostConfig(configPath, {
      languages: ["es", "en"],
      gapMinutes: 0,
      timezone: "UTC",
      times: { en: "08:00", es: "08:00" },
    });

    expect(written.languages).toEqual(["es", "en"]);
    expect(written.gapMinutes).toBe(1);
    expect(written.times).toEqual({ es: "08:00", en: "08:00" });
    expect(written.crons).toEqual({
      es: "0 8 * * 1-5",
      en: "0 8 * * 1-5",
    });
    expect(JSON.parse(readFileSync(configPath, "utf8"))).toEqual(written);
    expect(readPostConfig(configPath)).toEqual(written);
  });
});

describe("loadPostConfig", () => {
  let dir;
  let configPath;

  const FILE = {
    languages: ["en", "es"],
    gapMinutes: 5,
    timezone: "UTC",
    days: [1, 2, 3, 4, 5],
    times: { en: "09:00", es: "18:00" },
    crons: { en: "0 9 * * 1-5", es: "0 18 * * 1-5" },
  };

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "post-config-"));
    configPath = path.join(dir, "post.config.json");
    writeFileSync(configPath, JSON.stringify(FILE), "utf8");
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("uses the committed file", () => {
    expect(loadPostConfig({ env: {}, filePath: configPath })).toEqual(FILE);
  });

  it("lets environment variables override the language list and gap", () => {
    const config = loadPostConfig({
      env: { POST_LANGUAGES: "es", POST_GAP_MINUTES: "12" },
      filePath: configPath,
    });

    expect(config.languages).toEqual(["es"]);
    expect(config.gapMinutes).toBe(12);
    expect(config.times).toEqual({ es: "18:00" });
    expect(config.crons).toEqual({ es: "0 18 * * 1-5" });
  });

  it("supports the legacy single-language variable when there is no file", () => {
    expect(
      loadPostConfig({
        env: { POST_LANGUAGE: "es" },
        filePath: path.join(dir, "absent.json"),
      })
    ).toEqual({ ...DEFAULTS, languages: ["es"], times: { es: "13:00" }, crons: { es: "0 13 * * 1-5" } });
  });

  it("prefers the file over the legacy variable", () => {
    expect(
      loadPostConfig({ env: { POST_LANGUAGE: "es" }, filePath: configPath })
    ).toEqual(FILE);
  });

  it("falls back to English when the language list is empty", () => {
    writeFileSync(configPath, JSON.stringify({ languages: [] }), "utf8");

    expect(loadPostConfig({ env: {}, filePath: configPath }).languages).toEqual([
      "en",
    ]);
  });
});
