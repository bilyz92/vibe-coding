// node --test ~/.claude/skills/tro-ly-giam-doc/tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import * as T from '../scripts/tickets.mjs';
import { listRepos } from '../scripts/departments.mjs';
import { startTask } from '../../phong-ky-su/scripts/ledger.mjs';
import { addLesson } from '../../phong-ky-su/scripts/progress.mjs';

const MOD = pathToFileURL(path.resolve(import.meta.dirname, '../scripts/tickets.mjs')).href;
const envOf = () => ({ COMPANY_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'cty-')) });
const H = 3600_000;
const OK = { goal: 'g', deliverables: ['d'], criteria: ['c'] };
/** A ticket already analysed, with nothing for anh to confirm (most tests are about what comes after). */
const mk = (o, opts) => {
  const t = T.createTicket({ department: 'tro-ly-giam-doc', ...o }, opts);
  T.setAnalysis(t.id, OK, { env: opts.env, now: opts.now });
  T.setResult(t.id, { summary: 'kết quả', links: [] }, { env: opts.env, now: opts.now });
  return t;
};

test('create then get returns status "mới" and a P- id', () => {
  const env = envOf();
  const t = T.createTicket({ title: 'Sửa lỗi', request: 'sửa lỗi X' }, { env });
  assert.match(t.id, /^P-\d{8}-\d{6}-[a-z]{3}$/);
  const g = T.getTicket(t.id, { env });
  assert.equal(g.status, 'mới');
  assert.equal(g.title, 'Sửa lỗi');
  assert.deepEqual(g.after, []);
  assert.equal(g.result, null);
});

test('allowed transitions pass, others throw', () => {
  const env = envOf();
  const { id } = mk({ title: 'a', request: 'a' }, { env });
  for (const to of ['đã giao', 'đang làm', 'chờ anh', 'đang làm', 'xong']) T.setStatus(id, to, { by: 't', env });
  assert.equal(T.getTicket(id, { env }).status, 'xong');
  assert.throws(() => T.setStatus(id, 'đang làm', { by: 't', env }), /Không chuyển được/);
  const b = mk({ title: 'b', request: 'b' }, { env });
  assert.throws(() => T.setStatus(b.id, 'xong', { by: 't', env }), /Không chuyển được/);
  T.setStatus(b.id, 'huỷ', { by: 't', env });
  assert.throws(() => T.setStatus(b.id, 'đang làm', { by: 't', env }), /Không chuyển được/);
  assert.throws(() => T.setStatus(b.id, 'lạ', { by: 't', env }), /Không chuyển được/);
});

test('history records every transition with from/to/by', () => {
  const env = envOf();
  const { id } = mk({ title: 'a', request: 'a' }, { env });
  T.setStatus(id, 'đã giao', { by: 'trợ lý', env });
  T.setStatus(id, 'đang làm', { by: 'phong-ky-su', note: 'bắt đầu', env });
  const t = T.getTicket(id, { env });
  assert.deepEqual(t.history.map(({ from, to, by }) => ({ from, to, by })),
    [{ from: 'mới', to: 'đã giao', by: 'trợ lý' }, { from: 'đã giao', to: 'đang làm', by: 'phong-ky-su' }]);
  assert.equal(t.notes.at(-1).text, 'bắt đầu');
});

test('assign sets the department and moves the ticket to "đã giao"', () => {
  const env = envOf();
  const { id } = mk({ title: 'a', request: 'a' }, { env });
  T.setAnalysis(id, { goal: 'g', deliverables: ['d'], criteria: ['c'] }, { env });
  const t = T.assign(id, 'phong-ky-su', { env });
  assert.equal(t.department, 'phong-ky-su');
  assert.equal(t.status, 'đã giao');
});

test('canStart waits for "after" tickets: false until xong, false (waitingOn) if huỷ', () => {
  const env = envOf();
  const a = mk({ title: 'a', request: 'a' }, { env });
  const b = mk({ title: 'b', request: 'b', parent: a.id, after: [a.id] }, { env });
  assert.deepEqual(T.canStart(b.id, { env }), { ok: false, waitingOn: [a.id] });
  for (const to of ['đã giao', 'đang làm', 'xong']) T.setStatus(a.id, to, { by: 't', env });
  assert.deepEqual(T.canStart(b.id, { env }), { ok: true, waitingOn: [] });
  const c = mk({ title: 'c', request: 'c' }, { env });
  const d = mk({ title: 'd', request: 'd', after: [c.id] }, { env });
  T.setStatus(c.id, 'huỷ', { by: 't', env });
  assert.deepEqual(T.canStart(d.id, { env }), { ok: false, waitingOn: [c.id] });
});

