import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as T from '../scripts/tickets.mjs';
import { agenda, writeAgenda } from '../scripts/hop.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'hop-'));
const H = 3600_000;
function setup() {
  const env = { COMPANY_DIR: tmp(), SKILLS_DIR: tmp(), CLAUDE_AGENTS_DIR: tmp(), HOME: tmp() };
  fs.mkdirSync(path.join(env.SKILLS_DIR, 'phong-a'));
  fs.writeFileSync(path.join(env.SKILLS_DIR, 'phong-a', 'department.json'), JSON.stringify({ name: 'phong-a', title: 'Phòng A', handles: 'việc a', skill: 'phong-a',
    status: 'active', allowedTools: ['Read'], budgetUsd: 1, external: 'x', roles: [{ agent: 'a-lead', title: 'Lead', kind: 'lead', model: 'opus' }, { agent: 'a-lam', title: 'Làm', kind: 'lam', model: 'sonnet' },
      { agent: 'a-kiem', title: 'Kiểm', kind: 'kiem', model: 'sonnet' }, { agent: 'a-tk', title: 'Thư ký', kind: 'thu-ky', model: 'haiku' }] }));
  return env;
}
const give = (env, title, dept, now) => {
  const t = T.createTicket({ title, request: 'r' }, { env, now });
  T.setAnalysis(t.id, { goal: 'g', deliverables: ['d'], criteria: ['c'] }, { env, now });
  T.assign(t.id, dept, { env, now });
  return t;
};

test('giao ban: mỗi phòng có xong, đang làm, vướng, chờ phòng khác; phòng không có việc thì bỏ', () => {
  const env = setup(), now = new Date();
  const xong = give(env, 'Việc đã xong', 'phong-a', new Date(now - 2 * H));
  T.setStatus(xong.id, 'đang làm', { by: 't', env, now: new Date(now - 2 * H) });
  T.setResult(xong.id, { summary: 's' }, { env, now: new Date(now - 2 * H) });
  T.setStatus(xong.id, 'xong', { by: 't', env, now: new Date(now - 2 * H) });
  const cu = give(env, 'Việc kẹt', 'phong-a', new Date(now - 30 * H));
  T.setStatus(cu.id, 'đang làm', { by: 't', env, now: new Date(now - 30 * H) });
  const truoc = give(env, 'Việc của trợ lý', 'tro-ly-giam-doc', now);
  const sau = T.createTicket({ title: 'Việc phải chờ', request: 'r', after: [truoc.id] }, { env, now });
  T.setAnalysis(sau.id, { goal: 'g', deliverables: ['d'], criteria: ['c'] }, { env, now });
  T.escalate(truoc.id, { by: 'x', problem: 'thiếu quyền', need: 'anh' }, { env, now });
  const md = agenda('giao-ban', { env, now });
  const a = md.split('## Phòng A')[1].split('\n## ')[0];
  assert.match(a, /Hôm qua xong: \n {2}- .*Việc đã xong/);
  assert.match(a, /Việc kẹt \(không cập nhật quá 24 giờ\)/);
  assert.match(md, /## Trợ lý giám đốc[\s\S]*thiếu quyền \(cần anh\)/);
  assert.ok(!md.includes('Việc phải chờ chờ'), 'phiếu chưa giao phòng nào không vào mục phòng');
  assert.equal(md.match(/thiếu quyền/g).length, 1, 'phiếu có vấn đề mở chỉ hiện một lần');
  const cho = T.createTicket({ title: 'Việc phải chờ', request: 'r', department: 'phong-a', after: [truoc.id] }, { env, now });   // (phiếu con đã ghi phòng, chưa giao được vì còn chờ)
  assert.ok(cho);
  assert.match(agenda('giao-ban', { env, now }), /Việc phải chờ chờ .*Việc của trợ lý \(tro-ly-giam-doc\)/);
  T.addNote(xong.id, { by: 't', text: 'ghi sau' }, { env, now: new Date(now + 26 * H) });
  assert.match(agenda('giao-ban', { env, now: new Date(now + 27 * H) }), /Hôm qua xong: không/, 'ghi chú sau khi xong không đưa phiếu lại mục xong');
});

test('họp tuần ghi file chương trình, có báo cáo các ban và chi phí; không có việc thì nói rõ', () => {
  const env = setup(), now = new Date('2026-11-09T08:00:00');
  fs.mkdirSync(path.join(env.HOME, 'company', 'co-van'), { recursive: true });
  fs.writeFileSync(path.join(env.HOME, 'company', 'co-van', '2026-11-09.md'), '# ghi nhớ');
  fs.mkdirSync(path.join(env.COMPANY_DIR, 'nhan-su'), { recursive: true });
  for (const n of ['2026-11-09-danh-gia.md', 'zz-thu-ky.md']) fs.writeFileSync(path.join(env.COMPANY_DIR, 'nhan-su', n), '#');
  const r = writeAgenda('tuan', { env, now, chiPhi: 'Tổng 1 USD' });
  assert.equal(path.basename(r.file), '2026-11-09-tuan-chuong-trinh.md');
  assert.equal(path.basename(r.bienBan), '2026-11-09-tuan.md');
  const md = fs.readFileSync(r.file, 'utf8');
  assert.match(md, /Không phòng nào có việc/);
  assert.match(md, /Ban Cố vấn: .*co-van\/2026-11-09\.md/);
  assert.match(md, /Phòng An ninh: chưa có/);
  assert.match(md, /Phòng Nhân sự: .*2026-11-09-danh-gia\.md/, 'bỏ hồ sơ từng vai, lấy báo cáo theo ngày');
  assert.match(md, /Tổng 1 USD/);
  assert.throws(() => agenda('khac', { env }), /giao-ban \| tuan/);
});
