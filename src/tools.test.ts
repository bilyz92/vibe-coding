import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runBash, runTextEditor } from "./tools.js";
import type { RepoConfig } from "./config.js";

let repoRoot: string;
const config: RepoConfig = {
  denylist: [".env*", "secrets/**"],
  bashAllowlist: ["echo", "ls"],
  lintCommand: "true",
  testCommand: "true",
  agentsFile: "AGENTS.md",
  maxRetries: 3,
};

beforeEach(() => {
  repoRoot = mkdtempSync(join(tmpdir(), "vibe-coding-tools-"));
});

afterEach(() => {
  rmSync(repoRoot, { recursive: true, force: true });
});

describe("runTextEditor", () => {
  it("creates a file inside the repo root", () => {
    const result = runTextEditor(repoRoot, config, {
      command: "create",
      path: "src/app.ts",
      file_text: "export {}",
    });
    expect(result.isError).toBe(false);
    expect(readFileSync(join(repoRoot, "src/app.ts"), "utf-8")).toBe("export {}");
  });

  it("blocks writes to a denylisted path and does not create the file", () => {
    const result = runTextEditor(repoRoot, config, {
      command: "create",
      path: ".env",
      file_text: "SECRET=1",
    });
    expect(result.isError).toBe(true);
    expect(existsSync(join(repoRoot, ".env"))).toBe(false);
  });

  it("blocks path traversal escaping the repo root", () => {
    const result = runTextEditor(repoRoot, config, {
      command: "create",
      path: "../outside.ts",
      file_text: "x",
    });
    expect(result.isError).toBe(true);
    expect(existsSync(join(repoRoot, "..", "outside.ts"))).toBe(false);
  });

  it("str_replace requires exactly one match", () => {
    runTextEditor(repoRoot, config, { command: "create", path: "a.ts", file_text: "x\nx\n" });
    const result = runTextEditor(repoRoot, config, {
      command: "str_replace",
      path: "a.ts",
      old_str: "x",
      new_str: "y",
    });
    expect(result.isError).toBe(true);
  });
});

describe("runBash", () => {
  it("runs an allowlisted command", () => {
    const result = runBash(repoRoot, config, "echo hello");
    expect(result.isError).toBe(false);
    expect(result.output).toContain("hello");
  });

  it("blocks a non-allowlisted command", () => {
    const result = runBash(repoRoot, config, "curl http://example.com");
    expect(result.isError).toBe(true);
  });

  it("blocks reading a denylisted file through an allowlisted command", () => {
    writeFileSync(join(repoRoot, ".env"), "SECRET=1");
    const result = runBash(repoRoot, config, "ls .env");
    expect(result.isError).toBe(true);
    expect(result.output).toContain("blocked");
  });

  it("blocks command arguments pointing outside the repo root", () => {
    const result = runBash(repoRoot, config, "ls /etc");
    expect(result.isError).toBe(true);
    expect(result.output).toContain("blocked");
  });

  it("blocks command chaining and does not execute the tail command", () => {
    const result = runBash(repoRoot, config, "echo hi && echo blocked-side-effect");
    expect(result.isError).toBe(true);
    expect(result.output).not.toContain("blocked-side-effect");
  });
});
