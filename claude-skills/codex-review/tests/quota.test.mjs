// node --test ~/.claude/skills/codex-review/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { isQuotaError, retryAfterSeconds, addPending, listPending, markDone, probeQuota } from '../scripts/quota.mjs';

const RUNNER = path.resolve(import.meta.dirname, '../scripts/codex-runner.js');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'codex-quota-'));

test('tells a quota or credit error from any other failure', () => {
  for (const m of ['Your workspace is out of credits. Ask your workspace owner to refill in order to continue.',
    "You've hit your usage limit. Try again in 2h 5m.", 'Rate limit reached for requests', 'error 429 Too Many Requests', 'insufficient_quota'])
    assert.equal(isQuotaError(m), true, m);
  for (const m of ['Codex process exited unexpectedly', 'turn.completed but no thread_id', 'ENOENT: no such file', '', null])
    assert.equal(isQuotaError(m), false, String(m));
});

test('reads how long to wait when the message says so', () => {
  assert.equal(retryAfterSeconds('Try again in 2h 5m.'), 2 * 3600 + 5 * 60);
  assert.equal(retryAfterSeconds('try again in 2h5m'), 2 * 3600 + 5 * 60);
  assert.equal(retryAfterSeconds('Please try again in 35 minutes'), 35 * 60);
  assert.equal(retryAfterSeconds('retry in 40s'), 40);
  assert.equal(retryAfterSeconds('Your workspace is out of credits.'), null);
});

