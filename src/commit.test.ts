import { execSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { commitChanges } from "./commit.js";
import type { RepoConfig } from "./config.js";

let repoRoot: string;
const config: RepoConfig = {
  denylist: [".env*"],
  bashAllowlist: [],
  lintCommand: "true",
  testCommand: "true",
  agentsFile: "AGENTS.md",
  maxRetries: 3,
};

beforeEach(() => {
  repoRoot = mkdtempSync(join(tmpdir(), "vibe-coding-commit-"));
  execSync("git init", { cwd: repoRoot });
  execSync("git config user.email test@example.com", { cwd: repoRoot });
  execSync("git config user.name test", { cwd: repoRoot });
  writeFileSync(join(repoRoot, "README.md"), "init");
  execSync("git add README.md && git commit -m init", { cwd: repoRoot });
});

afterEach(() => {
  rmSync(repoRoot, { recursive: true, force: true });
});

describe("commitChanges", () => {
  it("commits allowed changed files", () => {
    writeFileSync(join(repoRoot, "app.ts"), "export {}");
    const result = commitChanges(repoRoot, config, "feat: add app.ts");
    expect(result.committed).toBe(true);
    const log = execSync("git log --oneline", { cwd: repoRoot }).toString();
    expect(log).toContain("feat: add app.ts");
  });

  it("refuses to commit a denylisted file even if it appears modified", () => {
    writeFileSync(join(repoRoot, ".env"), "SECRET=1");
    const result = commitChanges(repoRoot, config, "feat: oops");
    expect(result.committed).toBe(false);
    expect(result.blocked).toContain(".env");
  });

  it("does nothing when there are no changes", () => {
    const result = commitChanges(repoRoot, config, "feat: noop");
    expect(result.committed).toBe(false);
    expect(result.blocked).toEqual([]);
  });
});
