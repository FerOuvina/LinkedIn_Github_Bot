import "dotenv/config";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { parseLanguages } from "./languages.js";

export const DEFAULT_GAP_MINUTES = 5;
export const MIN_GAP_MINUTES = 1;
export const MAX_GAP_MINUTES = 60;

export const DEFAULT_POST_CONFIG = Object.freeze({
  languages: ["en"],
  gapMinutes: DEFAULT_GAP_MINUTES,
});

function defaults() {
  return { ...DEFAULT_POST_CONFIG, languages: [...DEFAULT_POST_CONFIG.languages] };
}

export function normalizeGap(value) {
  const minutes = Number(value);
  if (!Number.isFinite(minutes)) return DEFAULT_GAP_MINUTES;
  return Math.min(MAX_GAP_MINUTES, Math.max(MIN_GAP_MINUTES, Math.round(minutes)));
}

export function normalizeConfig(raw = {}) {
  const languages = parseLanguages(raw.languages);

  return {
    languages: languages.length > 0 ? languages : [...DEFAULT_POST_CONFIG.languages],
    gapMinutes: normalizeGap(raw.gapMinutes),
  };
}

export function readPostConfig(filePath) {
  if (!filePath || !existsSync(filePath)) return defaults();

  try {
    return normalizeConfig(JSON.parse(readFileSync(filePath, "utf8")));
  } catch {
    return defaults();
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
  const source = hasFile
    ? fromFile.languages
    : (env.POST_LANGUAGE ?? fromFile.languages);
  const languages = parseLanguages(env.POST_LANGUAGES ?? source);

  return {
    languages: languages.length > 0 ? languages : ["en"],
    gapMinutes: normalizeGap(env.POST_GAP_MINUTES ?? fromFile.gapMinutes),
  };
}
