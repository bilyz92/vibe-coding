import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

const RepoConfigSchema = z.object({
  denylist: z.array(z.string()),
  bashAllowlist: z.array(z.string()),
  lintCommand: z.string(),
  testCommand: z.string(),
  agentsFile: z.string(),
  maxRetries: z.number().int().positive().default(3),
});

export type RepoConfig = z.infer<typeof RepoConfigSchema>;

/** Loads and validates `<repoRoot>/agent.config.json`. */
export function loadRepoConfig(repoRoot: string): RepoConfig {
  const path = join(repoRoot, "agent.config.json");
  if (!existsSync(path)) {
    throw new Error(`agent.config.json not found at ${path}`);
  }
  const raw = JSON.parse(readFileSync(path, "utf-8"));
  const config = RepoConfigSchema.parse(raw);
  // The guardrails, the agent's instructions and git internals (hooks, config)
  // are off-limits whatever the repo's config says — otherwise the model could
  // loosen them for the next run.
  return { ...config, denylist: [...config.denylist, "agent.config.json", config.agentsFile, ".git/**"] };
}