test('setResult and addNote are kept', () => {
  const env = envOf();
  const { id } = T.createTicket({ title: 'a', request: 'a' }, { env });
  T.setResult(id, { summary: 'xong PR', links: ['https://x/pr/1'] }, { env });
  T.addNote(id, { by: 'thu-ky', text: 'ghi chú' }, { env });
  const t = T.getTicket(id, { env });
  assert.deepEqual(t.result, { summary: 'xong PR', links: ['https://x/pr/1'] });
  assert.equal(t.notes.at(-1).by, 'thu-ky');
});

test('listTickets skips an invalid JSON file and warns, and filters by status', () => {
  const env = envOf();
  const a = mk({ title: 'a', request: 'a' }, { env });
  mk({ title: 'b', request: 'b' }, { env });
  T.setStatus(a.id, 'đã giao', { by: 't', env });
  fs.writeFileSync(path.join(env.COMPANY_DIR, 'tickets', 'P-20260101-000000-bad.json'), '{"id": ');
  const all = T.listTickets({ env });
  assert.equal(all.tickets.length, 2);
  assert.equal(all.warnings.length, 1);
  assert.match(all.warnings[0], /P-20260101-000000-bad/);
  assert.deepEqual(T.listTickets({ env, status: 'đã giao' }).tickets.map((t) => t.id), [a.id]);
});

test('ids with path characters are refused', () => {
  const env = envOf();
  assert.throws(() => T.getTicket('../x', { env }), /Mã không hợp lệ/);
  assert.throws(() => T.setStatus('a/b', 'xong', { by: 't', env }), /Mã không hợp lệ/);
  assert.throws(() => T.createTicket({ title: 'x', request: 'x', after: ['../y'] }, { env }), /Mã không hợp lệ/);
});

test('stale finds "đang làm" tickets not updated for 24 h', () => {
  const env = envOf(), now = Date.now();
  const old = mk({ title: 'cũ', request: 'a' }, { env, now: new Date(now - 26 * H) });
  for (const to of ['đã giao', 'đang làm']) T.setStatus(old.id, to, { by: 't', env, now: new Date(now - 25 * H) });
  const fresh = mk({ title: 'mới', request: 'b' }, { env, now: new Date(now - 2 * H) });
  for (const to of ['đã giao', 'đang làm']) T.setStatus(fresh.id, to, { by: 't', env, now: new Date(now - H) });
  assert.deepEqual(T.stale({ env, now: new Date(now) }).map((t) => t.id), [old.id]);
});

test('20 writers side by side lose no note', async () => {
  const env = envOf();
  const { id } = mk({ title: 'a', request: 'a' }, { env });
  const run = promisify(execFile);
  await Promise.all(Array.from({ length: 20 }, (_, i) => run('node', ['--input-type=module', '-e',
    `import { addNote } from ${JSON.stringify(MOD)}; addNote(${JSON.stringify(id)}, { by: 'w', text: 'ghi ${i}' });`],
  { env: { ...process.env, ...env } })));
  const texts = T.getTicket(id, { env }).notes.map((n) => n.text).sort();
  assert.equal(texts.length, 20);
  for (let i = 0; i < 20; i++) assert.ok(texts.includes(`ghi ${i}`), `ghi ${i}`);
});

test('the CLI creates from a JSON file and moves status', async () => {
  const env = envOf(), run = promisify(execFile), CLI = new URL(MOD).pathname;
  const f = path.join(env.COMPANY_DIR, 'in.json');
  fs.writeFileSync(f, JSON.stringify({ title: 'có "ngoặc" và $x', request: 'r' }));
  const opts = { env: { ...process.env, ...env } };
  const t = JSON.parse((await run('node', [CLI, 'create', '--json', f], opts)).stdout);
  assert.equal(t.title, 'có "ngoặc" và $x');
  const fa = path.join(env.COMPANY_DIR, 'a.json');
  fs.writeFileSync(fa, JSON.stringify({ goal: 'g', deliverables: ['d'], criteria: ['c'], questions: [] }));
  await run('node', [CLI, 'analysis', t.id, '--json', fa], opts);
  const a = JSON.parse((await run('node', [CLI, 'assign', t.id, 'phong-ky-su'], opts)).stdout);
  assert.equal(a.status, 'đã giao');
  await assert.rejects(run('node', [CLI, 'status', t.id, 'xong', '--by', 't'], opts), /Không chuyển được/);
});

