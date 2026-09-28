import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadRepoConfig } from "./config.js";
import { checkPath } from "./guard.js";

let dir: string | undefined;

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

describe("loadRepoConfig", () => {
  it("parses a valid agent.config.json", () => {
    dir = mkdtempSync(join(tmpdir(), "vibe-coding-config-"));
    writeFileSync(
      join(dir, "agent.config.json"),
      JSON.stringify({
        denylist: ["prisma/migrations/**", ".env*"],
        bashAllowlist: ["git", "npm"],
        lintCommand: "npm run lint",
        testCommand: "npm test",
        agentsFile: "AGENTS.md",
      }),
    );

    const config = loadRepoConfig(dir);
    expect(config.denylist).toContain(".env*");
    expect(config.maxRetries).toBe(3); // default
  });

  it("throws a readable error when the config is missing required fields", () => {
    dir = mkdtempSync(join(tmpdir(), "vibe-coding-config-"));
    const repoRoot = dir;
    writeFileSync(join(repoRoot, "agent.config.json"), JSON.stringify({ denylist: [] }));

    expect(() => loadRepoConfig(repoRoot)).toThrow();
  });

  it("throws when agent.config.json does not exist", () => {
    dir = mkdtempSync(join(tmpdir(), "vibe-coding-config-"));
    const repoRoot = dir;
    expect(() => loadRepoConfig(repoRoot)).toThrow(/agent\.config\.json/);
  });

  it("always denylists the guardrail config, the agents file and .git, whatever the repo config says", () => {
    dir = mkdtempSync(join(tmpdir(), "vibe-coding-config-"));
    writeFileSync(
      join(dir, "agent.config.json"),
      JSON.stringify({
        denylist: [],
        bashAllowlist: ["git"],
        lintCommand: "true",
        testCommand: "true",
        agentsFile: "CLAUDE.md",
      }),
    );

    const config = loadRepoConfig(dir);
    expect(checkPath(dir, config.denylist, "agent.config.json").ok).toBe(false);
    expect(checkPath(dir, config.denylist, "CLAUDE.md").ok).toBe(false);
    expect(checkPath(dir, config.denylist, ".git/hooks/pre-commit").ok).toBe(false);
  });
});
