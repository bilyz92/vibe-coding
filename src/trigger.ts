const PREFIX = "/vibe-code";

export type GitHubIssueCommentEvent = {
  comment?: { body?: string; author_association?: string };
  issue?: { number?: number };
};

export type Trigger = { task: string; issueNumber: number };

/**
 * Extracts a task from a `/vibe-code <task>` issue comment, but only from a
 * commenter with an allowed GitHub author_association. This is the actual
 * security boundary — the workflow-level `if:` filter is just a cheap
 * pre-check, not something a public commenter can be trusted to satisfy.
 */
export function parseTrigger(
  event: GitHubIssueCommentEvent,
  allowedAssociations: string[],
): Trigger | null {
  const body = event.comment?.body?.trim() ?? "";
  if (!body.startsWith(PREFIX)) return null;

  const association = event.comment?.author_association ?? "NONE";
  if (!allowedAssociations.includes(association)) return null;

  const task = body.slice(PREFIX.length).trim();
  if (!task) return null;

  const issueNumber = event.issue?.number;
  if (typeof issueNumber !== "number") return null;

  return { task, issueNumber };
}
