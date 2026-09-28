import { spawnSync } from "node:child_process";
import type { RepoConfig } from "./config.js";
import { childEnv } from "./env.js";

export type VerifyResult = { passed: boolean; output: string };

/** Runs the repo's configured lint + test commands. Not exposed to the model as a tool — the harness always runs this itself. */
export function verify(repoRoot: string, config: RepoConfig): VerifyResult {
  const lint = spawnSync(config.lintCommand, { cwd: repoRoot, shell: true, encoding: "utf-8", env: childEnv() });
  if (lint.status !== 0) {
    return { passed: false, output: `lint failed:\n${lint.stdout}${lint.stderr}` };
  }

  const test = spawnSync(config.testCommand, { cwd: repoRoot, shell: true, encoding: "utf-8", env: childEnv() });
  if (test.status !== 0) {
    return { passed: false, output: `tests failed:\n${test.stdout}${test.stderr}` };
  }

  return { passed: true, output: `${lint.stdout}${test.stdout}` };
}
