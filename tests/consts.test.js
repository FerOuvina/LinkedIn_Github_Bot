import { describe, it, expect } from "vitest";
import {
  GITHUB_TOKEN,
  LINKEDIN_TOKEN,
  HF_API_KEY,
  LINKEDIN_AUTHOR,
  HUB_USER,
} from "./scripts/consts.js";

it("gets constant values correctly", () => {
  const values = {
    GITHUB_TOKEN,
    LINKEDIN_TOKEN,
    HF_API_KEY,
    LINKEDIN_AUTHOR,
    HUB_USER,
  };

  const valuesMissing = Object.entries(values)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

  expect(valuesMissing.length).toBe === 0;
});
