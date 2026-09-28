import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

const MODEL = "claude-opus-5";

const ReviewSchema = z.object({
  findings: z.array(
    z.object({
      summary: z.string(),
      file: z.string(),
      severity: z.enum(["blocking", "minor"]),
    }),
  ),
});

export type ReviewFinding = z.infer<typeof ReviewSchema>["findings"][number];

/**
 * Stage 3 — review. A fresh, tool-less call (no shared context with the
 * implement loop) acting as an adversarial reviewer over the raw diff.
 */
export async function review(client: Anthropic, task: string, diff: string): Promise<ReviewFinding[]> {
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 8000,
    system:
      "You are an adversarial code reviewer. You are given the task and the git diff meant to implement it. Find real defects only: " +
      "bugs, security issues, or violations of the stated task. Do not invent stylistic nitpicks. " +
      "If the diff is correct and complete, return an empty findings list.",
    messages: [{ role: "user", content: `Task:\n${task}\n\nDiff:\n${diff}` }],
    output_config: { format: zodOutputFormat(ReviewSchema) },
  });

  return response.parsed_output?.findings ?? [];
}