test('setAnalysis stores the analysis; "needs anh" when it has questions', () => {
  const env = envOf();
  const { id } = T.createTicket({ title: 'a', request: 'làm video' }, { env });
  const a = { goal: 'Giới thiệu sản phẩm X cho khách mới', deliverables: ['video 60 giây'], criteria: ['dưới 60 giây', 'có logo'],
    assumptions: ['tiếng Việt'], risks: ['ổ đĩa đầy'], departments: ['phong-video'], questions: ['Khổ dọc hay ngang?'] };
  const t = T.setAnalysis(id, a, { env });
  assert.deepEqual(t.analysis, a);
  assert.equal(T.needsConfirmation(t), true);
  assert.equal(T.needsConfirmation(T.setAnalysis(id, { ...a, questions: [] }, { env })), false);
  assert.throws(() => T.setAnalysis(id, { goal: '' }, { env }), /goal/);
});

test('a ticket cannot be assigned before it has an analysis, nor while its questions are open', () => {
  const env = envOf();
  const { id } = T.createTicket({ title: 'a', request: 'a' }, { env });
  assert.throws(() => T.assign(id, 'phong-ky-su', { env }), /phân tích/);
  T.setAnalysis(id, { goal: 'g', deliverables: ['d'], criteria: ['c'], questions: ['?'] }, { env });
  assert.throws(() => T.assign(id, 'phong-ky-su', { env }), /chờ anh xác nhận/);
  T.setAnalysis(id, { goal: 'g', deliverables: ['d'], criteria: ['c'], questions: [] }, { env });
  assert.equal(T.assign(id, 'phong-ky-su', { env }).status, 'đã giao');
});

test('review fix: "đã giao" / "đang làm" need an analysis with no open question, by any route', () => {
  const env = envOf();
  const a = T.createTicket({ title: 'a', request: 'a', department: 'tro-ly-giam-doc' }, { env });
  assert.throws(() => T.setStatus(a.id, 'đã giao', { by: 't', env }), /phân tích/);
  T.setAnalysis(a.id, { ...OK, questions: ['?'] }, { env });
  T.setStatus(a.id, 'chờ anh', { by: 't', env });
  assert.throws(() => T.setStatus(a.id, 'đang làm', { by: 't', env }), /chờ anh xác nhận/);
  T.setAnalysis(a.id, { ...OK, questions: [] }, { env });
  assert.equal(T.setStatus(a.id, 'đang làm', { by: 't', env }).status, 'đang làm');
});

test('review fix: a probation department cannot skip "chờ anh nhận"', () => {
  const env = { ...envOf(), SKILLS_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'sk-')) };
  const d = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../../phong-ky-su/department.json'), 'utf8'));
  fs.mkdirSync(path.join(env.SKILLS_DIR, 'phong-thu'));
  fs.writeFileSync(path.join(env.SKILLS_DIR, 'phong-thu', 'department.json'), JSON.stringify({ ...d, name: 'phong-thu', skill: 'phong-thu', status: 'probation' }));
  const t = mk({ title: 'a', request: 'a' }, { env });
  T.assign(t.id, 'phong-thu', { env });
  T.setStatus(t.id, 'đang làm', { by: 't', env });
  assert.throws(() => T.setStatus(t.id, 'xong', { by: 't', env }), /thử việc/);
  T.setStatus(t.id, 'chờ anh nhận', { by: 't', env });
  assert.equal(T.setStatus(t.id, 'xong', { by: 'anh', env }).status, 'xong');
});

test('review fix: a ticket file of the right status but missing arrays is skipped with a warning', () => {
  const env = envOf();
  fs.mkdirSync(path.join(env.COMPANY_DIR, 'tickets'), { recursive: true });
  fs.writeFileSync(path.join(env.COMPANY_DIR, 'tickets', 'P-x.json'), JSON.stringify({ id: 'P-x', status: 'chờ anh', title: 't' }));
  const r = T.listTickets({ env });
  assert.equal(r.tickets.length, 0);
  assert.match(r.warnings[0], /P-x/);
});

