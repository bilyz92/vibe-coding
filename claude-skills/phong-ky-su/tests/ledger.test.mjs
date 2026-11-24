// node --test ~/.claude/skills/phong-ky-su/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { startTask, recordMerge, addCodexRound, recordEscape, setLevel, readLedger, summarize, verdict } from '../scripts/ledger.mjs';

const CLI = path.resolve(import.meta.dirname, '../scripts/ledger.mjs');
const run = (...a) => promisify(execFile)('node', [CLI, ...a]);
/** A git repo in a temp dir removed when the test ends. */
function repo(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'phong-ledger-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  return dir;
}
const file = (dir) => path.join(dir, '.git', 'phong-ky-su', 'ledger.json');
const ISO = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/;

test('AC-8: start writes the entry inside git-common-dir; the project stays clean', (t) => {
  const dir = repo(t);
  const e = startTask(dir, { id: 'P-1', level: 'nhanh' });
  assert.match(e.startedAt, ISO);
  const saved = JSON.parse(fs.readFileSync(file(dir), 'utf8'));
  assert.deepEqual(saved, [{ id: 'P-1', level: 'nhanh', startedAt: e.startedAt, mergedAt: null, codexRounds: 0, escapes: 0 }]);
  assert.equal(execFileSync('git', ['status', '--porcelain'], { cwd: dir, encoding: 'utf8' }), '');
  assert.deepEqual(startTask(dir, { id: 'P-1', level: 'day-du' }), saved[0]);   // (started again: the first one stands)
  assert.throws(() => startTask(dir, { id: 'P-2', level: 'vua' }), /mức/);
  assert.throws(() => startTask(dir, { level: 'nhanh' }), /id/);
  assert.equal(readLedger(dir).length, 1);
});

test('AC-9: merge, Codex round, escape and level change the right field; an unknown id is an error, no ghost entry', (t) => {
  const dir = repo(t);
  const { startedAt } = startTask(dir, { id: 'P-1', level: 'nhanh' });
  recordMerge(dir, 'P-1', '2026-11-03T10:00:00.000Z');
  addCodexRound(dir, 'P-1'); addCodexRound(dir, 'P-1');
  recordEscape(dir, 'P-1', 'revert'); recordEscape(dir, 'P-1', 'fix-ticket');
  setLevel(dir, 'P-1', 'day-du');
  assert.deepEqual(readLedger(dir), [{ id: 'P-1', level: 'day-du', startedAt, mergedAt: '2026-11-03T10:00:00.000Z', codexRounds: 2, escapes: 2 }]);
  for (const bad of [() => recordMerge(dir, 'X'), () => addCodexRound(dir, 'X'), () => recordEscape(dir, 'X', 'revert'), () => setLevel(dir, 'X', 'day-du')])
    assert.throws(bad, /Không có việc X/);
  assert.throws(() => recordEscape(dir, 'P-1', 'oops'), /revert|fix-ticket/);
  assert.throws(() => recordMerge(dir, 'P-1', 'hôm qua'), /thời điểm/);
  assert.throws(() => setLevel(dir, 'P-1', 'vua'), /mức/);
  assert.equal(readLedger(dir).length, 1);
  assert.match(recordMerge(dir, 'P-1').mergedAt, ISO);   // (no time given: now)
});

test('AC-10: writes side by side lose nothing (lock + tmp + rename)', async (t) => {
  const dir = repo(t);
  await Promise.all(Array.from({ length: 5 }, (_, i) => run('start', dir, `P-${i}`, 'nhanh')));
  assert.deepEqual(readLedger(dir).map((e) => e.id).sort(), ['P-0', 'P-1', 'P-2', 'P-3', 'P-4']);
  await Promise.all(Array.from({ length: 20 }, () => run('round', dir, 'P-0')));
  assert.equal(readLedger(dir).find((e) => e.id === 'P-0').codexRounds, 20);
  assert.deepEqual(fs.readdirSync(path.dirname(file(dir))).filter((x) => x.startsWith('ledger')), ['ledger.json']);   // (no tmp or lock left)
});

test('AC-10: a writer waits while someone else holds the ledger lock', async (t) => {
  const dir = repo(t), lock = path.join(path.dirname(file(dir)), 'ledger.lock');
  startTask(dir, { id: 'P-1', level: 'nhanh' });
  fs.mkdirSync(lock); fs.writeFileSync(path.join(lock, 'owner'), JSON.stringify({ pid: process.pid, at: Date.now() }));   // (held by this live process)
  const pending = run('round', dir, 'P-1');
  await new Promise((r) => setTimeout(r, 1500));
  assert.equal(readLedger(dir)[0].codexRounds, 0, 'wrote without the lock');
  fs.rmSync(lock, { recursive: true, force: true });
  await pending;
  assert.equal(readLedger(dir)[0].codexRounds, 1);
});

const H = 3_600_000;
/** An entry that took `hours` (null: not merged). */
const entry = (id, level, hours, extra = {}) => ({ id, level, startedAt: new Date(0).toISOString(), mergedAt: hours == null ? null : new Date(hours * H).toISOString(), codexRounds: 1, escapes: 0, ...extra });

