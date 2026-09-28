/** Cap on any single piece of process output fed back to the model (tool results, lint/test failures). */
export const MAX_FEEDBACK_CHARS = 20_000;

/**
 * Keeps the head and tail of an oversized output — the command line and first
 * errors are usually at the top, the test summary at the bottom — so one noisy
 * command cannot blow the context window.
 */
export function truncateMiddle(text: string, max = MAX_FEEDBACK_CHARS): string {
  if (text.length <= max) return text;
  const half = Math.floor(max / 2);
  const omitted = text.length - 2 * half;
  return `${text.slice(0, half)}\n\n[... ${omitted} characters omitted ...]\n\n${text.slice(-half)}`;
}
