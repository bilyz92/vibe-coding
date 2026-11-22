// Khoá công cụ từng vai, luật an toàn và script chỉ đọc của phong-an-ninh. node --test this file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..', '..');
const agentFile = (a) => fs.readFileSync(path.join(root, '_agents', `${a}.md`), 'utf8');
const agent = (a) => agentFile(a).replace(/^---\n[\s\S]*?\n---\n/, '');   // (luật phải nằm trong thân, phần vai thật sự đọc)
const TOOLS = {
  'an-lead': 'Read, Write, Glob, Grep',
  'an-he-thong': 'Read, Bash, Glob, Grep',
  'an-ung-dung': 'Read, Bash, Glob, Grep',
  'an-tai-khoan': 'Read, Bash, Glob, Grep',
  'an-kiem-soat': 'Read, Glob, Grep',
  'an-thu-ky': 'Read, Write, Bash',
};
const RULES = [
  ['an-he-thong', 'Không bao giờ dùng sudo, chmod, chown, kill, systemctl, ufw, iptables, docker stop, rm, restart'],
  ['an-he-thong', 'không bao giờ cat, head hay in nội dung'],
  ['an-he-thong', 'Không quét mạng hay máy khác'],
  ['an-ung-dung', 'không tự cài'],
  ['an-ung-dung', 'không gọi server production hay máy khác'],
  ['an-tai-khoan', 'không sửa file'],
  ['an-kiem-soat', 'không có token, mật khẩu, khoá nào trong báo cáo'],
  ['an-lead', 'không mở phiếu sửa'],
  ['an-ung-dung', 'không bao giờ in nguyên dòng chứa token'],
  ['an-tai-khoan', 'không dùng tool Read, cat hay head trên file token'],
];
const d = JSON.parse(fs.readFileSync(path.join(root, 'phong-an-ninh', 'department.json'), 'utf8'));

test('mỗi vai có đúng bộ công cụ đã duyệt, không vai nào có web', () => {
  assert.deepEqual(d.roles.map((r) => r.agent).sort(), Object.keys(TOOLS).sort());
  for (const [a, t] of Object.entries(TOOLS)) assert.equal(/^tools: (.*)$/m.exec(agentFile(a))?.[1], t, a);
  for (const r of d.roles) if (r.kind === 'lead') assert.ok(!TOOLS[r.agent].includes('Bash'));
  assert.ok(Object.values(TOOLS).every((t) => !t.includes('Web')));
});

test('luật an toàn có trong hướng dẫn vai', () => {
  for (const [a, s] of RULES) assert.ok(agent(a).includes(s), `${a}: thiếu "${s}"`);
});

test('kiem-ngay.sh chỉ đọc: không lệnh sửa hệ thống, không quét mạng, không in nội dung file bí mật', () => {
  const s = fs.readFileSync(path.join(root, 'phong-an-ninh', 'scripts', 'kiem-ngay.sh'), 'utf8')
    .split('\n').filter((l) => !l.trimStart().startsWith('#')).join('\n');
  for (const bad of [/\bsudo\b/, /\bchmod\b/, /\bchown\b/, /\bkill\b/, /\bsystemctl\b/, /\bufw\b/, /\biptables\b/, /\brm\b/,
    /docker (stop|rm|kill|restart|exec|run)/, /\bnmap\b/, /\bcurl\b/, /\bwget\b/, /\bcat\b/, /-delete\b/, /-exec\b/, /\btee\b/, /\bcp\b/, /\bmv\b/, /\bdd\b/, /\btouch\b/, /open\([^)]*['"][wa]/])
    assert.ok(!bad.test(s), `có lệnh cấm ${bad}`);
  const ghi = s.match(/>>?\s*"?[^\s&|)]+/g).filter((x) => !/^>\s*\/dev\/null;?$|^>&|^>\s*"?\$OUT"?$/.test(x));
  assert.deepEqual(ghi, [], 'chỉ được ghi ra file báo cáo');
});
