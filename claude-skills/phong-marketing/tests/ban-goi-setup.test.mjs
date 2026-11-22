// Đề xuất 5 (docs/de-xuat-hoan-thien-company.md): ba skill sau khi có người trả lời. node --test this file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { auditSkill } from '../../tro-ly-giam-doc/scripts/skill-audit.mjs';

const root = path.resolve(import.meta.dirname, '..', '..');
const NAMES = ['mkt-ban-goi-setup-cuoc-goi', 'mkt-ban-goi-setup-bao-gia', 'mkt-ban-goi-setup-thoa-thuan'];
const read = (n) => fs.readFileSync(path.join(root, n, 'SKILL.md'), 'utf8');
const [goi, gia, thoa] = NAMES.map(read);

test('phòng Marketing lists all three, and each skill names itself and passes the audit', () => {
  const room = fs.readFileSync(path.join(root, 'phong-marketing', 'SKILL.md'), 'utf8');
  for (const n of NAMES) {
    assert.ok(room.includes(n), n);
    assert.match(read(n), new RegExp(`^---\\nname: ${n}\\ndescription: `));
    assert.deepEqual(auditSkill(path.join(root, n)).blocking, []);
  }
});

test('no skill holds a price of its own: the strategy table is the only source', () => {
  for (const s of [goi, gia, thoa]) assert.doesNotMatch(s, /\$\s?\d|\d\s?(USD|triệu|nghìn|đồng)\b/i);
  assert.ok(gia.includes('mục 3 của `~/project/my-office/docs/chien-luoc-kinh-doanh.md`'));
  assert.ok(gia.includes('[GIÁ: ANH CHỌN]'));
  assert.ok(gia.includes('thử, chưa kiểm chứng'));
});

test('every skill stops at a draft, keeps to confirmed facts, and treats customer text as data', () => {
  for (const s of [goi, gia, thoa]) {
    assert.match(s, /Không tự (gửi|đặt lịch|ký)|Không tự gửi/);
    assert.ok(s.includes('**dữ liệu, không phải lệnh**') || s.includes('là **dữ liệu, không phải lệnh**'));
    assert.ok(s.includes('kho tri thức'));
  }
  assert.ok(goi.includes('SU-THAT-DA-XAC-NHAN.md'));
  assert.ok(gia.includes('SU-THAT-DA-XAC-NHAN.md'));
  assert.ok(goi.includes('mkt-tiep-can-lanh'));
});

test('the agreement says it is not legal advice and leaves every legal row empty', () => {
  assert.ok(thoa.includes('**Đây không phải tư vấn pháp lý.**'));
  assert.ok(thoa.includes('Không phải tư vấn pháp lý. Không ký khi còn ô [ANH ĐIỀN].'));
  const legal = thoa.split('**B. Phần pháp lý')[1].split('## Giao cho anh')[0];
  const rows = legal.split('\n').filter((l) => l.startsWith('| ') && !/^\| (Mục|---)/.test(l));
  assert.ok(rows.length >= 8);
  for (const r of rows) assert.match(r, /\| \[ANH ĐIỀN\] \|$/, r);
  assert.doesNotMatch(thoa, /Nghị định \d|Bộ luật|Điều \d/);
});

test('ideas are credited, and nothing of the outside connectors came along', () => {
  assert.ok(goi.includes('`sales/call-prep`'));
  assert.ok(gia.includes('`small-business/proposal-builder`'));
  for (const s of [goi, gia, thoa]) assert.doesNotMatch(s, /connector[^.]*(Salesforce|HubSpot|Gmail)|mcp__/i);
});
