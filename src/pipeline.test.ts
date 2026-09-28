import { execSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { loadRepoConfig } from "./config.js";
import { MAX_TOOL_TURNS } from "./implement.js";
import { runPipeline } from "./pipeline.js";

let repoRoot: string;

beforeEach(() => {
  repoRoot = mkdtempSync(join(tmpdir(), "vibe-coding-pipeline-"));
  execSync("git init", { cwd: repoRoot });
  execSync("git config user.email test@example.com", { cwd: repoRoot });
  execSync("git config user.name test", { cwd: repoRoot });

  writeFileSync(
    join(repoRoot, "agent.config.json"),
    JSON.stringify({
      denylist: [".env*"],
      bashAllowlist: ["true"],
      lintCommand: "true",
      testCommand: "true",
      agentsFile: "AGENTS.md",
      maxRetries: 1,
    }),
  );
  writeFileSync(join(repoRoot, "AGENTS.md"), "Keep it simple.");
  execSync("git add -A && git commit -m init", { cwd: repoRoot });
});

afterEach(() => {
  rmSync(repoRoot, { recursive: true, force: true });
});

/** A fake Anthropic client: the implement call performs one text_editor
 * "create", then stops; the review call reports no findings. This exercises
 * the real pipeline (implement -> verify -> review -> commit) without a
 * network call or an API key. */
function fakeClient(): Anthropic {
  const create = vi.fn().mockResolvedValue({
    stop_reason: "end_turn",
    content: [{ type: "text", text: "done" }],
  });
  const parse = vi.fn().mockResolvedValue({ parsed_output: { findings: [] } });
  return { messages: { create, parse } } as unknown as Anthropic;
}

describe("runPipeline (mocked Claude client)", () => {
  it("commits when implement produces no tool calls, verify passes, and review is clean", async () => {
    const client = fakeClient();
    const config = loadRepoConfig(repoRoot);

    const result = await runPipeline(client, repoRoot, config, "no-op task");

    // No file was ever changed, so there is nothing to commit or review.
    expect(result).toEqual({ status: "no_changes" });
    expect(client.messages.create).toHaveBeenCalledTimes(1);
  });

  it("commits a real file created via the text_editor tool", async () => {
    const create = vi
      .fn()
      // Turn 1: Claude asks to create a file.
      .mockResolvedValueOnce({
        stop_reason: "tool_use",
        content: [
          {
            type: "tool_use",
            id: "tu_1",
            name: "str_replace_based_edit_tool",
            input: { command: "create", path: "hello.txt", file_text: "hi" },
          },
        ],
      })
      // Turn 2: Claude sees the tool result and stops.
      .mockResolvedValueOnce({
        stop_reason: "end_turn",
        content: [{ type: "text", text: "done" }],
      });
    const parse = vi.fn().mockResolvedValue({ parsed_output: { findings: [] } });
    const client = { messages: { create, parse } } as unknown as Anthropic;

    const config = loadRepoConfig(repoRoot);
    const result = await runPipeline(client, repoRoot, config, "create hello.txt");

    expect(result).toEqual({ status: "committed" });
    expect(existsSync(join(repoRoot, "hello.txt"))).toBe(true);
    expect(readFileSync(join(repoRoot, "hello.txt"), "utf-8")).toBe("hi");
    const log = execSync("git log --oneline", { cwd: repoRoot }).toString();
    expect(log).toContain("create hello.txt");
  });

  it("retries implement when review finds an issue, then gives up after maxRetries", async () => {
    // Each implement() call makes two create() calls: one that edits a file
    // (tool_use), then one where Claude sees the result and stops (end_turn).
    const create = vi.fn().mockImplementation(() => {
      const call = create.mock.calls.length;
      if (call % 2 === 0) {
        return Promise.resolve({ stop_reason: "end_turn", content: [{ type: "text", text: "done" }] });
      }
      return Promise.resolve({
        stop_reason: "tool_use",
        content: [
          {
            type: "tool_use",
            id: `tu_${call}`,
            name: "str_replace_based_edit_tool",
            input: { command: "create", path: "hello.txt", file_text: `attempt-${call}` },
          },
        ],
      });
    });
    // Every review call reports a blocking finding, so the pipeline must
    // never commit and must give up once maxRetries (1) is exceeded.
    const parse = vi
      .fn()
      .mockResolvedValue({ parsed_output: { findings: [{ summary: "bad", file: "hello.txt", severity: "blocking" }] } });
    const client = { messages: { create, parse } } as unknown as Anthropic;

    const config = loadRepoConfig(repoRoot);
    const result = await runPipeline(client, repoRoot, config, "create hello.txt");

    expect(result.status).toBe("gave_up");
    const log = execSync("git log --oneline", { cwd: repoRoot }).toString();
    expect(log).not.toContain("create hello.txt");
  });

  it("does not retry for minor-only review findings", async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce({
        stop_reason: "tool_use",
        content: [
          {
            type: "tool_use",
            id: "tu_1",
            name: "str_replace_based_edit_tool",
            input: { command: "create", path: "hello.txt", file_text: "hi" },
          },
        ],
      })
      .mockResolvedValueOnce({ stop_reason: "end_turn", content: [{ type: "text", text: "done" }] });
    const parse = vi
      .fn()
      .mockResolvedValue({ parsed_output: { findings: [{ summary: "nit", file: "hello.txt", severity: "minor" }] } });
    const client = { messages: { create, parse } } as unknown as Anthropic;

    const result = await runPipeline(client, repoRoot, loadRepoConfig(repoRoot), "create hello.txt");

    expect(result).toEqual({ status: "committed" });
    expect(parse).toHaveBeenCalledTimes(1);
  });

  it("gives up instead of looping forever when the model never stops calling tools", async () => {
    const create = vi.fn().mockImplementation(() =>
      Promise.resolve({
        stop_reason: "tool_use",
        content: [{ type: "tool_use", id: `tu_${create.mock.calls.length}`, name: "bash", input: { command: "true" } }],
      }),
    );
    const parse = vi.fn();
    const client = { messages: { create, parse } } as unknown as Anthropic;

    const result = await runPipeline(client, repoRoot, loadRepoConfig(repoRoot), "loop forever");

    expect(result.status).toBe("gave_up");
    expect(create.mock.calls.length).toBeLessThanOrEqual(MAX_TOOL_TURNS);
    expect(parse).not.toHaveBeenCalled();
  });
});
