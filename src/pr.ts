import { execFileSync } from "node:child_process";

/** These shell out to `git`/`gh` directly — harness-controlled, not exposed to the model. */

export function createBranch(repoRoot: string, branch: string): void {
  execFileSync("git", ["checkout", "-b", branch], { cwd: repoRoot });
}

export function pushBranch(repoRoot: string, branch: string): void {
  execFileSync("git", ["push", "-u", "origin", branch], { cwd: repoRoot });
}

export function openPullRequest(repoRoot: string, branch: string, title: string, body: string): string {
  return execFileSync(
    "gh",
    ["pr", "create", "--head", branch, "--title", title, "--body", body],
    { cwd: repoRoot, encoding: "utf-8" },
  ).trim();
}

export function commentOnIssue(repoRoot: string, issueNumber: number, body: string): void {
  execFileSync("gh", ["issue", "comment", String(issueNumber), "--body", body], { cwd: repoRoot });
}