test('review fix: assign keeps the department unchanged when the move is refused', () => {
  const env = envOf();
  const t = mk({ title: 'a', request: 'a' }, { env });
  T.setStatus(t.id, 'huỷ', { by: 't', env });
  assert.throws(() => T.assign(t.id, 'phong-ky-su', { env }), /Không chuyển được/);
  assert.equal(T.getTicket(t.id, { env }).department, 'tro-ly-giam-doc');
});

test('a Lead escalates a problem to the Trợ lý giám đốc; it stays open until resolved', () => {
  const env = envOf();
  const t = mk({ title: 'a', request: 'a' }, { env });
  T.assign(t.id, 'phong-ky-su', { env });
  const e = T.escalate(t.id, { by: 'planner', problem: 'Tester trả về 3 lần vì thiếu dữ liệu mẫu', need: 'trợ lý' }, { env });
  assert.equal(e.issues.length, 1);
  assert.deepEqual([e.issues[0].open, e.issues[0].need, e.issues[0].by], [true, 'trợ lý', 'planner']);
  assert.match(e.notes.at(-1).text, /thiếu dữ liệu mẫu/);
  assert.deepEqual(T.openIssues({ env }).map((x) => [x.ticket.id, x.index]), [[t.id, 0]]);
  T.resolveIssue(t.id, 0, { by: 'tro-ly-giam-doc', how: 'thêm vai tạo dữ liệu mẫu' }, { env });
  assert.equal(T.openIssues({ env }).length, 0);
  assert.equal(T.getTicket(t.id, { env }).issues[0].how, 'thêm vai tạo dữ liệu mẫu');
  assert.throws(() => T.escalate(t.id, { by: 'x', problem: '', need: 'trợ lý' }, { env }), /problem/);
  assert.throws(() => T.escalate(t.id, { by: 'x', problem: 'p', need: 'ai đó' }, { env }), /need/);
});

test('with Auto on, a probation department may finish without "chờ anh nhận", marked auto in history', async () => {
  const env = { ...envOf(), SKILLS_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'sk-')) };
  const d = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../../phong-ky-su/department.json'), 'utf8'));
  fs.mkdirSync(path.join(env.SKILLS_DIR, 'phong-thu'));
  fs.writeFileSync(path.join(env.SKILLS_DIR, 'phong-thu', 'department.json'), JSON.stringify({ ...d, name: 'phong-thu', skill: 'phong-thu', status: 'probation' }));
  const { setAutoMode } = await import('../scripts/departments.mjs');
  setAutoMode(true, { env });
  const t = mk({ title: 'a', request: 'a' }, { env });
  T.assign(t.id, 'phong-thu', { env });
  T.setStatus(t.id, 'đang làm', { by: 't', env });
  const done = T.setStatus(t.id, 'xong', { by: 'thu-ky', env });
  assert.equal(done.status, 'xong');
  assert.equal(done.history.at(-1).auto, true);
});

test('codex fix: "after" is enforced on every route to work, and can-start is on the CLI', async () => {
  const env = envOf();
  const a = mk({ title: 'a', request: 'a' }, { env }), b = mk({ title: 'b', request: 'b', after: [a.id] }, { env });
  assert.throws(() => T.assign(b.id, 'phong-ky-su', { env }), /chờ phiếu/);
  assert.throws(() => T.setStatus(b.id, 'đã giao', { by: 't', env }), /chờ phiếu/);
  const run = promisify(execFile), CLI = new URL(MOD).pathname;
  const out = JSON.parse((await run('node', [CLI, 'can-start', b.id], { env: { ...process.env, ...env } })).stdout);
  assert.deepEqual(out, { ok: false, waitingOn: [a.id] });
});

test('codex fix: only registered departments, and an unknown one never finishes', () => {
  const env = envOf();
  const t = mk({ title: 'a', request: 'a' }, { env });
  assert.throws(() => T.assign(t.id, 'phong-khong-co', { env }), /Không có phòng/);
});

test('codex fix: a ticket finishes only with a result', () => {
  const env = envOf();
  const t = T.createTicket({ title: 'a', request: 'a' }, { env });
  T.setAnalysis(t.id, OK, { env });
  T.assign(t.id, 'tro-ly-giam-doc', { env }); T.setStatus(t.id, 'đang làm', { by: 't', env });
  assert.throws(() => T.setStatus(t.id, 'xong', { by: 't', env }), /kết quả/);
  assert.throws(() => T.setResult(t.id, { summary: '  ', links: [] }, { env }), /summary/);
  assert.throws(() => T.setResult(t.id, { summary: 's', links: 'x' }, { env }), /links/);
  T.setResult(t.id, { summary: 'xong', links: [] }, { env });
  assert.equal(T.setStatus(t.id, 'xong', { by: 't', env }).status, 'xong');
});