test('AC-11: summarize per level: count, median time to merge (merged only, odd and even), escapes, rounds', () => {
  const s = summarize([entry('a', 'day-du', 10), entry('b', 'day-du', 30), entry('c', 'day-du', 20, { escapes: 1 }),
    entry('d', 'nhanh', 4), entry('e', 'nhanh', 10), entry('f', 'nhanh', 6, { codexRounds: 3 }), entry('g', 'nhanh', 8), entry('h', 'nhanh', null, { escapes: 2 })]);
  assert.deepEqual(s, {
    'day-du': { count: 3, merged: 3, medianMs: 20 * H, escapes: 1, rounds: 3 },
    nhanh: { count: 5, merged: 4, medianMs: 7 * H, escapes: 2, rounds: 7 },
  });
  assert.deepEqual(summarize([]), { 'day-du': { count: 0, merged: 0, medianMs: null, escapes: 0, rounds: 0 }, nhanh: { count: 0, merged: 0, medianMs: null, escapes: 0, rounds: 0 } });
});

const sum = (dMedian, nMedian, { nEscapes = 0, nMerged = 6, dMerged = 6 } = {}) => ({
  'day-du': { count: dMerged, merged: dMerged, medianMs: dMerged ? dMedian : null, escapes: 0, rounds: 0 },
  nhanh: { count: nMerged, merged: nMerged, medianMs: nMerged ? nMedian : null, escapes: nEscapes, rounds: 0 },
});

test('AC-12: verdict by how much faster nhanh is, stopped by any escape; edges 40 / 39.9 / 20 / 19.9', () => {
  assert.equal(verdict(sum(1000, 600)).verdict, 'dat');
  assert.equal(verdict(sum(1000, 600)).reductionPct, 40);
  assert.equal(verdict(sum(1000, 601)).verdict, 'chua-ket-luan');
  assert.equal(verdict(sum(1000, 800)).verdict, 'chua-ket-luan');
  assert.equal(verdict(sum(1000, 801)).verdict, 'dung');
  assert.equal(verdict(sum(1000, 1200)).verdict, 'dung');   // (slower)
  assert.equal(verdict(sum(1000, 100, { nEscapes: 1 })).verdict, 'dung');   // (an escape stops it, however fast)
  for (const s of [sum(1000, 600, { nMerged: 0 }), sum(1000, 600, { dMerged: 0 })]) {
    const v = verdict(s);
    assert.equal(v.verdict, 'chua-ket-luan'); assert.equal(v.reductionPct, null); assert.ok(v.reason.length > 0);
  }
});

test('AC-13: fewer than 6 merged nhanh tasks -> warning that the conclusion is weak', () => {
  assert.ok(verdict(sum(1000, 600, { nMerged: 5 })).warnings.includes('chưa đủ 6 việc, kết luận yếu'));
  assert.deepEqual(verdict(sum(1000, 600, { nMerged: 6 })).warnings, []);
});

test('AC-14: CLI summary on an empty ledger is zeros and chua-ket-luan; the other commands work and fail clearly', async (t) => {
  const dir = repo(t);
  const empty = JSON.parse((await run('summary', dir)).stdout);
  assert.equal(empty['day-du'].count, 0); assert.equal(empty.nhanh.count, 0); assert.equal(empty.verdict, 'chua-ket-luan');
  assert.ok(empty.warnings.includes('chưa đủ 6 việc, kết luận yếu'));
  assert.equal(JSON.parse((await run('start', dir, 'P-1', 'nhanh')).stdout).id, 'P-1');
  await run('round', dir, 'P-1'); await run('escape', dir, 'P-1', 'fix-ticket'); await run('level', dir, 'P-1', 'day-du');
  await run('merge', dir, 'P-1', '2099-01-01T00:00:00.000Z');
  assert.deepEqual(readLedger(dir)[0], { ...readLedger(dir)[0], level: 'day-du', codexRounds: 1, escapes: 1, mergedAt: '2099-01-01T00:00:00.000Z' });
  const s = JSON.parse((await run('summary', dir)).stdout);
  assert.equal(s['day-du'].merged, 1); assert.equal(s.verdict, 'chua-ket-luan');
  await assert.rejects(run('round', dir, 'X'), (e) => e.code === 1 && /Không có việc X/.test(e.stderr));
  await assert.rejects(run('nope', dir), (e) => e.code === 1 && /Dùng/.test(e.stderr));
});

test('a broken ledger is an error, never overwritten with an empty one', (t) => {
  const dir = repo(t);
  startTask(dir, { id: 'P-1', level: 'nhanh' });
  fs.writeFileSync(file(dir), '[{"id":"P-1",');
  assert.throws(() => readLedger(dir), /hỏng/);
  assert.throws(() => startTask(dir, { id: 'P-2', level: 'nhanh' }), /hỏng/);
  assert.equal(fs.readFileSync(file(dir), 'utf8'), '[{"id":"P-1",');
});

test('ISSUE-3: the level only goes up: day-du -> nhanh is refused', (t) => {
  const dir = repo(t);
  startTask(dir, { id: 'P-1', level: 'day-du' });
  assert.throws(() => setLevel(dir, 'P-1', 'nhanh'), /hạ mức/);
  assert.equal(readLedger(dir)[0].level, 'day-du');
  startTask(dir, { id: 'P-2', level: 'nhanh' });
  assert.equal(setLevel(dir, 'P-2', 'nhanh').level, 'nhanh');
  assert.equal(setLevel(dir, 'P-2', 'day-du').level, 'day-du');
  assert.equal(setLevel(dir, 'P-2', 'day-du').level, 'day-du');
});

test('ISSUE-5: the verdict compares the unrounded reduction; rounding is for display only', () => {
  const v = verdict(sum(1e9, 6e8 + 1));   // (39.9999999%)
  assert.equal(v.verdict, 'chua-ket-luan'); assert.equal(v.reductionPct, 40);
  assert.equal(verdict(sum(1e9, 8e8 + 1)).verdict, 'dung');   // (19.9999999%)
  assert.equal(verdict(sum(1e9, 6e8)).verdict, 'dat');
});
