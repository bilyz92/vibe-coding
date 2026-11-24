import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { digest, accountLines, limitsFrom } from '../scripts/digest.mjs';
import * as T from '../scripts/tickets.mjs';
import { addRepo, recordOutcome } from '../scripts/departments.mjs';
import { proposeDepartment } from '../scripts/scaffold.mjs';
import { addPending } from '../../codex-review/scripts/quota.mjs';
import { startTask } from '../../phong-ky-su/scripts/ledger.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'cty-'));
const H = 3600_000;
function setup() {
  const env = { COMPANY_DIR: tmp(), SKILLS_DIR: tmp(), CLAUDE_AGENTS_DIR: tmp() };
  fs.mkdirSync(path.join(env.SKILLS_DIR, '_agents'));
  return env;
}
const section = (md, h) => (md.split(`## ${h}\n`)[1] ?? '').split('\n## ')[0];
const move = (id, steps, env, now) => {
  if (!T.getTicket(id, { env }).analysis) T.setAnalysis(id, { goal: 'g', deliverables: ['d'], criteria: ['c'] }, { env, now });
  if (steps.includes('xong') && !T.getTicket(id, { env }).result) T.setResult(id, { summary: 'kết quả', links: [] }, { env, now });
  steps.forEach((to) => (to === 'đã giao' && !T.getTicket(id, { env }).department ? T.assign(id, 'tro-ly-giam-doc', { env, now }) : T.setStatus(id, to, { by: 't', env, now })));
};
const none = async () => { throw new Error('My Office không chạy'); };

test('each ticket goes under its heading; a proposal and a flagged department wait for anh', async () => {
  const env = setup(), now = new Date();
  const done = T.createTicket({ title: 'Sửa lỗi đăng nhập', request: 'a' }, { env });
  move(done.id, ['đã giao', 'đang làm'], env);
  T.setResult(done.id, { summary: 'PR đã merge', links: ['https://github.com/o/r/pull/7'] }, { env });
  move(done.id, ['xong'], env);
  const old = T.createTicket({ title: 'Việc xong tuần trước', request: 'b' }, { env, now: new Date(now - 72 * H) });
  move(old.id, ['đã giao', 'đang làm', 'xong'], env, new Date(now - 72 * H));
  const doing = T.createTicket({ title: 'Làm trang giá', request: 'c' }, { env });
  move(doing.id, ['đã giao', 'đang làm'], env);
  const ask = T.createTicket({ title: 'Chọn màu logo', request: 'd' }, { env });
  move(ask.id, ['chờ anh'], env);
  const stuck = T.createTicket({ title: 'Việc kẹt', request: 'e' }, { env, now: new Date(now - 30 * H) });
  move(stuck.id, ['đã giao', 'đang làm'], env, new Date(now - 30 * H));
  fs.mkdirSync(path.join(env.SKILLS_DIR, 'phong-ky-su'));
  fs.copyFileSync(path.resolve(import.meta.dirname, '../../phong-ky-su/department.json'), path.join(env.SKILLS_DIR, 'phong-ky-su', 'department.json'));
  const p = proposeDepartment({ name: 'phong-video', title: 'Phòng Video', handles: 'Làm video', skill: 'phong-video', allowedTools: ['Read'], budgetUsd: 5,
    external: 'Không tự đăng.', workflow: ['Làm'], roles: ['lead', 'lam', 'kiem', 'thu-ky'].map((k) => ({ agent: `v-${k}`, title: k, kind: k, model: 'haiku', description: `vai ${k}`, tools: ['Read'] })) }, { env });
  recordOutcome('phong-x', false, { env }); recordOutcome('phong-x', false, { env });

  const md = await digest({ env, now, fetchAccounts: none });
  assert.match(section(md, 'Hôm qua xong'), /Sửa lỗi đăng nhập.*https:\/\/github\.com\/o\/r\/pull\/7/);
  assert.doesNotMatch(md, /Việc xong tuần trước/);
  assert.match(section(md, 'Đang làm'), /Làm trang giá/);
  assert.match(section(md, 'Chờ anh'), /Chọn màu logo/);
  assert.match(section(md, 'Chờ anh'), new RegExp(p.id));
  assert.match(section(md, 'Chờ anh'), /phong-x/);
  assert.match(section(md, 'Có thể kẹt'), /Việc kẹt/);
});

