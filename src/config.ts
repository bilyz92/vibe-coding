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
  return RepoConfigSchema.parse(raw);
}
