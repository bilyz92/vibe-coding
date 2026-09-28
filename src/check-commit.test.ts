import { execSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { blockedPaths } from "./check-commit.js";

let repoRoot: string;
let base: string;

beforeEach(() => {
  repoRoot = mkdtempSync(join(tmpdir(), "vibe-coding-check-"));
  execSync("git init -q && git config user.email t@t && git config user.name t", { cwd: repoRoot });
  writeFileSync(
    join(repoRoot, "agent.config.json"),
    JSON.stringify({ denylist: [".env*"], bashAllowlist: [], lintCommand: "true", testCommand: "true", agentsFile: "AGENTS.md" }),
  );
  writeFileSync(join(repoRoot, "secret.txt"), "old");
  execSync("git add -A && git commit -qm base", { cwd: repoRoot });
  base = execSync("git rev-parse HEAD", { cwd: repoRoot }).toString().trim();
});

afterEach(() => {
  rmSync(repoRoot, { recursive: true, force: true });
});

function commitAll(message: string) {
  execSync(`git add -A && git commit -qm "${message}"`, { cwd: repoRoot });
}

describe("blockedPaths (publish-side re-check of the agent's patch)", () => {
  it("accepts a patch that only touches allowed files", () => {
    writeFileSync(join(repoRoot, "app.ts"), "export {}");
    commitAll("ok");
    expect(blockedPaths(repoRoot, base)).toEqual([]);
  });

  it("rejects denylisted files, using the base commit's config rather than the patched one", () => {
    writeFileSync(join(repoRoot, ".env"), "SECRET=1");
    writeFileSync(
      join(repoRoot, "agent.config.json"),
      JSON.stringify({ denylist: [], bashAllowlist: [], lintCommand: "true", testCommand: "true", agentsFile: "AGENTS.md" }),
    );
    commitAll("forged");
    expect(blockedPaths(repoRoot, base).sort()).toEqual([".env", "agent.config.json"]);
  });

  it("checks every commit since base, not just the last one", () => {
    writeFileSync(join(repoRoot, ".env"), "SECRET=1");
    commitAll("first");
    writeFileSync(join(repoRoot, "app.ts"), "export {}");
    commitAll("second");
    expect(blockedPaths(repoRoot, base)).toEqual([".env"]);
  });
});
