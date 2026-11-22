// Khoá công cụ từng vai và các luật an toàn của ban-co-van. node --test this file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..', '..');
const agentFile = (a) => fs.readFileSync(path.join(root, '_agents', `${a}.md`), 'utf8');
const agent = (a) => agentFile(a).replace(/^---\n[\s\S]*?\n---\n/, '');   // (luật phải nằm trong thân, phần vai thật sự đọc)
const TOOLS = {
  "cv-lead": "Read, Write, Glob, Grep",
  "cv-chien-luoc": "Read, Glob, Grep",
  "cv-tmdt": "Read, Glob, Grep",
  "cv-marketing": "Read, Glob, Grep",
  "cv-ai": "Read, Glob, Grep",
  "cv-phan-bien": "Read, Glob, Grep",
  "cv-thu-ky": "Read, Write, Bash"
};
const RULES = [
  ["cv-tmdt", "chỉ trong danh sách cho phép"],
  ["cv-lead", "Không đọc file nào ngoài danh sách"],
  ["cv-thu-ky", "không chạy lệnh nào khác"],
  ["cv-thu-ky", "bỏ mọi dòng khác"],
  [
    "cv-lead",
    "ba việc nên làm và ba việc nên dừng"
  ],
  [
    "cv-lead",
    "/codex-think-about"
  ],
  [
    "cv-lead",
    "Ban không tự mở"
  ],
  [
    "cv-chien-luoc",
    "Vai này không có web"
  ],
  [
    "cv-marketing",
    "Không khuyên seeding ảo"
  ],
  [
    "cv-ai",
    "không tự cài"
  ],
  [
    "cv-phan-bien",
    "GIỮ, SỬA hoặc BỎ"
  ],
  [
    "cv-tmdt",
    "project của Cole"
  ]
];
const d = JSON.parse(fs.readFileSync(path.join(root, 'ban-co-van', 'department.json'), 'utf8'));

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
