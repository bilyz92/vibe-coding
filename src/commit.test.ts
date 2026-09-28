import { execSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { commitChanges } from "./commit.js";
import type { RepoConfig } from "./config.js";

let repoRoot: string;
const config: RepoConfig = {
  denylist: [".env*", "secrets/**"],
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

  it("refuses to commit a denylisted file inside a brand-new untracked directory", () => {
    mkdirSync(join(repoRoot, "secrets"));
    writeFileSync(join(repoRoot, "secrets", "key.pem"), "PRIVATE");
    const result = commitChanges(repoRoot, config, "feat: oops");
    expect(result.committed).toBe(false);
    expect(result.blocked).toContain("secrets/key.pem");
    const tracked = execSync("git ls-files", { cwd: repoRoot }).toString();
    expect(tracked).not.toContain("secrets/key.pem");
  });

  it("refuses to commit a rename whose source is denylisted", () => {
    writeFileSync(join(repoRoot, ".env"), "SECRET=1");
    execSync("git add -f .env && git commit -m env", { cwd: repoRoot });
    execSync("git mv .env leaked.txt", { cwd: repoRoot });
    const result = commitChanges(repoRoot, config, "feat: rename");
    expect(result.committed).toBe(false);
    expect(result.blocked).toContain(".env");
  });

  it("commits a file whose name contains non-ASCII characters", () => {
    writeFileSync(join(repoRoot, "tài liệu.ts"), "export {}");
    const result = commitChanges(repoRoot, config, "feat: spaced");
    expect(result.committed).toBe(true);
    const tracked = execSync("git -c core.quotepath=off ls-files", { cwd: repoRoot }).toString();
    expect(tracked).toContain("tài liệu.ts");
  });

  it("does not expose the harness's credentials to git hooks", () => {
    const hooks = join(repoRoot, "hooks");
    mkdirSync(hooks);
    const leak = join(repoRoot, "leaked.txt");
    writeFileSync(join(hooks, "pre-commit"), `#!/bin/sh\nprintenv GH_TOKEN > "${leak}"\nexit 0\n`, { mode: 0o755 });
    execSync("git config core.hooksPath hooks", { cwd: repoRoot });
    writeFileSync(join(repoRoot, "app.ts"), "export {}");
    process.env.GH_TOKEN = "gh-secret";
    try {
      commitChanges(repoRoot, config, "feat: add app.ts");
    } finally {
      delete process.env.GH_TOKEN;
    }
    expect(existsSync(leak) ? readFileSync(leak, "utf-8") : "").not.toContain("gh-secret");
  });

  it("does not run repo hooks that could stage denylisted files after the check", () => {
    const hooks = join(repoRoot, "hooks");
    mkdirSync(hooks);
    writeFileSync(join(hooks, "pre-commit"), "#!/bin/sh\necho SECRET=1 > .env\ngit add -f .env\n", { mode: 0o755 });
    execSync("git add hooks && git commit -qm hooks && git config core.hooksPath hooks", { cwd: repoRoot });
    writeFileSync(join(repoRoot, "app.ts"), "export {}");

    commitChanges(repoRoot, config, "feat: add app.ts");

    const committed = execSync("git show --name-only --format= HEAD", { cwd: repoRoot }).toString();
    expect(committed).not.toContain(".env");
  });

  it("never runs a repo-configured fsmonitor while checking and committing", () => {
    const marker = join(repoRoot, "..", `fsmonitor-ran-${Date.now()}`);
    writeFileSync(join(repoRoot, "fsm.sh"), `#!/bin/sh\ntouch "${marker}"\nexit 1\n`, { mode: 0o755 });
    execSync("git add fsm.sh && git commit -qm fsm && git config core.fsmonitor ./fsm.sh", { cwd: repoRoot });
    writeFileSync(join(repoRoot, "app.ts"), "export {}");

    try {
      commitChanges(repoRoot, config, "feat: add app.ts");
      expect(existsSync(marker)).toBe(false);
    } finally {
      rmSync(marker, { force: true });
    }
  });

  it("does nothing when there are no changes", () => {
    const result = commitChanges(repoRoot, config, "feat: noop");
    expect(result.committed).toBe(false);
    expect(result.blocked).toEqual([]);
  });
});
