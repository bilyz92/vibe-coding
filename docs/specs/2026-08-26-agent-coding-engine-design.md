# Agent Coding Engine — Design

Status: approved (chat brainstorming, 2026-08-26). Sub-project 1 of 2 (CLI local mode; CI/automation mode is a follow-up sub-project).

## Goal

A standalone TypeScript tool (not dependent on Claude Code) using the Claude API directly, that automates coding tasks across any of the user's repos (`data_platform`, `lakehouse-template`, `lakehouse-core`, ...) while enforcing guardrails that are not left to the model's judgment:

1. Never touch files in a repo-specific denylist (secrets, migrations, authz).
2. Never claim done without a passing lint+test run.
3. Never commit without passing an independent adversarial code review pass.
4. Follow each repo's own AGENTS.md/CLAUDE.md conventions.

## Architecture

Four-stage pipeline, orchestrated by plain code — not by the model:

```
[1] Implement  →  [2] Verify (harness-run)  →  [3] Review (2nd Claude call)  →  [4] Commit (harness-run)
      ↑________________retry on failure_______________________|
```

- **Implement**: Claude API Tool Runner (`client.beta.messages.toolRunner`) with two client-executed tools: `bash_20250124` and `text_editor_20250728`. System prompt includes the target repo's AGENTS.md/CLAUDE.md content. Model works until it stops calling tools (`stop_reason !== "tool_use"`).
- **Verify**: the harness runs the repo's configured lint+test commands directly (no model involvement). Failure output is fed back as a new user turn and stage 1 re-runs, up to `maxRetries`.
- **Review**: a fresh, tool-less `client.messages.parse()` call with a structured-output schema (`{findings: [...]}`), given the `git diff`. Non-empty findings go back to stage 1 as a fix request.
- **Commit**: the harness runs `git add <files that actually changed and are not denied>` + `git commit`. CLI mode stops here — no push.

## Guardrails enforced in the harness (not the prompt)

- **Path guard**: every `text_editor` file operation and every `bash` command argument is checked — the target path is resolved to its canonical absolute form and must (a) stay inside the repo root and (b) not match the repo's `denylist` globs (e.g. `prisma/migrations/**`, `.env*`, `lib/authz.ts`). Rejected operations return `is_error: true` with an explanit message so Claude can adapt.
- **Bash guard**: only an allowlisted set of executables (`git`, `npm`, `node`, `ls`, `cat`, `grep`, ...) may appear as the command's argv[0]; shell metacharacters (`&&`, `|`, `;`, `` ` ``, `$()`) are rejected outright to prevent bypassing the allowlist via chaining.
- Per-repo config (`agent.config.json`, one per target repo) declares: `denylist`, `bashAllowlist`, `lintCommand`, `testCommand`, `agentsFile` path. This is what makes one engine reusable across all repos without per-repo code.

## Testing

- Unit tests for the path guard and bash guard are the highest priority — covers path traversal (`../`), symlink escape, absolute paths outside root, URL-encoded traversal, and shell-metacharacter injection attempts.
- An integration test runs the pipeline against a throwaway git fixture repo with a trivial task, asserting: the denylisted file is untouched even when the task tries to ask for it, verify actually runs, and a commit is created only after a clean review.

## Out of scope (this sub-project)

- CI/automation trigger mode (webhook, auto-PR) — separate sub-project, reuses this same engine.
- The end-user natural-language data Q&A agent for `data_platform` — unrelated sub-project, not started yet.
