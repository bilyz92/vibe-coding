#!/usr/bin/env node
import Anthropic from "@anthropic-ai/sdk";
import { loadRepoConfig } from "./config.js";
import { runPipeline } from "./pipeline.js";

function parseArgs(argv: string[]): { repo: string; task: string } {
  const repoIndex = argv.indexOf("--repo");
  const taskIndex = argv.indexOf("--task");
  if (repoIndex === -1 || taskIndex === -1) {
    throw new Error('usage: vibe-coding --repo <path> --task "<description>"');
  }
  return { repo: argv[repoIndex + 1], task: argv[taskIndex + 1] };
}

async function main() {
  const { repo, task } = parseArgs(process.argv.slice(2));
  const config = loadRepoConfig(repo);
  const client = new Anthropic();

  const result = await runPipeline(client, repo, config, task);

  switch (result.status) {
    case "committed":
      console.log("done: committed.");
      break;
    case "no_changes":
      console.log("done: no changes were needed.");
      break;
    case "gave_up":
      console.error(`gave up: ${result.reason}`);
      process.exitCode = 1;
      break;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
