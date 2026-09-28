import Anthropic from "@anthropic-ai/sdk";
import type { RepoConfig } from "./config.js";
import { runBash, runTextEditor } from "./tools.js";

const MODEL = "claude-opus-5";

/** Upper bound on model turns per implement() call, so a model that never stops calling tools cannot burn tokens forever. */
export const MAX_TOOL_TURNS = 50;

export class ToolTurnLimitError extends Error {
  constructor() {
    super(`implement exceeded ${MAX_TOOL_TURNS} tool turns without finishing`);
  }
}

const TOOLS = [
  { type: "text_editor_20250728" as const, name: "str_replace_based_edit_tool" as const },
  { type: "bash_20250124" as const, name: "bash" as const },
];

/**
 * Stage 1 — implement. Bash and text_editor are Anthropic-defined,
 * client-executed tools with no `run()` function, so this uses the manual
 * agentic loop (documented pattern) rather than the Tool Runner, which is
 * built around user-defined runnable tools.
 */
export async function implement(
  client: Anthropic,
  repoRoot: string,
  config: RepoConfig,
  messages: Anthropic.MessageParam[],
): Promise<Anthropic.MessageParam[]> {
  const history = [...messages];

  for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      tools: TOOLS,
      messages: history,
    });

    history.push({ role: "assistant", content: response.content });

    if (response.stop_reason !== "tool_use") {
      return history;
    }

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;

      const input = block.input as Record<string, unknown>;
      const result =
        block.name === "bash"
          ? runBash(repoRoot, config, String(input.command ?? ""))
          : runTextEditor(repoRoot, config, input as Parameters<typeof runTextEditor>[2]);

      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: result.output,
        is_error: result.isError,
      });
    }

    history.push({ role: "user", content: toolResults });
  }

  throw new ToolTurnLimitError();
}
