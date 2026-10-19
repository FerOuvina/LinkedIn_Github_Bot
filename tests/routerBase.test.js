import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WEB_BASE, stripBase } from "../scripts/webBase.js";

// This test deliberately avoids importing react or wouter: CI installs only
// the root dependencies, so web/node_modules is not there and a react import
// fails the whole suite. The routing contract is ours to check, not wouter's.
const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "web", "src");
const app = readFileSync(path.join(WEB, "App.jsx"), "utf8");

/** Routes the app declares, read from the source. */
function declaredRoutes() {
  return [...app.matchAll(/<Route path="([^"]+)"/g)].map((m) => m[1]);
}

describe("routing under the Pages base path", () => {
  it("declares the three routes", () => {
    expect(declaredRoutes().sort()).toEqual(["/", "/getting-started", "/guide"]);
  });

  it.each(declaredRoutes())("%s is reachable once the base is stripped", (route) => {
    // A visitor on Pages lands on /LinkedIn_Github_Boot/guide, which must
    // resolve to the route "/guide".
    const visited = `${WEB_BASE.replace(/\/$/, "")}${route}`;
    expect(stripBase(visited)).toBe(route);
  });

  it("would fail without stripping the base, which is the blank page", () => {
    // Guards that the test above is still meaningful: comparing the browser
    // path to the route directly matches nothing and renders nothing at all.
    const visited = `${WEB_BASE.replace(/\/$/, "")}/`;
    expect(visited).not.toBe("/");
  });

  it("hands the base to the router, from the build-time base", () => {
    expect(app).toContain("<Router base={BASE}>");
    expect(app).toContain("import.meta.env.BASE_URL");
  });
});
