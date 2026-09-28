import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import type { RepoConfig } from "./config.js";
import { changedFiles, commitChanges } from "./commit.js";
import { childEnv } from "./env.js";
import { harnessGit } from "./git.js";
import { checkPath } from "./guard.js";
import { implement, ToolTurnLimitError } from "./implement.js";
import { review } from "./review.js";
import { truncateMiddle } from "./truncate.js";
import { verify } from "./verify.js";

export type PipelineResult =
  | { status: "committed" }
  | { status: "no_changes" }
  | { status: "gave_up"; reason: string };

/** Diffs larger than this are refused rather than truncated: a reviewer that sees part of a change must not approve all of it. */
export const MAX_REVIEW_DIFF_CHARS = 400_000;

/**
 * Diff of `files` (already denylist-checked) against HEAD, for the reviewer.
 * --intent-to-add is needed for untracked files to show up in `git diff HEAD`;
 * it is applied to a throwaway copy of the index so the target repo's real
 * index is left exactly as it was, even if the pipeline gives up.
 */
function reviewDiff(repoRoot: string, files: string[]): string | null {
  const realIndex = resolve(repoRoot, harnessGit(repoRoot, ["rev-parse", "--git-path", "index"]).trim());
  const tempDir = mkdtempSync(join(tmpdir(), "vibe-coding-index-"));
  const env = { ...childEnv(), GIT_INDEX_FILE: join(tempDir, "index") };
  try {
    if (existsSync(realIndex)) copyFileSync(realIndex, env.GIT_INDEX_FILE);
    harnessGit(repoRoot, ["add", "-A", "-N", "--", ...files], { env });
    // A UTF-8 char is at most 4 bytes, so anything past this buffer is over the limit anyway.
    return harnessGit(repoRoot, ["diff", "--no-ext-diff", "--no-textconv", "HEAD", "--", ...files], {
      env,
      maxBuffer: MAX_REVIEW_DIFF_CHARS * 4,
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOBUFS") return null;
    throw error;
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
    // Checked before review, not just at commit: a denylisted file's contents
    // (directly, or via a rename to an allowed path) must never reach the API.
    const denied = files.filter((file) => !checkPath(repoRoot, config.denylist, file).ok);
    if (denied.length > 0) {
      return { status: "gave_up", reason: `denylisted files changed: ${denied.join(", ")}` };
    }
    const diff = reviewDiff(repoRoot, files);
    if (diff === null || diff.length > MAX_REVIEW_DIFF_CHARS) {
      return { status: "gave_up", reason: `diff too large to review (over ${MAX_REVIEW_DIFF_CHARS} chars)` };
    }

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
