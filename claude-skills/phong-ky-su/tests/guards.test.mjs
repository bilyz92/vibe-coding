// node --test ~/.claude/skills/phong-ky-su/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { recordReturn, parallelGroups, mainStatus, mergeCommit, revertPlan } from '../scripts/guards.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'phong-guards-'));
/** A fake `gh` on PATH that prints `out` (and exits `code`). */
function fakeGh(out, code = 0) {
  const dir = tmp(); fs.writeFileSync(path.join(dir, 'gh'), `#!/bin/sh\ncat <<'EOF'\n${out}\nEOF\nexit ${code}\n`, { mode: 0o755 });
  return { ...process.env, PATH: `${dir}:${process.env.PATH}` };
}

test('the fourth return from the Tester means stuck', () => {
  const dir = tmp();
  for (let i = 1; i <= 3; i++) assert.deepEqual(recordReturn(dir, 'loop-hook'), { count: i, stuck: false });
  assert.deepEqual(recordReturn(dir, 'loop-hook'), { count: 4, stuck: true });
  assert.deepEqual(recordReturn(dir, 'other-task'), { count: 1, stuck: false });   // (counted per task)
});

test('tasks that share a file never run side by side', () => {
  assert.deepEqual(parallelGroups([{ id: 'a', files: ['x'] }, { id: 'b', files: ['y'] }, { id: 'c', files: ['x', 'z'] }]), [['a', 'b'], ['c']]);
  assert.deepEqual(parallelGroups([{ id: 'a', files: ['x'] }, { id: 'n', files: [] }, { id: 'b', files: ['y'] }]), [['a', 'b'], ['n']]);
  assert.deepEqual(parallelGroups([]), []);
});

test("main status judges the checks of that very merge commit", async () => {
  const checks = (...xs) => JSON.stringify({ check_runs: xs.map(([conclusion, status, name]) => ({ conclusion, status, name })) });
  assert.deepEqual(await mainStatus('o/r', 'abc1234', { env: fakeGh(checks(['success', 'completed', 'CI'], ['success', 'completed', 'Pages'])) }), { state: 'green', sha: 'abc1234', failed: [] });
  const red = await mainStatus('o/r', 'abc1234', { env: fakeGh(checks(['success', 'completed', 'Pages'], ['failure', 'completed', 'CI'])) });
  assert.equal(red.state, 'red'); assert.deepEqual(red.failed, ['CI']);
  assert.equal((await mainStatus('o/r', 'abc1234', { env: fakeGh(checks(['timed_out', 'completed', 'CI'])) })).state, 'red');
  assert.equal((await mainStatus('o/r', 'abc1234', { env: fakeGh(checks(['success', 'completed', 'CI'], [null, 'in_progress', 'E2E'])) })).state, 'pending');
  assert.equal((await mainStatus('o/r', 'abc1234', { env: fakeGh(checks(['failure', 'completed', 'CI'], [null, 'in_progress', 'E2E'])) })).state, 'red');   // (a failure is final)
  assert.equal((await mainStatus('o/r', 'abc1234', { env: fakeGh(checks(['skipped', 'completed', 'X'], ['success', 'completed', 'Y'])) })).state, 'green');   // (skipped is not red)
  assert.equal((await mainStatus('o/r', 'abc1234', { env: fakeGh('{"check_runs":[]}') })).state, 'pending');   // (CI not started on it yet)
  assert.equal((await mainStatus('o/r', 'abc1234', { env: fakeGh('boom', 1) })).state, 'unknown');
  await assert.rejects(() => mainStatus('o/r', 'not a sha; x'));
});

test("the merge commit is read from our own PR, not from whatever ran last", async () => {
  assert.deepEqual(await mergeCommit('o/r', 42, { env: fakeGh('{"state":"MERGED","mergeCommit":{"oid":"def5678abc"}}') }), { state: 'MERGED', sha: 'def5678abc' });
  assert.deepEqual(await mergeCommit('o/r', 42, { env: fakeGh('{"state":"OPEN","mergeCommit":null}') }), { state: 'OPEN', sha: null });
  assert.deepEqual(await mergeCommit('o/r', 42, { env: fakeGh('x', 1) }), { state: 'unknown', sha: null });
});

test('a revert goes through its own branch and PR, never a push to main', () => {
  const cmds = revertPlan('abc1234def', 42);
  assert.ok(cmds.some((c) => c.includes('git revert') && c.includes('abc1234def')));
  assert.ok(cmds.some((c) => c.includes('revert/abc1234')));
  assert.ok(cmds.some((c) => c.startsWith('gh pr create') && c.includes('Revert: main đỏ sau abc1234')));
  assert.ok(!cmds.some((c) => /\bpush\b/.test(c) && /(\s|:)main\b/.test(c)));
  assert.throws(() => revertPlan('not a sha; rm -rf /'));
});

test('in a git repo the count lives inside .git: nothing shows in git status', async () => {
  const { execFileSync } = await import('node:child_process');
  const dir = tmp(); execFileSync('git', ['init', '-q'], { cwd: dir });
  recordReturn(dir, 't');
  assert.equal(execFileSync('git', ['status', '--porcelain'], { cwd: dir, encoding: 'utf8' }), '');
  assert.ok(fs.existsSync(path.join(dir, '.git', 'phong-ky-su', 'returns.json')));
});

