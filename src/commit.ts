import { execFileSync } from "node:child_process";
import { checkPath } from "./guard.js";
import type { RepoConfig } from "./config.js";
import { childEnv } from "./env.js";

export type CommitResult = { committed: boolean; blocked: string[] };

/**
 * Lists every changed path, one per file: `-z` keeps names unquoted (git
 * otherwise quotes/escapes non-ASCII names), `--untracked-files=all` expands
 * a new directory into its files so each is denylist-checked, and a rename
 * contributes its source path too (renaming a denylisted file away is a
 * change to it).
 */
function changedFiles(repoRoot: string): string[] {
  const output = execFileSync("git", ["status", "--porcelain", "-z", "--untracked-files=all"], {
    cwd: repoRoot,
    encoding: "utf-8",
    env: childEnv(),
  });
  const entries = output.split("\0");
  const files: string[] = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (!entry) continue;
    files.push(entry.slice(3));
    const status = entry.slice(0, 2);
    if (status.includes("R") || status.includes("C")) {
      files.push(entries[++i]);
    }
  }
  return files;
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

  execFileSync("git", ["add", "--", ...files], { cwd: repoRoot, env: childEnv() });
  execFileSync("git", ["commit", "-m", message], { cwd: repoRoot, env: childEnv() });
  return { committed: true, blocked: [] };
}
