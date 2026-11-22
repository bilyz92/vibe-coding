import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as T from '../scripts/tickets.mjs';
import { improvementReport, markImproved, dueForImprovement } from '../scripts/improve.mjs';
import { addRepo } from '../scripts/departments.mjs';
import { addLesson } from '../../phong-ky-su/scripts/progress.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'cty-'));
/** A company whose register holds phong-ky-su and phong-video. */
function env() {
  const e = { COMPANY_DIR: tmp(), SKILLS_DIR: tmp() };
  const d = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../../phong-ky-su/department.json'), 'utf8'));
  for (const name of ['phong-ky-su', 'phong-video']) {
    fs.mkdirSync(path.join(e.SKILLS_DIR, name));
    fs.writeFileSync(path.join(e.SKILLS_DIR, name, 'department.json'), JSON.stringify({ ...d, name, skill: name }));
  }
  return e;
}
const OK = { goal: 'g', deliverables: ['d'], criteria: ['c'] };
function ticket(e, dept, steps = []) {
  const t = T.createTicket({ title: `việc ${dept}`, request: 'x' }, { env: e });
  T.setAnalysis(t.id, OK, { env: e }); T.setResult(t.id, { summary: 'kết quả', links: [] }, { env: e }); T.assign(t.id, dept, { env: e });
  for (const s of steps) T.setStatus(t.id, s, { by: 't', env: e });
  return t;
}

test('the same problem raised twice in a department is a candidate, with its tickets as evidence', () => {
  const e = env();
  const a = ticket(e, 'phong-ky-su'), b = ticket(e, 'phong-ky-su'), c = ticket(e, 'phong-video');
  T.escalate(a.id, { by: 'planner', problem: 'thiếu dữ liệu mẫu để Tester kiểm', need: 'trợ lý' }, { env: e });
  T.escalate(b.id, { by: 'planner', problem: 'Tester kiểm không được vì thiếu dữ liệu mẫu', need: 'trợ lý' }, { env: e });
  T.escalate(c.id, { by: 'video-lead', problem: 'thiếu nhạc nền', need: 'anh' }, { env: e });
  const r = improvementReport({ env: e });
  const rep = r.candidates.filter((x) => x.kind === 'van-de-lap-lai');
  assert.equal(rep.length, 1);
  assert.equal(rep[0].department, 'phong-ky-su');
  assert.deepEqual(rep[0].evidence.sort(), [a.id, b.id].sort());
});

test('results anh sent back are counted per department', () => {
  const e = env();
  const t = ticket(e, 'phong-video', ['đang làm', 'chờ anh nhận', 'đang làm', 'chờ anh nhận', 'đang làm']);
  const r = improvementReport({ env: e });
  const back = r.candidates.find((x) => x.kind === 'anh-tra-lai');
  assert.equal(back.department, 'phong-video');
  assert.match(back.text, /2 lần/);
  assert.deepEqual(back.evidence, [t.id]);
});

test('lessons that carry a proposal, in any company repo, are candidates', () => {
  const e = env(), repo = tmp();
  addLesson(repo, { task: 'T1', lesson: 'Tester chạy chậm vì build lại mỗi lần', proposal: 'cache build trong tester' });
  addLesson(repo, { task: 'T2', lesson: 'chỉ là ghi chú' });
  addRepo(repo, { env: e });
  const r = improvementReport({ env: e });
  const l = r.candidates.filter((x) => x.kind === 'bai-hoc');
  assert.equal(l.length, 1);
  assert.match(l[0].text, /cache build trong tester/);
  assert.match(r.markdown, /## Đề xuất cải tiến/);
});

test('due after 5 tickets done since the last loop, or 7 days', () => {
  const e = env(), now = new Date();
  assert.equal(dueForImprovement({ env: e, now }).due, false);
  for (let i = 0; i < 5; i++) ticket(e, 'tro-ly-giam-doc', ['đang làm', 'xong']);
  assert.equal(dueForImprovement({ env: e, now }).due, true);
  const ran = new Date();
  markImproved({ env: e, now: ran });
  assert.equal(dueForImprovement({ env: e, now: ran }).due, false);
  assert.equal(dueForImprovement({ env: e, now: new Date(+ran + 8 * 24 * 3600_000) }).due, true);
});

test('codex fix: with no loop yet, 7 days after the first ticket is due', () => {
  const e = env(), old = new Date(Date.now() - 8 * 24 * 3600_000);
  T.createTicket({ title: 'cũ', request: 'x' }, { env: e, now: old });
  assert.equal(dueForImprovement({ env: e }).due, true);
});
