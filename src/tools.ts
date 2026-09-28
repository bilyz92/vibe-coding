import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { checkBashArgs, checkBashCommand, checkPath } from "./guard.js";
import type { RepoConfig } from "./config.js";

export type ToolResult = { output: string; isError: boolean };

/** Executes a bash tool_use command after the guard rejects anything unsafe. */
export function runBash(repoRoot: string, config: RepoConfig, command: string): ToolResult {
  const guard = checkBashCommand(command, config.bashAllowlist);
  if (!guard.ok) {
    return { output: `blocked: ${guard.reason}`, isError: true };
  }

  const [executable, ...args] = command.trim().split(/\s+/);
  const argsGuard = checkBashArgs(repoRoot, config.denylist, args);
  if (!argsGuard.ok) {
    return { output: `blocked: ${argsGuard.reason}`, isError: true };
  }
  const result = spawnSync(executable, args, { cwd: repoRoot, encoding: "utf-8", shell: false });

  if (result.error) {
    return { output: `exec failed: ${result.error.message}`, isError: true };
  }
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  return { output, isError: result.status !== 0 };
}

type TextEditorInput =
  | { command: "view"; path: string }
  | { command: "create"; path: string; file_text: string }
  | { command: "str_replace"; path: string; old_str: string; new_str: string }
  | { command: "insert"; path: string; insert_line: number; insert_text: string };

/** Executes a text_editor tool_use command after the guard rejects anything outside the repo/denylist. */
export function runTextEditor(repoRoot: string, config: RepoConfig, input: TextEditorInput): ToolResult {
  const guard = checkPath(repoRoot, config.denylist, input.path);
  if (!guard.ok) {
    return { output: `blocked: ${guard.reason}`, isError: true };
  }
  const resolved = guard.resolved;

  switch (input.command) {
    case "view": {
      if (!existsSync(resolved)) {
        return { output: `no such file: ${input.path}`, isError: true };
      }
      return { output: readFileSync(resolved, "utf-8"), isError: false };
    }
    case "create": {
      mkdirSync(dirname(resolved), { recursive: true });
      writeFileSync(resolved, input.file_text, "utf-8");
      return { output: `created ${input.path}`, isError: false };
    }
    case "str_replace": {
      if (!existsSync(resolved)) {
        return { output: `no such file: ${input.path}`, isError: true };
      }
      const content = readFileSync(resolved, "utf-8");
      const occurrences = content.split(input.old_str).length - 1;
      if (occurrences !== 1) {
        return {
          output: `expected exactly 1 match for old_str, found ${occurrences}`,
          isError: true,
        };
      }
      writeFileSync(resolved, content.replace(input.old_str, input.new_str), "utf-8");
      return { output: `updated ${input.path}`, isError: false };
    }
    case "insert": {
      if (!existsSync(resolved)) {
        return { output: `no such file: ${input.path}`, isError: true };
      }
      const lines = readFileSync(resolved, "utf-8").split("\n");
      lines.splice(input.insert_line, 0, input.insert_text);
      writeFileSync(resolved, lines.join("\n"), "utf-8");
      return { output: `inserted into ${input.path}`, isError: false };
    }
  }
}
