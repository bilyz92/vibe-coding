// Khoá công cụ từng vai và các luật an toàn của phong-tai-chinh-phap-che. node --test this file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..', '..');
const agentFile = (a) => fs.readFileSync(path.join(root, '_agents', `${a}.md`), 'utf8');
const agent = (a) => agentFile(a).replace(/^---\n[\s\S]*?\n---\n/, '');   // (luật phải nằm trong thân, phần vai thật sự đọc)
const TOOLS = {
  "tc-lead": "Read, Write, Glob, Grep",
  "tc-ke-toan": "Read, Write, Edit, Glob, Grep",
  "tc-thue": "Read, Write, Edit, Glob, Grep",
  "tc-phap-che": "Read, Write, Edit, Glob, Grep",
  "tc-kiem-soat": "Read, Glob, Grep",
  "tc-thu-ky": "Read, Write, Bash"
};
const RULES = [
  [
    "tc-ke-toan",
    "thiếu chứng từ"
  ],
  [
    "tc-ke-toan",
    "Không chuyển tiền"
  ],
  [
    "tc-ke-toan",
    "4 số cuối"
  ],
  [
    "tc-thue",
    "Không tự nộp tờ khai"
  ],
  [
    "tc-thue",
    "Cần luật sư/kế toán có chứng chỉ duyệt trước khi ký/nộp"
  ],
  [
    "tc-phap-che",
    "Không gửi văn bản cho ai, không ký"
  ],
  [
    "tc-phap-che",
    "Luật 91/2025"
  ],
  [
    "tc-kiem-soat",
    "Không có bước tự ký, tự nộp, tự chuyển tiền"
  ],
  [
    "tc-thu-ky",
    "không chạy lệnh nào khác"
  ],
  [
    "tc-lead",
    "Việc tốn tiền"
  ]
];
const d = JSON.parse(fs.readFileSync(path.join(root, 'phong-tai-chinh-phap-che', 'department.json'), 'utf8'));

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

test('chỉ Thư ký có Bash', () => {
  for (const [a, t] of Object.entries(TOOLS)) if (a !== 'tc-thu-ky') assert.ok(!t.includes('Bash'), a);
});