test('codex r2: work and completion need a registered department (tro-ly-giam-doc counts), on every route', () => {
  const env = envOf();
  const t = T.createTicket({ title: 'a', request: 'a' }, { env });
  T.setAnalysis(t.id, OK, { env }); T.setResult(t.id, { summary: 's', links: [] }, { env });
  assert.throws(() => T.setStatus(t.id, 'đã giao', { by: 't', env }), /phòng/);
  const u = T.createTicket({ title: 'u', request: 'u', department: 'phong-khong-co' }, { env });
  T.setAnalysis(u.id, OK, { env });
  assert.throws(() => T.setStatus(u.id, 'đã giao', { by: 't', env }), /phòng-khong-co|phong-khong-co/);
  const self = T.createTicket({ title: 's', request: 's' }, { env });
  T.setAnalysis(self.id, OK, { env }); T.setResult(self.id, { summary: 's', links: [] }, { env });
  T.assign(self.id, 'tro-ly-giam-doc', { env });
  T.setStatus(self.id, 'đang làm', { by: 't', env });
  assert.equal(T.setStatus(self.id, 'xong', { by: 't', env }).status, 'xong');
});

// Đề xuất 1: phòng Kỹ sư không ghi được kết quả khi thiếu dòng sổ đo hoặc bài học.
function engineering() {
  const projects = fs.mkdtempSync(path.join(os.tmpdir(), 'cty-du-an-')), repo = path.join(projects, 'repo');
  const env = { ...envOf(), KHO_PROJECTS_DIR: projects };
  fs.mkdirSync(repo);
  execFileSync('git', ['init', '-q'], { cwd: repo });
  const t = T.createTicket({ title: 'Sửa', request: 'x', department: 'phong-ky-su', repo }, { env });
  return { env, repo, id: t.id };
}

test('Kỹ sư: a result needs the ledger line and a lesson, and nothing is written until it has them', () => {
  const { env, repo, id } = engineering();
  assert.throws(() => T.setResult(id, { summary: 'xong' }, { env }), /sổ đo[\s\S]*bài học/);
  assert.equal(T.getTicket(id, { env }).result, null);
  startTask(repo, { id, level: 'nhanh' });
  assert.throws(() => T.setResult(id, { summary: 'xong' }, { env }), /bài học/);
  addLesson(repo, { task: `${id} sửa lỗi`, lesson: 'chạy test sớm hơn' });
  assert.equal(T.setResult(id, { summary: 'xong' }, { env }).result.summary, 'xong');
});

test('Kỹ sư: "không có" stands for a lesson, and is kept in the result; any other text does not', () => {
  const { env, repo, id } = engineering();
  startTask(repo, { id, level: 'day-du' });
  assert.throws(() => T.setResult(id, { summary: 'xong', lesson: 'để sau' }, { env }), /bài học/);
  assert.equal(T.setResult(id, { summary: 'xong', lesson: ' Không có ' }, { env }).result.lesson, 'không có');
});

test('Kỹ sư: a lesson of another ticket does not count', () => {
  const { env, repo, id } = engineering();
  startTask(repo, { id, level: 'day-du' });
  addLesson(repo, { task: 'P-khac', lesson: 'bài học khác' });
  assert.throws(() => T.setResult(id, { summary: 'xong' }, { env }), /bài học/);
});

test('Kỹ sư: a ticket without a repo takes it from the result, and the repo is remembered', () => {
  const { env, repo } = engineering();
  const bare = T.createTicket({ title: 'Nghiên cứu', request: 'x', department: 'phong-ky-su' }, { env });
  assert.throws(() => T.setResult(bare.id, { summary: 'xong', lesson: 'không có' }, { env }), /repo/);
  startTask(repo, { id: bare.id, level: 'day-du' });
  assert.equal(T.setResult(bare.id, { summary: 'xong', lesson: 'không có', repo }, { env }).repo, repo);
  assert.ok(listRepos({ env }).includes(fs.realpathSync(repo)));
});

