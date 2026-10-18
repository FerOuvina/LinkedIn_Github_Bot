import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { createElement, Fragment } from "react";
import { Router, Route } from "wouter";

// Pages serves the app under a subpath. If the router is not told about that
// base, it compares "/LinkedIn_Github_Bot/" against the route "/", matches
// nothing, and renders a blank page with no console error.
const BASE = "/LinkedIn_Github_Boot";

function Probe() {
  return createElement(
    Fragment,
    null,
    createElement(Route, { path: "/" }, createElement("p", null, "HOME")),
    createElement(Route, { path: "/guide" }, createElement("p", null, "GUIDE")),
    createElement(
      Route,
      { path: "/getting-started" },
      createElement("p", null, "WIZARD")
    )
  );
}

const render = (path, base) =>
  renderToString(
    createElement(Router, { base, ssrPath: path }, createElement(Probe))
  );

describe("routing under the Pages base path", () => {
  it.each([
    [`${BASE}/`, "HOME"],
    [`${BASE}/guide`, "GUIDE"],
    [`${BASE}/getting-started`, "WIZARD"],
  ])("renders %s", (path, expected) => {
    expect(render(path, BASE)).toContain(expected);
  });

  it("renders nothing without a base, which is the blank page bug", () => {
    // Guards that this test is still meaningful.
    expect(render(`${BASE}/`, "")).not.toContain("HOME");
  });

  it("still works at the root when served from a domain root", () => {
    expect(render("/", "")).toContain("HOME");
    expect(render("/guide", "")).toContain("GUIDE");
  });
});

describe("the app wires the base into the router", () => {
  it("passes BASE_URL to Router", async () => {
    const source = await import("./App.jsx?raw").then((m) => m.default);
    expect(source).toContain("<Router base={BASE}>");
    expect(source).toContain("import.meta.env.BASE_URL");
  });
});
