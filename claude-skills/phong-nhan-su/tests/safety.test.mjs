// Khoá công cụ từng vai và các luật an toàn của phong-nhan-su. node --test this file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..', '..');
const agentFile = (a) => fs.readFileSync(path.join(root, '_agents', `${a}.md`), 'utf8');
const agent = (a) => agentFile(a).replace(/^---\n[\s\S]*?\n---\n/, '');   // (luật phải nằm trong thân, phần vai thật sự đọc)
const TOOLS = {
  "ns-lead": "Read, Write, Glob, Grep",
  "ns-danh-gia": "Read, Write, Bash, Glob, Grep",
  "ns-dao-tao": "Read, Write, Glob, Grep",
  "ns-kiem-soat": "Read, Glob, Grep",
  "ns-thu-ky": "Read, Write, Bash"
};
const RULES = [
  ["ns-lead", "nhan-su/<agent>.md"],
  ["ns-lead", "[ƯỚC LƯỢNG]"],
  ["ns-danh-gia", "Lịch sử đánh giá"],
  ["ns-dao-tao", "nc-hoc-hoi"],
  ["ns-thu-ky", "Thay đổi hướng dẫn và skill"],
  [
    "ns-danh-gia",
    "chưa có dữ liệu chi phí"
  ],
  [
    "ns-danh-gia",
    "không chạy lệnh đổi trạng thái"
  ],
  [
    "ns-dao-tao",
    "Không sửa trực tiếp agent hay skill"
  ],
  [
    "ns-lead",
    "nhờ ns-thu-ky chạy tickets.mjs escalate"
  ]
];
const d = JSON.parse(fs.readFileSync(path.join(root, 'phong-nhan-su', 'department.json'), 'utf8'));

test('mỗi vai có đúng bộ công cụ đã duyệt', () => {
  assert.deepEqual(d.roles.map((r) => r.agent).sort(), Object.keys(TOOLS).sort());
  for (const [a, t] of Object.entries(TOOLS)) assert.equal(/^tools: (.*)$/m.exec(agentFile(a))?.[1], t, a);
});

test('Lead không có Bash; vai đọc web không đọc hay ghi file', () => {
  for (const r of d.roles) {
    const t = TOOLS[r.agent].split(', ');
    if (r.kind === 'lead') assert.ok(!t.includes('Bash'), r.agent);
    if (t.some((x) => x.startsWith('Web'))) assert.ok(t.every((x) => x.startsWith('Web')), `${r.agent}: có web thì chỉ web`);
  }
});

test('luật an toàn có trong hướng dẫn vai', () => {
  for (const [a, s] of RULES) assert.ok(agent(a).includes(s), `${a}: thiếu "${s}"`);
});

test('khuôn hồ sơ nhân sự có đủ mục và SKILL.md ghi lịch tuần, tháng', () => {
  const h = fs.readFileSync(path.join(root, 'phong-nhan-su', 'templates', 'ho-so.md'), 'utf8');
  for (const s of ['Dự án đang phục vụ', 'Mục tiêu tháng', '[ƯỚC LƯỢNG]', 'Lộ trình phát triển', 'Lịch sử đánh giá', 'Thay đổi hướng dẫn và skill']) assert.ok(h.includes(s), s);
  const k = fs.readFileSync(path.join(root, 'phong-nhan-su', 'SKILL.md'), 'utf8');
  for (const s of ['Hằng tuần', 'Hằng tháng', 'kiểm hai lớp', 'đào tạo lại, gộp hoặc giải thể']) assert.ok(k.includes(s), s);
});
