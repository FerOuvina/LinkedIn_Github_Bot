import "dotenv/config";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { MAX_POST_LANGUAGES, parseLanguages } from "./languages.js";
import { buildSchedule, isValidTimeZone, parseTimeOfDay } from "./schedule.js";

export const DEFAULT_GAP_MINUTES = 5;
export const MIN_GAP_MINUTES = 1;
export const MAX_GAP_MINUTES = 60;
export const DEFAULT_TIME = "13:00";
export const DEFAULT_TIMEZONE = "UTC";
export const DEFAULT_DAYS = Object.freeze([1, 2, 3, 4, 5]);

export function normalizeGap(value) {
  const minutes = Number(value);
  if (!Number.isFinite(minutes)) return DEFAULT_GAP_MINUTES;
  return Math.min(MAX_GAP_MINUTES, Math.max(MIN_GAP_MINUTES, Math.round(minutes)));
}

function normalizeTimezone(value) {
  return typeof value === "string" && isValidTimeZone(value)
    ? value
    : DEFAULT_TIMEZONE;
}

function normalizeDays(value) {
  if (value === undefined || value === null || !Array.isArray(value)) {
    return [...DEFAULT_DAYS];
  }

  const days = value
    .map(Number)
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);

  return [...new Set(days)].sort((a, b) => a - b);
}

/**
 * One valid "HH:MM" per language. Languages without their own value inherit
 * the first configured time, so adding a language never leaves it unscheduled.
 */
function normalizeTimes(raw, languages) {
  const source = raw && typeof raw === "object" ? raw : {};
  const fallback =
    languages.map((code) => source[code]).find((value) => parseTimeOfDay(value)) ??
    DEFAULT_TIME;

  const times = {};
  for (const code of languages) {
    times[code] = parseTimeOfDay(source[code]) ? source[code] : fallback;
  }
  return times;
}

/**
 * Crons are stored, not recomputed, because GitHub cron is fixed in UTC while
 * the local time shifts with daylight saving. Recomputing would stop matching
 * `github.event.schedule` after the clocks change.
 */
function normalizeCrons(raw, languages) {
  const source = raw && typeof raw === "object" ? raw : {};
  const crons = {};

  for (const code of languages) {
    const value = source[code];
    crons[code] = /^\S+ \S+ \S+ \S+ \S+$/.test(String(value ?? "").trim())
      ? String(value).trim()
      : null;
  }

  return crons;
}

export function normalizeConfig(raw = {}) {
  const parsed = parseLanguages(raw.languages);
  const languages = (parsed.length > 0 ? parsed : ["en"]).slice(0, MAX_POST_LANGUAGES);
  const timezone = normalizeTimezone(raw.timezone);
  const days = normalizeDays(raw.days);
  const times = normalizeTimes(raw.times, languages);
  const crons = normalizeCrons(raw.crons, languages);

  // Only fill gaps; existing crons stay exactly as the workflow has them.
  const { crons: computed } = buildSchedule({ languages, times, timeZone: timezone, days });
  for (const code of languages) {
    if (!crons[code]) crons[code] = computed[code];
  }

  return {
    languages,
    gapMinutes: normalizeGap(raw.gapMinutes),
    timezone,
    days,
    times,
    crons,
  };
}

export function readPostConfig(filePath) {
  if (!filePath || !existsSync(filePath)) return normalizeConfig({});

  try {
    return normalizeConfig(JSON.parse(readFileSync(filePath, "utf8")));
  } catch {
    return normalizeConfig({});
  }
}

export function writePostConfig(filePath, config) {
  const normalized = normalizeConfig(config);
  writeFileSync(filePath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  return normalized;
}

/**
 * Resolve the settings the post run should use: environment overrides first,
 * then the committed post.config.json, then the legacy single-language value.
 */
export function loadPostConfig({ env = process.env, filePath } = {}) {
  const hasFile = Boolean(filePath) && existsSync(filePath);
  const fromFile = readPostConfig(filePath);

  const envLanguages = parseLanguages(
    env.POST_LANGUAGES ?? (hasFile ? [] : env.POST_LANGUAGE)
  );

  const config =
    envLanguages.length > 0
      ? normalizeConfig({ ...fromFile, languages: envLanguages })
      : fromFile;

  return {
    ...config,
    gapMinutes: normalizeGap(env.POST_GAP_MINUTES ?? config.gapMinutes),
  };
}
