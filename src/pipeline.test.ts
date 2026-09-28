import { execSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { loadRepoConfig } from "./config.js";
import { MAX_TOOL_TURNS } from "./implement.js";
import { runPipeline } from "./pipeline.js";
import { MAX_FEEDBACK_CHARS } from "./truncate.js";

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

  it("gives the reviewer the task, not just the diff", async () => {
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
    const parse = vi.fn().mockResolvedValue({ parsed_output: { findings: [] } });
    const client = { messages: { create, parse } } as unknown as Anthropic;

    await runPipeline(client, repoRoot, loadRepoConfig(repoRoot), "create hello.txt containing hi");

    expect(JSON.stringify(parse.mock.calls[0][0].messages)).toContain("create hello.txt containing hi");
  });

  /** implement() creates `path`, then stops; review is clean unless overridden. */
  function clientCreating(path: string, findings: unknown[] = []) {
    const create = vi.fn().mockImplementation(() =>
      Promise.resolve(
        create.mock.calls.length % 2 === 1
          ? {
              stop_reason: "tool_use",
              content: [
                {
                  type: "tool_use",
                  id: `tu_${create.mock.calls.length}`,
                  name: "str_replace_based_edit_tool",
                  input: { command: "create", path, file_text: "hi" },
                },
              ],
            }
          : { stop_reason: "end_turn", content: [{ type: "text", text: "done" }] },
      ),
    );
    const parse = vi.fn().mockResolvedValue({ parsed_output: { findings } });
    return { client: { messages: { create, parse } } as unknown as Anthropic, create, parse };
  }

  it("never sends a denylisted file's contents to the reviewer", async () => {
    writeFileSync(join(repoRoot, ".env"), "SECRET=super-secret-value");
    const { client, parse } = clientCreating("hello.txt");

    await runPipeline(client, repoRoot, loadRepoConfig(repoRoot), "create hello.txt");

    expect(JSON.stringify(parse.mock.calls[0][0].messages)).not.toContain("super-secret-value");
    expect(JSON.stringify(parse.mock.calls[0][0].messages)).toContain("hello.txt");
  });

  it("leaves the target repo's index untouched when it gives up", async () => {
    const blocking = [{ summary: "bad", file: "hello.txt", severity: "blocking" }];
    const { client } = clientCreating("hello.txt", blocking);

    const result = await runPipeline(client, repoRoot, loadRepoConfig(repoRoot), "create hello.txt");

    expect(result.status).toBe("gave_up");
    const status = execSync("git status --porcelain", { cwd: repoRoot }).toString();
    expect(status).toContain("?? hello.txt");
  });

  it("truncates huge verify output before feeding it back to the model", async () => {
    const config = { ...loadRepoConfig(repoRoot), testCommand: `node -e "process.stdout.write('x'.repeat(500000)); process.exit(1)"`, maxRetries: 0 };
    const { client, create } = clientCreating("hello.txt");

    await runPipeline(client, repoRoot, config, "create hello.txt");

    // The failure output is appended to `messages` after the last create() call.
    const history = create.mock.calls.at(-1)![0].messages as Anthropic.MessageParam[];
    const lastUserText = JSON.stringify(history.at(-1));
    expect(lastUserText.length).toBeLessThan(MAX_FEEDBACK_CHARS + 1000);
  });

  it("commits with a short subject line and the full task in the body", async () => {
    const task = "add a hello.txt file " + "with a very long explanation ".repeat(10);
    const { client } = clientCreating("hello.txt");

    await runPipeline(client, repoRoot, loadRepoConfig(repoRoot), task);

    const subject = execSync("git log -1 --format=%s", { cwd: repoRoot }).toString().trim();
    const body = execSync("git log -1 --format=%b", { cwd: repoRoot }).toString();
    expect(subject.length).toBeLessThanOrEqual(72);
    expect(subject.startsWith("add a hello.txt file")).toBe(true);
    expect(body).toContain(task.trim());
  });
});
