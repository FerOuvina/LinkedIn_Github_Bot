import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { mergeEnv, writeEnvFile } from "../scripts/envFile.js";

let dir;
let file;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "envfile-"));
  file = path.join(dir, ".env");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("mergeEnv", () => {
  it("adds keys to an empty file", () => {
    const out = mergeEnv("", { A: "1", B: "2" });
    expect(out).toBe("A=1\nB=2\n");
  });

  it("replaces an existing value instead of appending a duplicate", () => {
    const out = mergeEnv("A=old\nB=keep\n", { A: "new" });
    expect(out).toBe("A=new\nB=keep\n");
    expect(out.match(/^A=/gm)).toHaveLength(1);
  });

  it("preserves comments and unrelated variables", () => {
    const existing = "# my config\nA=old\n\n# another note\nB=keep\n";
    const out = mergeEnv(existing, { A: "new" });

    expect(out).toContain("# my config");
    expect(out).toContain("# another note");
    expect(out).toContain("B=keep");
    expect(out).toContain("A=new");
  });

  it("ignores empty values so a blank field never overwrites a good one", () => {
    const out = mergeEnv("A=good\n", { A: "" });
    expect(out).toBe("A=good\n");
  });

  it("appends genuinely new keys at the end", () => {
    const out = mergeEnv("A=1\n", { Z: "9" });
    expect(out).toBe("A=1\nZ=9\n");
  });

  it("handles a file with no trailing newline", () => {
    const out = mergeEnv("A=1", { B: "2" });
    expect(out).toBe("A=1\nB=2\n");
  });

  it("keeps values containing = signs intact", () => {
    const out = mergeEnv("", { TOKEN: "abc=def==ghi" });
    expect(out).toBe("TOKEN=abc=def==ghi\n");
  });

  it("always ends with a newline", () => {
    expect(mergeEnv("A=1\n", {})).toMatch(/\n$/);
  });
});

describe("writeEnvFile", () => {
  it("creates the file when it does not exist", () => {
    const result = writeEnvFile(file, { A: "1" });

    expect(result.ok).toBe(true);
    expect(result.updated).toEqual(["A"]);
    expect(readFileSync(file, "utf8")).toBe("A=1\n");
  });

  it("updates only the keys given", () => {
    writeFileSync(file, "KEEP=old\nCHANGE=before\n");
    const result = writeEnvFile(file, { CHANGE: "after" });

    expect(result.updated).toEqual(["CHANGE"]);
    const content = readFileSync(file, "utf8");
    expect(content).toContain("KEEP=old");
    expect(content).toContain("CHANGE=after");
    expect(content).not.toContain("before");
  });

  it("reports nothing written when every value is blank", () => {
    writeFileSync(file, "A=keep\n");
    const result = writeEnvFile(file, { A: "", B: undefined });

    expect(result.updated).toEqual([]);
    expect(readFileSync(file, "utf8")).toBe("A=keep\n");
  });

  it("never writes a secret value into the returned result", () => {
    const result = writeEnvFile(file, { LINKEDIN_ACCESS_TOKEN: "super-secret-value" });
    expect(JSON.stringify(result)).not.toContain("super-secret-value");
  });

  it("leaves an existing file intact when nothing is written", () => {
    writeFileSync(file, "# important\nA=1\n");
    writeEnvFile(file, {});
    expect(readFileSync(file, "utf8")).toBe("# important\nA=1\n");
  });

  it("does not create a file when there is nothing to write", () => {
    const result = writeEnvFile(file, {});
    expect(result.updated).toEqual([]);
    expect(existsSync(file)).toBe(false);
  });
});
