import { execFileSync } from "node:child_process";
import { childEnv } from "./env.js";

/**
 * Runs git on behalf of the harness itself. Repo-controlled programs that git
 * would otherwise run — hooks and core.fsmonitor, both settable by the model
 * via `git config` — are disabled, since they could change what gets checked
 * or committed; and the child gets the credential-free environment.
 */
export function harnessGit(
  repoRoot: string,
  args: string[],
  options: { env?: NodeJS.ProcessEnv; maxBuffer?: number } = {},
): string {
  return execFileSync("git", ["-c", "core.hooksPath=/dev/null", "-c", "core.fsmonitor=false", ...args], {
    cwd: repoRoot,
    encoding: "utf-8",
    env: options.env ?? childEnv(),
    maxBuffer: options.maxBuffer,
  });
}
