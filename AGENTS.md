# Conventions for this repo

- TypeScript, ESM (`"type": "module"`), Node built-ins imported as `node:*`.
- No lint tool configured yet — `npm run build` (tsc --noEmit-equivalent via emit + strict) is the
  correctness gate.
- Every new module under `src/` that contains non-trivial logic gets a co-located `*.test.ts` using
  vitest. Pure logic (guards, config parsing, trigger parsing) must be unit tested; thin
  process-shelling wrappers (`pr.ts`) do not need to be.
- Do not weaken `src/guard.ts` without adding a test that proves the new behavior is still safe —
  it is the only thing standing between a model-issued command and the filesystem/shell.