test('the count is shared by every worktree of the repo, so stuck still triggers', async () => {
  const { execFileSync } = await import('node:child_process');
  const dir = tmp(), g = (...a) => execFileSync('git', a, { cwd: dir, encoding: 'utf8' });
  g('init', '-q'); g('config', 'user.email', 't@t'); g('config', 'user.name', 't');
  fs.writeFileSync(path.join(dir, 'f'), 'x'); g('add', '-A'); g('commit', '-qm', 'i');
  const wt = path.join(tmp(), 'wt'); g('worktree', 'add', '-q', wt);
  recordReturn(dir, 'task'); recordReturn(wt, 'task'); recordReturn(wt, 'task');
  assert.deepEqual(recordReturn(dir, 'task'), { count: 4, stuck: true });
});

test('main is green only when every required check of that commit passed: an unrelated green run is not enough', async () => {
  const checks = (...xs) => JSON.stringify({ check_runs: xs.map(([name, status, conclusion]) => ({ name, status, conclusion })) });
  const ok = (env, required) => mainStatus('o/r', 'abc1234', { env, required });
  assert.equal((await ok(fakeGh(checks(['Pages', 'completed', 'success'])), ['CI'])).state, 'pending');   // (required CI not created yet)
  assert.equal((await ok(fakeGh(checks(['Pages', 'completed', 'success'], ['CI', 'in_progress', null])), ['CI'])).state, 'pending');
  assert.equal((await ok(fakeGh(checks(['Pages', 'completed', 'success'], ['CI', 'completed', 'success'])), ['CI'])).state, 'green');
  assert.equal((await ok(fakeGh(checks(['CI', 'completed', 'cancelled'])), ['CI'])).state, 'unknown');   // (cancelled: someone must look)
  assert.equal((await ok(fakeGh(checks(['Pages', 'completed', 'failure'], ['CI', 'completed', 'success'])), ['CI'])).state, 'red');   // (any real failure)
  assert.equal((await ok(fakeGh(checks(['CI', 'completed', 'success'], ['X', 'completed', 'cancelled'])), [])).state, 'unknown');   // (no list: everything must pass)
});

test('Tester returns counted side by side lose none', async () => {
  const dir = tmp(), { execFile } = await import('node:child_process'), { promisify } = await import('node:util');
  const CLI = path.resolve(import.meta.dirname, '../scripts/guards.mjs');
  await Promise.all(Array.from({ length: 12 }, () => promisify(execFile)('node', [CLI, 'return', dir, 't1'])));
  assert.deepEqual(recordReturn(dir, 't1'), { count: 13, stuck: true });
});

test('the CLI takes one --required per check, so a name with a comma stays whole', async () => {
  const env = fakeGh(JSON.stringify({ check_runs: [{ name: 'CI (Node 20, ubuntu)', status: 'completed', conclusion: 'success' }, { name: 'Lint', status: 'completed', conclusion: 'success' }] }));
  const { execFile } = await import('node:child_process'), { promisify } = await import('node:util');
  const CLI = path.resolve(import.meta.dirname, '../scripts/guards.mjs');
  const { stdout } = await promisify(execFile)('node', [CLI, 'main', 'o/r', 'abc1234', '--required', 'CI (Node 20, ubuntu)', '--required', 'Lint'], { env });
  assert.equal(JSON.parse(stdout).state, 'green');
});

/** A fake `glab` on PATH that prints `out` (and exits `code`). */
function fakeGlab(out, code = 0) {
  const dir = tmp(); fs.writeFileSync(path.join(dir, 'glab'), `#!/bin/sh\ncat <<'EOF'\n${out}\nEOF\nexit ${code}\n`, { mode: 0o755 });
  return { ...process.env, PATH: `${dir}:${process.env.PATH}` };
}

test('main status on GitLab reads the newest pipeline of that commit', async () => {
  const p = (...xs) => JSON.stringify(xs.map(([id, status]) => ({ id, status })));
  const at = (out, code) => mainStatus('heytek/my-company', 'abc1234', { platform: 'gitlab', env: fakeGlab(out, code) });
  assert.deepEqual(await at(p([9, 'success'], [8, 'failed'])), { state: 'green', sha: 'abc1234', failed: [] });
  assert.deepEqual(await at(p([9, 'failed'])), { state: 'red', sha: 'abc1234', failed: ['pipeline #9'] });
  for (const st of ['running', 'pending', 'created', 'manual']) assert.equal((await at(p([9, st]))).state, 'pending', st);
  assert.equal((await at('[]')).state, 'pending');
  assert.equal((await at(p([9, 'canceled']))).state, 'unknown');
  assert.equal((await at('boom', 1)).state, 'unknown');
});

test('merge commit of a GitLab MR', async () => {
  const at = (out) => mergeCommit('heytek/my-company', 3, { platform: 'gitlab', env: fakeGlab(out) });
  assert.deepEqual(await at('{"state":"merged","merge_commit_sha":"abc1234"}'), { state: 'MERGED', sha: 'abc1234' });
  assert.deepEqual(await at('{"state":"opened","merge_commit_sha":null}'), { state: 'OPEN', sha: null });
});

test('the revert plan targets the real default branch, through an MR on GitLab', () => {
  const gl = revertPlan('abc1234def', 5, { platform: 'gitlab', defaultBranch: 'master' });
  assert.ok(gl.includes('git fetch origin master'));
  assert.ok(gl.some((c) => c.startsWith('git switch -c revert/abc1234 origin/master')));
  assert.ok(gl.some((c) => c.startsWith('glab mr create') && c.includes('--target-branch master')));
  assert.ok(!gl.some((c) => /push origin (main|master)\b/.test(c)));
  const gh = revertPlan('abc1234def', 5, { defaultBranch: 'develop' });
  assert.ok(gh.some((c) => c.startsWith('gh pr create --base develop')));
});
