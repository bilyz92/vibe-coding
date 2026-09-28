import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import type { RepoConfig } from "./config.js";
import { changedFiles, commitChanges } from "./commit.js";
import { childEnv } from "./env.js";
import { checkPath } from "./guard.js";
import { implement, ToolTurnLimitError } from "./implement.js";
import { review } from "./review.js";
import { truncateMiddle } from "./truncate.js";
import { verify } from "./verify.js";

export type PipelineResult =
  | { status: "committed" }
  | { status: "no_changes" }
  | { status: "gave_up"; reason: string };

/**
 * Diff of `files` against HEAD, for the reviewer. Denylisted files are left
 * out so their contents (e.g. an un-ignored .env) never reach the API.
 * --intent-to-add is needed for untracked files to show up in `git diff HEAD`;
 * it is applied to a throwaway copy of the index so the target repo's real
 * index is left exactly as it was, even if the pipeline gives up.
 */
function reviewableDiff(repoRoot: string, config: RepoConfig, files: string[]): string {
  const reviewable = files.filter((file) => checkPath(repoRoot, config.denylist, file).ok);
  if (reviewable.length === 0) return "";

  const git = (args: string[], env: NodeJS.ProcessEnv) =>
    execFileSync("git", args, { cwd: repoRoot, encoding: "utf-8", env });
  const realIndex = resolve(repoRoot, git(["rev-parse", "--git-path", "index"], childEnv()).trim());
  const tempDir = mkdtempSync(join(tmpdir(), "vibe-coding-index-"));
  const env = { ...childEnv(), GIT_INDEX_FILE: join(tempDir, "index") };
  try {
    if (existsSync(realIndex)) copyFileSync(realIndex, env.GIT_INDEX_FILE);
    git(["add", "-A", "-N", "--", ...reviewable], env);
    return git(["diff", "HEAD", "--", ...reviewable], env);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

const SUBJECT_MAX = 72;

/** First line of the task as the subject (capped at 72 chars), full task in the body when it doesn't fit. */
function commitMessage(task: string): string {
  const firstLine = task.trim().split("\n")[0].replace(/\s+/g, " ");
  const subject = firstLine.length > SUBJECT_MAX ? `${firstLine.slice(0, SUBJECT_MAX - 1)}…` : firstLine;
  return subject === task.trim() ? subject : `${subject}\n\n${task.trim()}`;
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
    try {
      messages = await implement(client, repoRoot, config, messages);
    } catch (error) {
      if (error instanceof ToolTurnLimitError) {
        return { status: "gave_up", reason: error.message };
      }
      throw error;
    }

    const verifyResult = verify(repoRoot, config);
    if (!verifyResult.passed) {
      messages.push({
        role: "user",
        content: `Verification failed. Fix it.\n\n${truncateMiddle(verifyResult.output)}`,
      });
      continue;
    }

    const files = changedFiles(repoRoot);
    if (files.length === 0) {
      return { status: "no_changes" };
    }
    const diff = reviewableDiff(repoRoot, config, files);

    // Minor findings are advisory: retrying on them can burn every retry on
    // nitpicks and end in gave_up for an otherwise correct change.
    const findings = (await review(client, task, diff)).filter((f) => f.severity === "blocking");
    if (findings.length > 0) {
      const summary = findings.map((f) => `- [${f.severity}] ${f.file}: ${f.summary}`).join("\n");
      messages.push({ role: "user", content: `Review found issues. Fix them.\n\n${summary}` });
      continue;
    }

    const commitResult = commitChanges(repoRoot, config, commitMessage(task));
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
