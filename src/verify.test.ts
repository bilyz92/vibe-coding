import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { RepoConfig } from "./config.js";
import { verify } from "./verify.js";

const leakCheck = `node -e "process.exit(process.env.GH_TOKEN || process.env.ANTHROPIC_API_KEY ? 1 : 0)"`;
const config: RepoConfig = {
  denylist: [],
  bashAllowlist: [],
  lintCommand: leakCheck,
  testCommand: leakCheck,
  agentsFile: "AGENTS.md",
  maxRetries: 3,
};

beforeEach(() => {
  process.env.GH_TOKEN = "gh-secret";
  process.env.ANTHROPIC_API_KEY = "sk-secret";
});

afterEach(() => {
  delete process.env.GH_TOKEN;
  delete process.env.ANTHROPIC_API_KEY;
});

describe("verify", () => {
  it("runs lint and test without the harness's credentials in their environment", () => {
    expect(verify(process.cwd(), config).passed).toBe(true);
  });
});