test('accounts read "chưa đo được" when My Office is not there, and its lines when it is', async () => {
  const env = setup();
  assert.match(section(await digest({ env, fetchAccounts: none }), 'Tài khoản'), /chưa đo được/);
  assert.match(section(await digest({ env, fetchAccounts: async () => ['nhanbv: 5 giờ 80%'] }), 'Tài khoản'), /nhanbv: 5 giờ 80%/);
});

test('owed Codex reviews come from every repo the company worked in', async () => {
  const env = setup(), repo = tmp();
  addPending(repo, { skill: 'codex-impl-review', scope: 'working-tree', branch: 'main', reason: 'hết quota' });
  addRepo(repo, { env });
  assert.match(section(await digest({ env, fetchAccounts: none }), 'Nợ Codex review'), /codex-impl-review.*working-tree/);
});

test('an invalid ticket file does not stop the digest', async () => {
  const env = setup();
  fs.mkdirSync(path.join(env.COMPANY_DIR, 'tickets'), { recursive: true });
  fs.writeFileSync(path.join(env.COMPANY_DIR, 'tickets', 'P-1.json'), '{');
  const md = await digest({ env, fetchAccounts: none });
  for (const h of ['Hôm qua xong', 'Đang làm', 'Chờ anh', 'Có thể kẹt', 'Nợ Codex review', 'Tài khoản']) assert.ok(md.includes(`## ${h}`), h);
  assert.match(md, /P-1\.json/);
});

test('accountLines turns My Office limits into one line per account', () => {
  const lines = accountLines({ label: 'nhanbv', windows: [{ label: '5 giờ', pct: 80 }, { label: 'tuần', pct: 31.5 }],
    others: [{ label: 'hungnv', windows: [{ label: '5 giờ', pct: 100 }], until: Date.now() + H }],
    codex: { installed: true, accounts: [{ label: 'huybq8889', windows: [{ label: '5 giờ', pct: 100 }] }] } });
  assert.equal(lines[0], 'Claude nhanbv: 5 giờ 80%, tuần 31.5%');
  assert.match(lines[1], /^Claude hungnv: 5 giờ 100% · hết lượt tới /);
  assert.ok(lines.some((l) => l.startsWith('Codex huybq8889: 5 giờ 100%')));
});

