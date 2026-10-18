import { describe, it, expect } from "vitest";
import {
  SCORE_RULES,
  MIN_SCORE,
  scoreCommit,
  scoreCommits,
  rankCommits,
  filterByScore,
  formatCommitMessage,
} from "../scripts/commitScoring.js";

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

  it("stacks rule scores", () => {
    expect(scoreCommit("feat: add auth")).toBe(7);
    expect(scoreCommit("fix: login crash")).toBe(4);
    expect(scoreCommit("feat: implement parser")).toBe(7);
  });

  it("penalizes chore commits", () => {
    const score = scoreCommit("chore: update dependencies");
    expect(score).toBeLessThan(0);
  });

  it("penalizes test commits but keeps them if important", () => {
    const score = scoreCommit("feat: add tests for auth");
    expect(score).toBeGreaterThan(0);
  });

  it("returns 0 for an unmatched message", () => {
    expect(scoreCommit("wip")).toBe(0);
  });
});

describe("filterByScore", () => {
  it("filters commits below the threshold", () => {
    const commits = [
      { message: "feat: add auth", score: 5 },
      { message: "test: add tests", score: -2 },
    ];
    const result = filterByScore(commits, 1);
    expect(result).toHaveLength(1);
  });

  it("uses MIN_SCORE as the default threshold", () => {
    expect(MIN_SCORE).toBe(1);
    const commits = [{ score: 0 }, { score: 1 }, { score: 5 }];
    expect(filterByScore(commits)).toHaveLength(2);
  });
});

describe("scoreCommits + rankCommits", () => {
  const commits = [
    { repo: "a", message: "chore: bump deps" },
    { repo: "a", message: "feat: add auth" },
    { repo: "b", message: "fix: login crash" },
    { repo: "b", message: "update readme" },
  ];

  it("attaches a score to every commit", () => {
    const scored = scoreCommits(commits);
    expect(scored).toHaveLength(commits.length);
    expect(scored.every((c) => typeof c.score === "number")).toBe(true);
    expect(scored[0]).toMatchObject({ repo: "a", message: "chore: bump deps" });
  });

  it("drops low scores and sorts high scores first", () => {
    const ranked = rankCommits(scoreCommits(commits));
    expect(ranked.map((c) => c.score)).toEqual([7, 4]);
    expect(ranked.map((c) => c.repo)).toEqual(["a", "b"]);
  });

  it("caps results at the limit", () => {
    const many = Array.from({ length: 10 }, () => ({ message: "feat: x" }));
    expect(rankCommits(scoreCommits(many), 4)).toHaveLength(4);
  });
});

describe("SCORE_RULES", () => {
  it("are all valid regexps with numeric scores", () => {
    for (const rule of SCORE_RULES) {
      expect(rule.match).toBeInstanceOf(RegExp);
      expect(typeof rule.score).toBe("number");
    }
  });
});
