// Khoá công cụ từng vai và các luật an toàn của phong-nghien-cuu. node --test this file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..', '..');
const agentFile = (a) => fs.readFileSync(path.join(root, '_agents', `${a}.md`), 'utf8');
const agent = (a) => agentFile(a).replace(/^---\n[\s\S]*?\n---\n/, '');   // (luật phải nằm trong thân, phần vai thật sự đọc)
const TOOLS = {
  "nc-lead": "Read, Write, Glob, Grep",
  "nc-san-pham": "WebSearch, WebFetch",
  "nc-doi-thu": "WebSearch, WebFetch",
  "nc-khach-hang": "WebSearch, WebFetch",
  "nc-chinh-sach": "WebSearch, WebFetch",
  "nc-kiem-chung": "WebFetch",
  "nc-thu-ky": "Read, Write, Bash",
  "nc-hoc-hoi": "WebSearch, WebFetch",
  "nc-phan-bien": "Read, Glob, Grep"
};
const RULES = [
  ["nc-thu-ky", "không chạy lệnh nào khác"],
  ["nc-hoc-hoi", "bản tổng hợp tuần do Lead làm"],
  ["nc-lead", "tự viết bản tổng hợp tuần"],
  ["nc-hoc-hoi", "Không tự sửa skill hay agent"],
  ["nc-hoc-hoi", "không đọc, không ghi file trên máy"],
  ["nc-phan-bien", "GIỮ, SỬA (ghi sửa gì) hoặc BỎ"],
  ["nc-lead", "chỉ việc tốn tiền, pháp lý, gửi ra ngoài mới trình anh"],
  [
    "nc-thu-ky",
    "kho.mjs them --tu-file <file Lead ghi> --loai nghien-cuu"
  ],
  [
    "nc-khach-hang",
    "Không nhắn"
  ],
  [
    "nc-lead",
    "nhờ nc-thu-ky chạy tickets.mjs escalate"
  ],
  [
    "nc-san-pham",
    "không đọc, không ghi file trên máy"
  ]
];
const d = JSON.parse(fs.readFileSync(path.join(root, 'phong-nghien-cuu', 'department.json'), 'utf8'));

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

test('SKILL.md ghi dòng chảy học hỏi, phản biện, mở phiếu', () => {
  const k = fs.readFileSync(path.join(root, 'phong-nghien-cuu', 'SKILL.md'), 'utf8');
  for (const s of ['mỗi ngày', 'hoc-hoi/<ngày>.md', 'nc-hoc-hoi', 'nc-phan-bien', 'tickets.mjs create', 'không hỏi anh', '/codex-think-about', 'tốn tiền, pháp lý']) assert.ok(k.includes(s), s);
});
