import { describe, it, expect } from "vitest";
import { formatCommitMessage, scoreCommit, filterByScore } from "./tests.js";

it("formats feat commits", () => {
  expect(formatCommitMessage("feat: add auth")).toBe("✨ add auth");
});

describe("scoreCommit", () => {
  it("gives high score to feat commits", () => {
    const score =
      scoreCommit(`feat: add user authentication. \n fix: fixing login UI. \n
    add: support for older browsers. \n
    test: adding unit testing.`);
    expect(score).toBeGreaterThan(0);
  });
  it("penalizes chore commits", () => {
    const score = scoreCommit("chore: update dependencies");
    expect(score).toBeLessThan(0);
  });
  it("penalizes test commits but keeps them if important", () => {
    const score = scoreCommit("feat: add tests for auth");
    expect(score).toBeGreaterThan(0);
  });
  it("filters commits below the threshold", () => {
    const commits = [
      { message: "feat: add auth", score: 5 },
      { message: "test: add tests", score: -2 },
    ];
    const result = filterByScore(commits, 1);
    expect(result).toHaveLength(1);
  });
});
