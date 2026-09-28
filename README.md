# vibe-coding

Coding agent engine (Claude API, TypeScript) with guardrails enforced by the harness, not left
to the model: path/bash allowlist, verify-before-commit (lint + test, auto-retry on failure), and
an independent adversarial review pass before every commit.

Design: [`docs/specs/2026-08-26-agent-coding-engine-design.md`](docs/specs/2026-08-26-agent-coding-engine-design.md).

Scope of this repo: **CLI local mode** — you run it by hand against a target repo; it edits code,
verifies, reviews, and commits, but never pushes. CI/automation mode is a separate follow-up.

## Setup (new machine)

This repo is the *code*. Two more things live outside it and are required alongside it:

1. **Skills** — this project follows the coding-agent conventions tracked in the personal skills
   repo, separate from this one:
   ```bash
   git clone git@gitlab.com:cole-vn/agent-coding.git ~/.claude/skills
   bash ~/.claude/skills/_bootstrap/install.sh
   ```
2. **Libraries** — plain `npm install` in this repo picks up everything from `package.json`
   (`@anthropic-ai/sdk`, `zod`, `typescript`, `tsx`, `vitest`). Nothing else to install.
3. **Credentials** — copy `.env.example` to `.env` and set `ANTHROPIC_API_KEY`, or run
   `ant auth login` once (see the Claude API skill's auth notes).

```bash
git clone git@github.com:bilyz92/vibe-coding.git
cd vibe-coding
npm install
cp .env.example .env   # then fill in ANTHROPIC_API_KEY
npm test
```

## Usage

Each target repo needs an `agent.config.json` at its root — copy `agent.config.example.json` and
adjust `denylist` / `bashAllowlist` / `lintCommand` / `testCommand` / `agentsFile` for that repo.

```bash
npm run cli -- --repo /path/to/target-repo --task "add a /health endpoint that returns 200"
```

The pipeline: implement (Claude, bash + text-editor tools) → verify (harness runs lint+test,
retries on failure) → review (a second, independent Claude call adversarially reviews the diff) →
commit (harness runs `git add`/`git commit`, refusing anything denylisted). It stops after
committing locally — pushing/PR creation is manual in this mode.

## CI / automation mode

Comment `/vibe-code <task>` on an issue in a repo with `.github/workflows/vibe-code.yml` installed
(this repo has it — that's the reference install) and, if you're OWNER/MEMBER/COLLABORATOR on that
repo, the workflow runs the same pipeline as the CLI, then pushes a branch and opens a PR back to
the issue. It is split into two jobs:

- `agent` runs the pipeline — and therefore model-written code — with read-only access and no
  GitHub token. The API key reaches the harness as a file that it deletes before spawning anything,
  and the harness refuses to start unless children cannot reach its memory or become root
  (`--disable-sigusr1`, `kernel.yama.ptrace_scope >= 1`, `no_new_privs` so passwordless `sudo`
  is dead, docker stopped; see `isolationProblems` in `src/env.ts`).
- `publish` holds the write token but runs no model-written code. The `agent` job's artifact is
  untrusted (model-written code ran there and could have rewritten it), so `publish` re-checks the
  applied patch against the *base commit's* denylist (`src/check-commit.ts`) before pushing.

Child processes also get credential-like env vars (`*TOKEN*`, `*SECRET*`, `*PASSWORD*`,
`*API_KEY*`) stripped, but that is hygiene, not isolation: **local CLI mode does not isolate
model-written code** — it runs as you, with your files, SSH agent and `gh`/git credentials in
reach. Only run it on tasks and repos you would run arbitrary code from.

Required repo secrets: `ANTHROPIC_API_KEY` (the default `GITHUB_TOKEN` covers `gh pr create` /
`gh issue comment`, and is only given to the `publish` job).

To install on another repo: copy `.github/workflows/vibe-code.yml` and that repo's own
`agent.config.json`, and add the `vibe-coding` package (or vendor `src/`) so `npm run ci` resolves.

## Development

```bash
npm test    # vitest
npm run build  # tsc typecheck + emit
```

The path/bash guard (`src/guard.ts`) is the security-critical piece — see `src/guard.test.ts` for
the traversal/injection cases it covers.
