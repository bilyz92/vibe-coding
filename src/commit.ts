import { execFileSync } from "node:child_process";
import { checkPath } from "./guard.js";
import type { RepoConfig } from "./config.js";

export type CommitResult = { committed: boolean; blocked: string[] };

function changedFiles(repoRoot: string): string[] {
  const output = execFileSync("git", ["status", "--porcelain"], {
    cwd: repoRoot,
    encoding: "utf-8",
  });
  return output
    .split("\n")
    .map((line) => line.slice(3).trim())
    .filter(Boolean);
}

/**
 * Commits only files that pass the denylist guard, as a last line of
 * defense independent of whatever guarded the edit itself. If any changed
 * file is denylisted, nothing is committed and the caller must resolve it.
 */
export function commitChanges(repoRoot: string, config: RepoConfig, message: string): CommitResult {
  const files = changedFiles(repoRoot);
  if (files.length === 0) {
    return { committed: false, blocked: [] };
  }

  const blocked = files.filter((file) => !checkPath(repoRoot, config.denylist, file).ok);
  if (blocked.length > 0) {
    return { committed: false, blocked };
  }

  execFileSync("git", ["add", ...files], { cwd: repoRoot });
  execFileSync("git", ["commit", "-m", message], { cwd: repoRoot });
  return { committed: true, blocked: [] };
}