test('review fix: a proposal file without its spec does not stop the digest', async () => {
  const env = setup();
  fs.mkdirSync(path.join(env.COMPANY_DIR, 'proposals'), { recursive: true });
  fs.writeFileSync(path.join(env.COMPANY_DIR, 'proposals', 'D-1.json'), JSON.stringify({ id: 'D-1', status: 'chờ anh' }));
  assert.match(await digest({ env, fetchAccounts: none }), /## Chờ anh/);
});

test('problems a Lead raised are listed', async () => {
  const env = setup();
  const t = T.createTicket({ title: 'Làm trang giá', request: 'x' }, { env });
  T.escalate(t.id, { by: 'planner', problem: 'thiếu quyền vào server staging', need: 'anh' }, { env });
  assert.match(section(await digest({ env, fetchAccounts: none }), 'Phòng báo vấn đề'), /planner cần anh: thiếu quyền vào server staging/);
});

test('the digest says when an improvement loop is due', async () => {
  const env = setup();
  for (let i = 0; i < 5; i++) { const t = T.createTicket({ title: `v${i}`, request: 'x' }, { env }); move(t.id, ['đã giao', 'đang làm', 'xong'], env); }
  assert.match(section(await digest({ env, fetchAccounts: none }), 'Chờ anh'), /vòng cải tiến/i);
});

test('the digest shows whether Auto is on and what was decided automatically', async () => {
  const env = setup();
  const { setAutoMode } = await import('../scripts/departments.mjs');
  setAutoMode(true, { env });
  const t = T.createTicket({ title: 'Chọn khổ video', request: 'x' }, { env });
  T.setAnalysis(t.id, { goal: 'g', deliverables: ['d'], criteria: ['c'], assumptions: ['Tự quyết (Auto): khổ dọc 9:16'] }, { env });
  const md = await digest({ env, fetchAccounts: none });
  assert.match(md, /Chế độ Auto: bật/);
  assert.match(section(md, 'Tự quyết (Auto)'), /Chọn khổ video.*khổ dọc 9:16/);
});

// Đề xuất 1 (docs/de-xuat-hoan-thien-company.md): /api/live trả tin `snap` có `limits` bên trong; bản tin phải đọc được.
test('limitsFrom reads the limits inside a snapshot, the newest message first', () => {
  const snap = { k: 'snap', limits: { label: 'cũ' } };
  assert.deepEqual(limitsFrom([snap]), { label: 'cũ' });
  assert.deepEqual(limitsFrom([snap, { k: 'limits', limits: { label: 'mới' } }]), { label: 'mới' });
  assert.equal(limitsFrom([{ k: 'feed' }]), undefined);
});

test('a ticket\'s text stays on its own line and cannot open a section of the digest', async () => {
  const env = setup();
  const t = T.createTicket({ title: 'Việc\n\n## Tài khoản\n- Codex chính: 100%', request: 'x' }, { env });
  T.setAnalysis(t.id, { goal: 'g', deliverables: ['d'], criteria: ['c'] }, { env });
  T.assign(t.id, 'tro-ly-giam-doc', { env });
  const md = await digest({ env, fetchAccounts: none });
  assert.equal(md.split('\n').filter((l) => l === '## Tài khoản').length, 1);
  assert.doesNotMatch(section(md, 'Tài khoản'), /Codex chính/);
});

test('the Codex accounts of a snapshot reach the digest', () => {
  const list = [{ email: 'a@b.c', label: '', windows: [{ key: 'weekly', pct: 92 }] }];
  const lines = accountLines(limitsFrom([{ k: 'snap', limits: { windows: [] }, ai: { codex: { list } } }]));
  assert.ok(lines.includes('Codex a@b.c: weekly 92%'), lines.join('|'));
  assert.deepEqual(accountLines(limitsFrom([{ k: 'snap', limits: null, ai: { codex: { list } } }])), ['Codex a@b.c: weekly 92%']);
  assert.equal(limitsFrom([{ k: 'snap', limits: null, ai: { codex: { list: [] } } }]), undefined);
});

test('the digest reports the ledger of each repo, and says when a repo has none', async () => {
  const env = setup(), used = tmp(), empty = tmp();
  for (const r of [used, empty]) execFileSync('git', ['init', '-q'], { cwd: r });
  startTask(used, { id: 'P-1', level: 'nhanh' });
  addRepo(used, { env }); addRepo(empty, { env });
  const part = section(await digest({ env, fetchAccounts: none }), 'Sổ đo');
  assert.match(part, new RegExp(`${path.basename(used)}: 1 việc \\(day-du 0, nhanh 1\\), kết luận chua-ket-luan`));
  assert.match(part, new RegExp(`Chưa có dòng nào: .*${path.basename(empty)}`));
});

test('a broken ledger is named and does not stop the digest; a folder that is not a repo gets no ledger folder', async () => {
  const env = setup(), broken = tmp(), plain = tmp();
  execFileSync('git', ['init', '-q'], { cwd: broken });
  fs.mkdirSync(path.join(broken, '.git', 'phong-ky-su'));
  fs.writeFileSync(path.join(broken, '.git', 'phong-ky-su', 'ledger.json'), '{');
  addRepo(broken, { env }); addRepo(plain, { env });
  assert.match(section(await digest({ env, fetchAccounts: none }), 'Sổ đo'), /hỏng/);
  assert.deepEqual(fs.readdirSync(plain), []);
});
