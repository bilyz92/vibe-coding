import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import type { RepoConfig } from "./config.js";
import { commitChanges } from "./commit.js";
import { implement } from "./implement.js";
import { review } from "./review.js";
import { verify } from "./verify.js";

export type PipelineResult =
  | { status: "committed" }
  | { status: "no_changes" }
  | { status: "gave_up"; reason: string };

function gitDiff(repoRoot: string): string {
  // --intent-to-add marks new files as tracked (empty blob) without staging
  // their content, so `git diff HEAD` includes them as additions — a plain
  // `git diff HEAD` silently omits untracked files entirely.
  execFileSync("git", ["add", "-A", "-N"], { cwd: repoRoot });
  return execFileSync("git", ["diff", "HEAD"], { cwd: repoRoot, encoding: "utf-8" });
}

function systemPrompt(repoRoot: string, config: RepoConfig): string {
  const agentsFile = join(repoRoot, config.agentsFile);
  let conventions = "";
  try {
    conventions = readFileSync(agentsFile, "utf-8");
  } catch {
    conventions = "(no AGENTS.md/CLAUDE.md found — follow ambient repo conventions)";
  }
  return [
    "You are a coding agent working inside an existing repository.",
    `Repo conventions (${config.agentsFile}):`,
    conventions,
    "Stop calling tools once the task is fully implemented — do not ask to run lint/test yourself, the harness runs it for you.",
  ].join("\n\n");
}

/**
 * Runs the four-stage pipeline: implement -> verify -> review -> commit,
 * retrying stage 1 on verify/review failure up to config.maxRetries.
 */
export async function runPipeline(
  client: Anthropic,
  repoRoot: string,
  config: RepoConfig,
  task: string,
): Promise<PipelineResult> {
  let messages: Anthropic.MessageParam[] = [
    { role: "user", content: `${systemPrompt(repoRoot, config)}\n\nTask: ${task}` },
  ];

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    messages = await implement(client, repoRoot, config, messages);

    const verifyResult = verify(repoRoot, config);
    if (!verifyResult.passed) {
      messages.push({
        role: "user",
        content: `Verification failed. Fix it.\n\n${verifyResult.output}`,
      });
      continue;
    }

    const diff = gitDiff(repoRoot);
    if (!diff.trim()) {
      return { status: "no_changes" };
    }

    const findings = await review(client, diff);
    if (findings.length > 0) {
      const summary = findings.map((f) => `- [${f.severity}] ${f.file}: ${f.summary}`).join("\n");
      messages.push({ role: "user", content: `Review found issues. Fix them.\n\n${summary}` });
      continue;
    }

    const commitResult = commitChanges(repoRoot, config, task);
    if (!commitResult.committed) {
      return {
        status: "gave_up",
        reason: `commit blocked: denylisted files changed: ${commitResult.blocked.join(", ")}`,
      };
    }
    return { status: "committed" };
  }

  return { status: "gave_up", reason: `exceeded maxRetries (${config.maxRetries})` };
}
