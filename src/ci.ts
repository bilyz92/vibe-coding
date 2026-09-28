#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { loadRepoConfig } from "./config.js";
import { childEnv } from "./env.js";
import { runPipeline } from "./pipeline.js";
import { parseTrigger } from "./trigger.js";

const ALLOWED_ASSOCIATIONS = ["OWNER", "MEMBER", "COLLABORATOR"];

/**
 * CI stage 1 of 2. Runs the pipeline and writes its outcome to
 * $VIBE_RESULT_DIR (`status`, plus `reason` or `change.patch`). It holds no
 * GitHub write credentials: this job runs model-written code, so pushing,
 * opening the PR and commenting happen in a separate job (see
 * .github/workflows/vibe-code.yml) that never executes any of it.
 */
async function main() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  const resultDir = process.env.VIBE_RESULT_DIR;
  if (!eventPath || !resultDir) {
    throw new Error("GITHUB_EVENT_PATH / VIBE_RESULT_DIR not set — this entrypoint only runs inside GitHub Actions");
  }
  mkdirSync(resultDir, { recursive: true });
  const event = JSON.parse(readFileSync(eventPath, "utf-8"));

  const trigger = parseTrigger(event, ALLOWED_ASSOCIATIONS);
  if (!trigger) {
    console.log("no authorized /vibe-code trigger found in this event — skipping");
    writeFileSync(join(resultDir, "status"), "skipped");
    return;
  }

  const repoRoot = process.cwd();
  const config = loadRepoConfig(repoRoot);
  const result = await runPipeline(new Anthropic(), repoRoot, config, trigger.task);

  if (result.status === "committed") {
    const patch = execFileSync("git", ["format-patch", "-1", "HEAD", "--stdout"], {
      cwd: repoRoot,
      encoding: "utf-8",
      env: childEnv(),
    });
    writeFileSync(join(resultDir, "change.patch"), patch);
  } else if (result.status === "gave_up") {
    writeFileSync(join(resultDir, "reason"), result.reason);
  }
  writeFileSync(join(resultDir, "status"), result.status);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
