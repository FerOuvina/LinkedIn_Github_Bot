import { describe, it, expect } from "vitest";
import {
  filterSignificantCommits,
  formatCommitMessage,
} from "../scripts/mainScript.js";

describe("filterSignificantCommits", () => {
  it("removes insignificant commits", () => {
    const commits = [
      { message: "feat: add login" },
      { message: "fix: typo in readme" },
      { message: "chore: update deps" },
    ];

    const insignificantKeywords = ["typo", "chore", "docs"];

    const result = filterSignificantCommits(commits, insignificantKeywords);

    expect(result).toEqual([{ message: "feat: add login" }]);
  });
});

it("formats feat commits", () => {
  expect(formatCommitMessage("feat: add auth")).toBe("✨ add auth");
});