test('owed reviews go in PROGRESS.md under their own heading, and come off it when done', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'PROGRESS.md'), '# Tiến độ\n\n- [x] việc cũ\n');
  const a = addPending(dir, { skill: 'codex-impl-review', scope: 'working-tree', branch: 'fix/x', reason: 'out of credits', at: new Date('2026-11-01T04:30:00Z') });
  const b = addPending(dir, { skill: 'codex-pr-review', scope: 'branch', branch: 'feat/y', reason: 'usage limit', at: new Date('2026-11-01T04:31:00Z') });
  assert.notEqual(a, b);
  const text = fs.readFileSync(path.join(dir, 'PROGRESS.md'), 'utf8');
  assert.match(text, /^# Tiến độ/);   // (what was there stays)
  assert.match(text, /- \[x\] việc cũ/);
  assert.equal((text.match(/^## Chờ Codex review$/gm) || []).length, 1);
  let list = listPending(dir);
  assert.deepEqual(list.filter((x) => !x.done).map((x) => x.id), [a, b]);
  assert.equal(list[0].skill, 'codex-impl-review');
  assert.equal(list[0].branch, 'fix/x');
  assert.equal(markDone(dir, a), true);
  list = listPending(dir);
  assert.deepEqual(list.filter((x) => !x.done).map((x) => x.id), [b]);
  assert.equal(markDone(dir, 'CR-nope'), false);
});

test('a repo with no PROGRESS.md gets one', () => {
  const dir = tmp();
  addPending(dir, { skill: 'codex-impl-review', scope: 'working-tree', branch: 'main', reason: 'quota' });
  assert.match(fs.readFileSync(path.join(dir, 'PROGRESS.md'), 'utf8'), /## Chờ Codex review/);
});

test('probing says ok, quota or error from what the codex command answers', async () => {
  const dir = tmp(), fake = (body) => { const f = path.join(dir, `codex-${Math.random().toString(36).slice(2)}.sh`); fs.writeFileSync(f, `#!/bin/sh\n${body}\n`, { mode: 0o755 }); return { cmd: f, prependArgs: [] }; };
  assert.equal((await probeQuota({ command: fake('echo OK') })).status, 'ok');
  const q = await probeQuota({ command: fake('echo "ERROR: Your workspace is out of credits." >&2; exit 1') });
  assert.equal(q.status, 'quota');
  assert.equal((await probeQuota({ command: fake('echo "boom" >&2; exit 1') })).status, 'error');
});

test('the runner exposes it: pending add / list / done', () => {
  const dir = tmp();
  const added = JSON.parse(execFileSync('node', [RUNNER, 'pending', 'add', dir, '--skill', 'codex-impl-review', '--scope', 'working-tree', '--branch', 'fix/z', '--reason', 'out of credits'], { encoding: 'utf8' }));
  assert.match(added.id, /^CR-/);
  const listed = JSON.parse(execFileSync('node', [RUNNER, 'pending', 'list', dir], { encoding: 'utf8' }));
  assert.equal(listed.pending.length, 1);
  const done = JSON.parse(execFileSync('node', [RUNNER, 'pending', 'done', dir, added.id], { encoding: 'utf8' }));
  assert.equal(done.ok, true);
  assert.equal(JSON.parse(execFileSync('node', [RUNNER, 'pending', 'list', dir], { encoding: 'utf8' })).pending.length, 0);
});

test('the Codex account to use: what the office chose, if it still has a sign-in; CODEX_HOME set by hand wins', async () => {
  const { activeCodexHome } = await import('../scripts/quota.mjs');
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-now-')), acct = path.join(home, '.codex-b');
  assert.equal(activeCodexHome({ env: {}, homeDir: home }), null);   // (no office: Codex's default)
  fs.writeFileSync(path.join(home, '.codex-now'), acct + '\n');
  assert.equal(activeCodexHome({ env: {}, homeDir: home }), null);   // (no such sign-in)
  fs.mkdirSync(acct); fs.writeFileSync(path.join(acct, 'auth.json'), '{}');
  assert.equal(activeCodexHome({ env: {}, homeDir: home }), acct);
  assert.equal(activeCodexHome({ env: { CODEX_HOME: '/mine' }, homeDir: home }), null);
});

test("a limit Codex itself reports as reached is quota, even when a tiny request still goes through", async () => {
  const dir = tmp(), f = path.join(dir, 'codex-limits'), reset = Math.round(Date.now() / 1000) + 7200;
  fs.writeFileSync(f, `#!/usr/bin/env node
if (process.argv[2] !== 'app-server') { console.log('OK'); process.exit(0); }
let b = ''; process.stdin.on('data', (d) => { b += d; let i; while ((i = b.indexOf('\\n')) >= 0) { const m = JSON.parse(b.slice(0, i)); b = b.slice(i + 1);
  if (m.id === 1) console.log(JSON.stringify({ id: 1, result: {} }));
  if (m.id === 2) console.log(JSON.stringify({ id: 2, result: { rateLimits: { primary: { usedPercent: 3, resetsAt: ${reset - 3600} }, secondary: { usedPercent: 100, resetsAt: ${reset} } } } })); } });
`, { mode: 0o755 });
  const q = await probeQuota({ command: { cmd: f, prependArgs: [] } });
  assert.equal(q.status, 'quota');
  assert.ok(q.retry_after_seconds > 7000 && q.retry_after_seconds <= 7200, String(q.retry_after_seconds));
});

test("codex CR-i14: the home a session starts with is pinned, explicit or chosen; quota polls follow the selector but never override an explicit home; symlinks resolve", async () => {
  const { activeCodexHome, sessionCodexHome, quotaCodexHome } = await import('../scripts/quota.mjs');
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-now-')), acct = path.join(home, '.codex-b'), link = path.join(home, 'cur');
  fs.mkdirSync(acct); fs.writeFileSync(path.join(acct, 'auth.json'), '{}'); fs.symlinkSync(acct, link);
  fs.writeFileSync(path.join(home, '.codex-now'), link + '\n');
  assert.equal(activeCodexHome({ env: {}, homeDir: home }), fs.realpathSync(acct));   // (#4: the target, not the link)
  assert.equal(sessionCodexHome({ env: { CODEX_HOME: '/mine' }, homeDir: home }), '/mine');   // (#1: explicit is pinned too)
  assert.equal(sessionCodexHome({ env: {}, homeDir: home }), fs.realpathSync(acct));
  assert.equal(quotaCodexHome('/mine', { homeDir: home }), '/mine');   // (#2: explicit wins)
  assert.equal(quotaCodexHome(undefined, { homeDir: home }), fs.realpathSync(acct));
  fs.rmSync(path.join(home, '.codex-now'));
  assert.equal(quotaCodexHome(undefined, { homeDir: home }), null);   // (#3: selector gone -> Codex's default, the caller unsets)
});
