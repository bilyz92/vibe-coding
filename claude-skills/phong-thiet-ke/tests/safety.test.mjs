// Khoá công cụ từng vai và các luật an toàn của phong-thiet-ke. node --test this file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..', '..');
const agentFile = (a) => fs.readFileSync(path.join(root, '_agents', `${a}.md`), 'utf8');
const agent = (a) => agentFile(a).replace(/^---\n[\s\S]*?\n---\n/, '');   // (luật phải nằm trong thân, phần vai thật sự đọc)
const TOOLS = {
  "tk-lead": "Read, Write, Glob, Grep",
  "tk-pod": "Read, Write, Edit, Bash, Glob, Grep",
  "tk-ui": "Read, Write, Edit, Bash, Glob, Grep",
  "tk-anh-qc": "Read, Write, Edit, Bash, Glob",
  "tk-kiem-duyet": "Read, Bash, Glob, Grep",
  "tk-thu-ky": "Read, Write, Bash"
};
const RULES = [
  [
    "tk-ui",
    "không sửa file trong repo của app"
  ],
  [
    "tk-ui",
    "Không có DESIGN.md đã duyệt thì dừng"
  ],
  [
    "tk-lead",
    "Marketing sở hữu mọi ảnh theo kênh"
  ],
  [
    "tk-anh-qc",
    "không xoá watermark"
  ],
  [
    "tk-lead",
    "nhờ tk-thu-ky chạy tickets.mjs escalate"
  ]
];
const d = JSON.parse(fs.readFileSync(path.join(root, 'phong-thiet-ke', 'department.json'), 'utf8'));

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
