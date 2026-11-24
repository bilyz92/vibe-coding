// node --test ~/.claude/skills/codex-review/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { editProgress } from '../scripts/progress-lock.mjs';

const RUNNER = path.resolve(import.meta.dirname, '../scripts/codex-runner.js');
const PROGRESS = path.resolve(import.meta.dirname, '../../phong-ky-su/scripts/progress.mjs');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'progress-lock-'));
const run = promisify(execFile);

test('a lock left by a dead process is broken, not waited on forever', () => {
  const dir = tmp(), lock = path.join(dir, '.progress.lock');
  fs.mkdirSync(lock); fs.writeFileSync(path.join(lock, 'owner'), JSON.stringify({ pid: 2147483646, at: Date.now() }));
  editProgress(dir, (t) => `${t}- ok\n`);
  assert.match(fs.readFileSync(path.join(dir, 'PROGRESS.md'), 'utf8'), /- ok/);
  assert.equal(fs.existsSync(lock), false);
});

test('a lock older than 30 s is broken even if its pid is alive', () => {
  const dir = tmp(), lock = path.join(dir, '.progress.lock');
  fs.mkdirSync(lock); fs.writeFileSync(path.join(lock, 'owner'), JSON.stringify({ pid: process.pid, at: Date.now() - 31_000 }));
  editProgress(dir, (t) => `${t}- ok\n`);
  assert.match(fs.readFileSync(path.join(dir, 'PROGRESS.md'), 'utf8'), /- ok/);
});

test('many writers finding the same dead lock break it once and lose nothing', async () => {
  const dir = tmp(), lock = path.join(dir, '.progress.lock');
  fs.mkdirSync(lock); fs.writeFileSync(path.join(lock, 'owner'), JSON.stringify({ pid: 2147483646, at: Date.now() - 5_000 }));
  await Promise.all(Array.from({ length: 12 }, (_, i) => run('node', [PROGRESS, 'lesson', dir, '--task', 't', '--lesson', `sau khoá chết ${i}`])));
  const t = fs.readFileSync(path.join(dir, 'PROGRESS.md'), 'utf8');
  for (let i = 0; i < 12; i++) assert.match(t, new RegExp(`sau khoá chết ${i}(?!\\d)`));
  assert.equal(fs.existsSync(lock) || fs.existsSync(`${lock}.breaker`), false);
});

test('owed reviews and the department\'s lessons written at the same time lose nothing', async () => {
  const dir = tmp(), jobs = [];
  for (let i = 0; i < 10; i++) {
    jobs.push(run('node', [RUNNER, 'pending', 'add', dir, '--skill', 'codex-impl-review', '--scope', 'w', '--branch', `b${i}`, '--reason', 'quota']));
    jobs.push(run('node', [PROGRESS, 'lesson', dir, '--task', 't', '--lesson', `bài học số ${i}`]));
  }
  await Promise.all(jobs);
  const t = fs.readFileSync(path.join(dir, 'PROGRESS.md'), 'utf8');
  for (let i = 0; i < 10; i++) { assert.match(t, new RegExp(`nhánh b${i} `)); assert.match(t, new RegExp(`bài học số ${i}(?!\\d)`)); }
});
