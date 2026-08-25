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

## Development

```bash
npm test    # vitest
npm run build  # tsc typecheck + emit
```

The path/bash guard (`src/guard.ts`) is the security-critical piece — see `src/guard.test.ts` for
the traversal/injection cases it covers.
