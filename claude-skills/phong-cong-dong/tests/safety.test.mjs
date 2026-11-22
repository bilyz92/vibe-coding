// Khoá công cụ từng vai và các luật an toàn của phong-cong-dong. node --test this file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..', '..');
const agentFile = (a) => fs.readFileSync(path.join(root, '_agents', `${a}.md`), 'utf8');
const agent = (a) => agentFile(a).replace(/^---\n[\s\S]*?\n---\n/, '');   // (luật phải nằm trong thân, phần vai thật sự đọc)
const TOOLS = {
  "cd-lead": "Read, Write, Glob, Grep",
  "cd-noi-dung": "Read, Write, Edit, Glob, Grep",
  "cd-koc": "Read, Write, Edit, Glob, Grep",
  "cd-theo-doi": "WebSearch, WebFetch",
  "cd-kiem-duyet": "Read, Glob, Grep",
  "cd-thu-ky": "Read, Write, Bash",
  "cd-page-group": "Read, Write, Edit, Glob, Grep"
};
const RULES = [
  [
    "cd-page-group",
    "không gọi Meta API"
  ],
  [
    "cd-page-group",
    "không dùng ~/tools/meta/fb.sh"
  ],
  [
    "cd-page-group",
    "Meta đã bỏ Groups API"
  ],
  [
    "cd-page-group",
    "mời hàng loạt người lạ"
  ],
  [
    "cd-noi-dung",
    "Không bao giờ tự đăng"
  ],
  [
    "cd-koc",
    "ghi rõ có tài trợ"
  ],
  [
    "cd-koc",
    "công khai nhận hợp tác"
  ],
  [
    "cd-lead",
    "cd-kiem-duyet không mở web"
  ],
  [
    "cd-kiem-duyet",
    "NĐ 91/2020"
  ],
  [
    "cd-lead",
    "Không bao giờ đề xuất nick phụ"
  ],
  [
    "cd-theo-doi",
    "không đọc, không ghi file trên máy"
  ],
  [
    "cd-lead",
    "nhờ cd-thu-ky chạy tickets.mjs escalate"
  ]
];
const d = JSON.parse(fs.readFileSync(path.join(root, 'phong-cong-dong', 'department.json'), 'utf8'));

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
