// node --test ~/.claude/skills/phong-ky-su/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeStageReport, addLesson } from '../scripts/progress.mjs';

const CLI = path.resolve(import.meta.dirname, '../scripts/progress.mjs');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'phong-progress-'));
const read = (dir) => fs.readFileSync(path.join(dir, 'PROGRESS.md'), 'utf8');

test('report replaces only its own section', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'PROGRESS.md'), '# Tiến độ\n\n## Chờ Codex review\n\n- [ ] CR-20261101-000000-abc · codex-impl-review · working-tree · nhánh x · t · quota\n');
  writeStageReport(dir, { task: 'cũ', done: ['a'], doing: [], waitingUser: [], waitingPartner: [] });
  writeStageReport(dir, { task: 'loop-hook', done: ['viết test'], doing: ['sửa hook'], waitingUser: ['bấm merge'], waitingPartner: ['F68 trả lời'] });
  const t = read(dir);
  assert.equal((t.match(/^## Báo cáo chặng/gm) || []).length, 1);
  for (const h of ['### Xong', '### Đang làm', '### Chờ anh', '### Chờ đối tác']) assert.match(t, new RegExp(`^${h}$`, 'm'));
  assert.match(t, /loop-hook/); assert.match(t, /- sửa hook/); assert.match(t, /- F68 trả lời/);
  assert.doesNotMatch(t, /cũ/);
  assert.match(t, /- \[ \] CR-20261101-000000-abc/);   // (the owed review stays)
  assert.match(t, /^# Tiến độ/);
});

test('empty lists print "(không có)"', () => {
  const dir = tmp();
  writeStageReport(dir, { task: 't', done: [], doing: [], waitingUser: [], waitingPartner: [] });
  assert.equal((read(dir).match(/\(không có\)/g) || []).length, 4);
});

test('lesson is added once', () => {
  const dir = tmp();
  addLesson(dir, { task: 't', lesson: 'chạy test 5 lần trước khi báo ổn định', proposal: 'thêm vào agent tester' });
  addLesson(dir, { task: 't', lesson: 'chạy test 5 lần trước khi báo ổn định', proposal: 'thêm vào agent tester' });
  const t = read(dir);
  assert.equal((t.match(/^## Bài học$/gm) || []).length, 1);
  assert.equal((t.match(/chạy test 5 lần/g) || []).length, 1);
  assert.match(t, /thêm vào agent tester/);
});

test('concurrent writes lose nothing', async () => {
  const dir = tmp(), run = promisify(execFile);
  await Promise.all(Array.from({ length: 20 }, (_, i) => run('node', [CLI, 'lesson', dir, '--task', 't', '--lesson', `bài học số ${i}`])));
  const t = read(dir);
  for (let i = 0; i < 20; i++) assert.match(t, new RegExp(`bài học số ${i}(?!\\d)`));
});

test('the CLI writes a stage report', async () => {
  const dir = tmp();
  await promisify(execFile)('node', [CLI, 'report', dir, '--task', 'T', '--done', 'a', '--done', 'b', '--doing', 'c', '--wait-user', 'd', '--wait-partner', 'e']);
  const t = read(dir);
  assert.match(t, /- a\n- b/); assert.match(t, /### Đang làm\n\n- c/); assert.match(t, /### Chờ anh\n\n- d/); assert.match(t, /### Chờ đối tác\n\n- e/);
});

test('the CLI reads a report and a lesson from a JSON file, so quotes and $ in text are safe', async () => {
  const dir = tmp(), f = path.join(tmp(), 'in.json'), run = promisify(execFile);
  fs.writeFileSync(f, JSON.stringify({ task: 'T "q" $HOME', done: ['a `b`'], doing: [], waitingUser: ['bấm merge'], waitingPartner: [] }));
  await run('node', [CLI, 'report', dir, '--json', f]);
  fs.writeFileSync(f, JSON.stringify({ task: 't', lesson: "it's $(x)", proposal: 'p' }));
  await run('node', [CLI, 'lesson', dir, '--json', f]);
  const t = read(dir);
  assert.match(t, /Việc: T "q" \$HOME/); assert.match(t, /- a `b`/); assert.match(t, /### Chờ anh\n\n- bấm merge/);
  assert.match(t, /it's \$\(x\) → đề xuất: p/);
});

test('a lesson that merely begins another one is still added', () => {
  const dir = tmp();
  addLesson(dir, { task: 't', lesson: 'bài học số 10' });
  addLesson(dir, { task: 't', lesson: 'bài học số 1' });
  addLesson(dir, { task: 't', lesson: 'bài học số 1' });   // (the very same: once)
  const t = read(dir);
  assert.equal((t.match(/bài học số 1$/gm) || []).length, 1);
  assert.match(t, /bài học số 10$/m);
});
