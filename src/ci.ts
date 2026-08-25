#!/usr/bin/env node
import { readFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { loadRepoConfig } from "./config.js";
import { runPipeline } from "./pipeline.js";
import { parseTrigger } from "./trigger.js";
import { commentOnIssue, createBranch, openPullRequest, pushBranch } from "./pr.js";

const ALLOWED_ASSOCIATIONS = ["OWNER", "MEMBER", "COLLABORATOR"];

async function main() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) {
    throw new Error("GITHUB_EVENT_PATH not set — this entrypoint only runs inside GitHub Actions");
  }
  const event = JSON.parse(readFileSync(eventPath, "utf-8"));

  const trigger = parseTrigger(event, ALLOWED_ASSOCIATIONS);
  if (!trigger) {
    console.log("no authorized /vibe-code trigger found in this event — skipping");
    return;
  }

  const repoRoot = process.cwd();
  const config = loadRepoConfig(repoRoot);
  const client = new Anthropic();
  const branch = `vibe-coding/issue-${trigger.issueNumber}-${Date.now()}`;

  createBranch(repoRoot, branch);
  const result = await runPipeline(client, repoRoot, config, trigger.task);

  if (result.status === "committed") {
    pushBranch(repoRoot, branch);
    const prUrl = openPullRequest(
      repoRoot,
      branch,
      trigger.task,
      `Closes #${trigger.issueNumber}\n\nTask: ${trigger.task}`,
    );
    commentOnIssue(repoRoot, trigger.issueNumber, `Opened ${prUrl}`);
  } else if (result.status === "no_changes") {
    commentOnIssue(repoRoot, trigger.issueNumber, "No changes were needed for this task.");
  } else {
    commentOnIssue(repoRoot, trigger.issueNumber, `Gave up: ${result.reason}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
