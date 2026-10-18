import { describe, it, expect } from "vitest";
import {
  rewriteRelativeUrls,
  extractHeadings,
} from "../web/src/lib/markdown.js";

describe("rewriteRelativeUrls", () => {
  it("points relative image paths at /docs", () => {
    const html = '<img src="img/linkedin-app-logo.jpg" width="120">';
    expect(rewriteRelativeUrls(html)).toBe(
      '<img src="/docs/img/linkedin-app-logo.jpg" width="120">'
    );
  });

  it("strips a leading ./ so paths stay clean", () => {
    expect(rewriteRelativeUrls('<img src="./img/logo.png">')).toBe(
      '<img src="/docs/img/logo.png">'
    );
  });

  it("leaves absolute and root-relative URLs alone", () => {
    const html =
      '<img src="https://cdn.example.com/a.png"><img src="/logo.png"><a href="/getting-started">x</a>';
    expect(rewriteRelativeUrls(html)).toBe(html);
  });

  it("leaves data and blob URLs alone", () => {
    const html = '<img src="data:image/png;base64,AAA"><img src="blob:http://x/y">';
    expect(rewriteRelativeUrls(html)).toBe(html);
  });

  it("rewrites both src and href", () => {
    expect(rewriteRelativeUrls('<a href="GUIDE.md">g</a>')).toBe(
      '<a href="/docs/GUIDE.md">g</a>'
    );
  });

  it("accepts a custom base", () => {
    expect(rewriteRelativeUrls('<img src="a.png">', "/other/")).toBe(
      '<img src="/other/a.png">'
    );
  });
});

describe("extractHeadings", () => {
  it("adds ids and returns the headings", () => {
    const { html, headings } = extractHeadings(
      "<h2>One-time setup</h2><h3>Create the app</h3><h2>Renewing</h2>"
    );

    expect(headings).toEqual([
      { level: 2, text: "One-time setup", id: "one-time-setup" },
      { level: 3, text: "Create the app", id: "create-the-app" },
      { level: 2, text: "Renewing", id: "renewing" },
    ]);
    expect(html).toContain('id="one-time-setup"');
  });

  it("strips inline markup out of the heading text", () => {
    const { headings } = extractHeadings('<h2>A <code>key</code> thing</h2>');
    expect(headings[0].text).toBe("A key thing");
    expect(headings[0].id).toBe("a-key-thing");
  });

  it("ignores h1 and h4", () => {
    const { headings } = extractHeadings("<h1>Title</h1><h4>Deep</h4>");
    expect(headings).toEqual([]);
  });

  it("de-duplicates identical headings so ToC links stay correct", () => {
    const { html, headings } = extractHeadings("<h2>Step</h2><h2>Step</h2>");

    expect(headings.map((h) => h.id)).toEqual(["step", "step-2"]);
    expect(html).toContain('id="step-2"');
  });
});
