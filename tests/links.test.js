import { describe, it, expect } from "vitest";
import {
  addMissingRepoLinks,
  enforceRepoLinks,
  repoUrl,
} from "../scripts/links.js";

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

describe("addMissingRepoLinks", () => {
  it("leaves the text alone when every repository is already linked", () => {
    const text =
      "See https://github.com/me/alpha and https://github.com/me/beta.";

    expect(addMissingRepoLinks(text, ALLOWED)).toBe(text);
  });

  it("appends only the repositories that are missing", () => {
    const text = "See https://github.com/me/alpha.";

    expect(addMissingRepoLinks(text, ALLOWED)).toBe(
      "See https://github.com/me/alpha.\n\nRepository:\n- https://github.com/me/beta"
    );
  });

  it("uses a plural label for several missing repositories", () => {
    const text = "Shipped a few things today.";

    expect(addMissingRepoLinks(text, ALLOWED)).toBe(
      "Shipped a few things today.\n\nRepositories:\n- https://github.com/me/alpha\n- https://github.com/me/beta"
    );
  });

  it("uses Spanish labels", () => {
    const text = "Hoy avancé un par de cosas.";

    expect(addMissingRepoLinks(text, ALLOWED, "es")).toContain(
      "Repositorios:\n- https://github.com/me/alpha"
    );
  });

  it("ignores duplicate URLs", () => {
    const text = "Shipped it.";

    expect(addMissingRepoLinks(text, [ALLOWED[0], ALLOWED[0]])).toBe(
      "Shipped it.\n\nRepository:\n- https://github.com/me/alpha"
    );
  });

  it("returns non-string input unchanged", () => {
    expect(addMissingRepoLinks(null, ALLOWED)).toBe(null);
  });
});
