#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { loadRepoConfig } from "./config.js";
import { isolationProblems, takeApiKeyFile } from "./env.js";
import { harnessGit } from "./git.js";
import { runPipeline } from "./pipeline.js";
import { parseTrigger } from "./trigger.js";

const ALLOWED_ASSOCIATIONS = ["OWNER", "MEMBER", "COLLABORATOR"];

/**
 * CI stage 1 of 2. Runs the pipeline and writes its outcome to
 * $VIBE_RESULT_DIR (`status`, plus `reason` or `change.patch`). It holds no
 * GitHub write credentials: this job runs model-written code, so pushing,
 * opening the PR and commenting happen in a separate job (see
 * .github/workflows/vibe-code.yml) that never executes any of it and
 * re-checks the patch itself (src/check-commit.ts). The API key is read from
 * a file that is deleted before any child process starts.
 */
async function main() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  const resultDir = process.env.VIBE_RESULT_DIR;
  const keyFile = process.env.ANTHROPIC_API_KEY_FILE;
  if (!eventPath || !resultDir || !keyFile) {
    throw new Error(
      "GITHUB_EVENT_PATH / VIBE_RESULT_DIR / ANTHROPIC_API_KEY_FILE not set — this entrypoint only runs inside GitHub Actions",
    );
  }
  const problems = isolationProblems();
  if (problems.length > 0) {
    throw new Error(`refusing to run model-written code next to the API key:\n- ${problems.join("\n- ")}`);
  }
  const apiKey = takeApiKeyFile(keyFile);
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
  const result = await runPipeline(new Anthropic({ apiKey }), repoRoot, config, trigger.task);

  if (result.status === "committed") {
    const patch = harnessGit(repoRoot, ["format-patch", "-1", "HEAD", "--stdout"]);
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
