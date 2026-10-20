import { describe, it, expect } from "vitest";
import { enforceRepoLinks, repoUrl } from "../scripts/links.js";

const ALLOWED = [
  "https://github.com/me/alpha",
  "https://github.com/me/beta",
];

describe("repoUrl", () => {
  it("builds a canonical repository URL", () => {
    expect(repoUrl("me/alpha")).toBe("https://github.com/me/alpha");
  });
});

describe("enforceRepoLinks", () => {
  it("leaves correct links untouched", () => {
    const text = "Shipped it. https://github.com/me/alpha";

    expect(enforceRepoLinks(text, ALLOWED)).toBe(text);
  });

  it("accepts www, http, .git and trailing slashes", () => {
    const text =
      "See http://www.github.com/me/alpha.git and https://github.com/me/beta/";

    expect(enforceRepoLinks(text, ALLOWED)).toBe(
      "See https://github.com/me/alpha and https://github.com/me/beta"
    );
  });

  it("fixes the owner when the repository name matches", () => {
    const text = "See https://github.com/someone-else/alpha";

    expect(enforceRepoLinks(text, ALLOWED)).toBe(
      "See https://github.com/me/alpha"
    );
  });

  it("removes a repository that was never read", () => {
    const text = "See https://github.com/me/made-up for details.";

    expect(enforceRepoLinks(text, ALLOWED)).toBe("See  for details.");
  });

  it("points a lone repository link at the only repository read", () => {
    const text = "See https://github.com/me/typo";

    expect(enforceRepoLinks(text, ["https://github.com/me/alpha"])).toBe(
      "See https://github.com/me/alpha"
    );
  });

  it("keeps punctuation outside the URL", () => {
    const text = "Check it out: https://github.com/me/alpha.";

    expect(enforceRepoLinks(text, ALLOWED)).toBe(
      "Check it out: https://github.com/me/alpha."
    );
  });

  it("ignores profile links and non-GitHub links", () => {
    const text =
      "Me: https://github.com/me — site: https://example.com/me/alpha";

    expect(enforceRepoLinks(text, ALLOWED)).toBe(text);
  });

  it("returns non-string input unchanged", () => {
    expect(enforceRepoLinks(null, ALLOWED)).toBe(null);
  });
});
