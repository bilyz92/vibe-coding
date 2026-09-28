#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { parseRepoConfig } from "./config.js";
import { harnessGit } from "./git.js";
import { checkPath } from "./guard.js";

/**
 * Paths changed between `baseRef` and HEAD in `repoRoot` that the base
 * commit's config denylists. Run by the CI publish job on the applied patch:
 * the artifact comes from a job that executed model-written code and may have
 * been tampered with after the harness's own checks, so this is the check that
 * actually guards what gets pushed. The config is read from `baseRef`, not the
 * working tree, so a patch cannot loosen the rules it is judged by.
 */
export function blockedPaths(repoRoot: string, baseRef: string): string[] {
  const config = parseRepoConfig(harnessGit(repoRoot, ["show", `${baseRef}:agent.config.json`]));
  const changed = harnessGit(repoRoot, ["diff", "--name-only", "--no-renames", "-z", baseRef, "HEAD"])
    .split("\0")
    .filter(Boolean);
  return changed.filter((path) => !checkPath(repoRoot, config.denylist, path).ok);
}

// CLI: check-commit <repoRoot> <baseRef> — exits 1 listing blocked paths.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [repoRoot, baseRef] = process.argv.slice(2);
  const blocked = blockedPaths(repoRoot, baseRef);
  if (blocked.length > 0) {
    console.error(`patch touches denylisted files: ${blocked.join(", ")}`);
    process.exitCode = 1;
  }
}
