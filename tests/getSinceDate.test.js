import { describe, it, expect } from "vitest";
import getSinceDate from "../scripts/getSinceDate";

it("calculates last 24 hours correctly", () => {
  const now = new Date("2026-01-08T18:00:00Z");
  const since = getSinceDate(24, now);

  expect(since.toISOString()).toBe("2026-01-07T18:00:00.000Z");
});