test('Kỹ sư: a repo that is not a git repo is refused and gets no ledger folder', () => {
  const env = envOf(), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cty-plain-'));
  const t = T.createTicket({ title: 'x', request: 'x', department: 'phong-ky-su', repo: dir }, { env });
  assert.throws(() => T.setResult(t.id, { summary: 'xong', lesson: 'không có' }, { env }), /git/);
  assert.deepEqual(fs.readdirSync(dir), []);
});

test('Kỹ sư: a result written before the ticket reached the department does not get past the check', () => {
  const { env, repo } = engineering();
  const t = T.createTicket({ title: 'x', request: 'x', repo }, { env });
  T.setResult(t.id, { summary: 'xong' }, { env });
  T.setAnalysis(t.id, OK, { env });
  T.assign(t.id, 'phong-ky-su', { env }); T.setStatus(t.id, 'đang làm', { by: 't', env });
  assert.throws(() => T.setStatus(t.id, 'xong', { by: 't', env }), /sổ đo[\s\S]*bài học/);
  assert.throws(() => T.setStatus(t.id, 'chờ anh nhận', { by: 't', env }), /sổ đo/);
  assert.equal(T.getTicket(t.id, { env }).status, 'đang làm');
  startTask(repo, { id: t.id, level: 'nhanh' });
  addLesson(repo, { task: t.id, lesson: 'một bài học' });
  assert.equal(T.setStatus(t.id, 'xong', { by: 't', env }).status, 'xong');
});

test('Kỹ sư: a repo outside the allowed folders is refused, and nothing is made in it', () => {
  const { env, repo } = engineering();
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'cty-rieng-'));
  execFileSync('git', ['init', '-q'], { cwd: outside });
  const t = T.createTicket({ title: 'x', request: 'x', department: 'phong-ky-su' }, { env });
  assert.throws(() => T.setResult(t.id, { summary: 'xong', lesson: 'không có', repo: outside }, { env }), /thư mục dự án/);
  assert.equal(fs.existsSync(path.join(outside, '.git', 'phong-ky-su')), false);
  // (inside the folder, but its .git points out)
  const fake = path.join(path.dirname(repo), 'gia');
  fs.mkdirSync(fake); fs.writeFileSync(path.join(fake, '.git'), `gitdir: ${path.join(outside, '.git')}\n`);
  assert.throws(() => T.setResult(t.id, { summary: 'xong', lesson: 'không có', repo: fake }, { env }), /thư mục dự án/);
  assert.equal(fs.existsSync(path.join(outside, '.git', 'phong-ky-su')), false);
  assert.deepEqual(listRepos({ env }), []);
});

test('a relative repo is kept as an absolute path when the ticket is made', () => {
  const env = envOf();
  assert.equal(T.createTicket({ title: 'x', request: 'x', repo: 'du-an' }, { env }).repo, path.resolve('du-an'));
  assert.equal(T.createTicket({ title: 'x', request: 'x' }, { env }).repo, null);
});

test('other departments keep writing a result as before', () => {
  const env = envOf();
  const t = T.createTicket({ title: 'x', request: 'x', department: 'phong-marketing' }, { env });
  assert.deepEqual(T.setResult(t.id, { summary: 'xong', links: ['a'] }, { env }).result, { summary: 'xong', links: ['a'] });
});

test('assign remembers the ticket\'s repo for the digest; a refused assign does not', () => {
  const { env, repo } = engineering();
  const t = T.createTicket({ title: 'x', request: 'x', repo }, { env });
  assert.throws(() => T.assign(t.id, 'tro-ly-giam-doc', { env }), /phân tích/);
  assert.deepEqual(listRepos({ env }), []);
  T.setAnalysis(t.id, OK, { env });
  T.assign(t.id, 'tro-ly-giam-doc', { env });
  assert.deepEqual(listRepos({ env }), [fs.realpathSync(repo)]);
});

test('a ticket cannot widen the repo list: outside the project folder, through a link, or not a repo', () => {
  const { env, repo } = engineering();
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'cty-rieng-')), plain = path.join(path.dirname(repo), 'thuong'), link = path.join(path.dirname(repo), 'link');
  execFileSync('git', ['init', '-q'], { cwd: outside });
  fs.mkdirSync(plain); fs.symlinkSync(outside, link);
  for (const r of [outside, plain, link, '/khong/co/thu-muc']) {
    const t = T.createTicket({ title: 'x', request: 'x', repo: r }, { env });
    T.setAnalysis(t.id, OK, { env });
    T.assign(t.id, 'tro-ly-giam-doc', { env });
  }
  assert.deepEqual(listRepos({ env }), []);
});
