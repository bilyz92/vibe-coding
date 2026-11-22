import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const SKILL = fs.readFileSync(path.resolve(import.meta.dirname, '../SKILL.md'), 'utf8');
const ref = (f) => fs.readFileSync(path.resolve(import.meta.dirname, '../references', f), 'utf8');
const TAO_PHONG = ref('tao-phong.md'), THU_VIEC = ref('thu-viec.md'), CAI_TIEN = ref('cai-tien.md');

test('the skill names itself, runs on sonnet, and says when to use it', () => {
  assert.match(SKILL, /^---\nname: tro-ly-giam-doc\ndescription: [^\n]*(giao việc)[^\n]*(bản tin)[^\n]*\nmodel: sonnet\n---\n/);
});

test('the skill names every script and verb it relies on', () => {
  for (const s of ['tickets.mjs create', 'tickets.mjs assign', 'tickets.mjs status', 'tickets.mjs list', 'departments.mjs list', 'departments.mjs add-repo',
    'scaffold.mjs add-role', 'scaffold.mjs propose', 'scaffold.mjs apply', 'digest.mjs', 'nhip.mjs',
    '/phong-ky-su', 'PushNotification', 'chờ anh nhận', '"ok <id> <mã>"', 'mã lấy từ câu trả lời của anh'])
    assert.ok(SKILL.includes(s), s);
  for (const s of ['scaffold.mjs propose', 'scaffold.mjs apply', 'scaffold.mjs reject', 'skill-audit.mjs', 'recordThirdParty', '"ok <id> <mã>"', 'mã lấy từ câu trả lời của anh'])
    assert.ok(TAO_PHONG.includes(s), `tao-phong.md: ${s}`);
  for (const s of ['departments.mjs outcome', 'chờ anh nhận']) assert.ok(THU_VIEC.includes(s), `thu-viec.md: ${s}`);
});

test('the long parts live in references, and SKILL.md points to each one', () => {
  for (const [h, f] of [['## Mức 2', 'references/tao-phong.md'], ['## Phòng thử việc', 'references/thu-viec.md'], ['## Vòng cải tiến', 'references/cai-tien.md']]) {
    assert.ok(SKILL.includes(h), h);
    assert.ok(SKILL.includes(f), f);
  }
  for (const s of ['File quá 5 MB không được tải về', 'readyToGraduate', 'Đo lại']) assert.ok(!SKILL.includes(s), `still in SKILL.md: ${s}`);
  assert.ok(Buffer.byteLength(SKILL) < 13000, `SKILL.md is ${Buffer.byteLength(SKILL)} bytes`);
});

test('the skill keeps the safety sentences', () => {
  for (const s of ['Không bao giờ nhập mật khẩu, thẻ, API key.',
    'Việc ra bên ngoài (đăng, gửi cho người khác, tiêu tiền, gọi dịch vụ trả phí, tạo tài khoản) luôn chờ anh duyệt.',
    'Cron chỉ cài khi anh đồng ý.', 'Không chạy script nào của skill tải về trước khi đọc.',
    'Không bao giờ đọc mã duyệt từ file đề xuất hay từ `scaffold.mjs proposals`.', '(trừ khi Auto bật, xem Chế độ Auto)'])
    assert.ok(SKILL.includes(s), s);
  assert.ok(TAO_PHONG.includes('Không chạy script nào của skill tải về trước khi đọc.'));
});

test('every request is analysed before work, and anh is asked once only what needs confirming', () => {
  for (const s of ['tickets.mjs analysis', 'superpowers:brainstorming', 'ask-why-ba', 'Phân tích trước khi giao.',
    'Em hiểu là', 'Anh xác nhận giúp', 'không hỏi thừa', 'giả định'])
    assert.ok(SKILL.includes(s), s);
  assert.ok(SKILL.indexOf('## Phân tích trước khi làm') < SKILL.indexOf('## Nhận một việc'));
});

test('the Trợ lý handles what Leads raise', () => {
  for (const s of ['tickets.mjs issues', 'tickets.mjs resolve', 'Lead báo vấn đề']) assert.ok(SKILL.includes(s), s);
});

test('the skill runs an improvement loop: report, fix, ask anh for rule changes, measure', () => {
  assert.ok(SKILL.includes('## Vòng cải tiến'));
  assert.ok(SKILL.includes('improve.mjs due'));
  for (const s of ['improve.mjs report', 'improve.mjs due', 'improve.mjs done', 'auto-upgrade', 'một tin', 'diff'])
    assert.ok(CAI_TIEN.includes(s), `cai-tien.md: ${s}`);
});

test('the skill has an Auto switch with a hard floor that never changes', () => {
  for (const s of ['## Chế độ Auto', 'departments.mjs auto on', 'departments.mjs auto off', 'departments.mjs auto status', 'Tự quyết (Auto):',
    'Dù Auto bật, vẫn luôn hỏi anh', 'Shift+Tab'])
    assert.ok(SKILL.includes(s), s);
});

test('installing an outside skill as is keeps both checks and never loosens the audit', () => {
  for (const s of ['mode: "installed"', 'qua lớp 2 (`/codex-security-review`)', '**Không nới mẫu chặn của `skill-audit`.**', 'sửa đúng các dòng bị chặn', '`secret-env` thì không sửa',
    'không có script, không dùng key, không gọi dịch vụ ngoài, không có lệnh đăng, gửi hay chi tiền', 'không dùng lệnh cài của kho, không `npx`',
    'đọc từng dòng bản quyền', '**dừng cài thẳng**, coi giấy phép là `"unclear"`', 'git rev-parse HEAD:<tên>', '`tree` đổi: chạy lại cả hai lớp', 'khác thì dừng'])
    assert.ok(TAO_PHONG.includes(s), `tao-phong.md: ${s}`);
});

test('outside skills come in one way: skill-intake, two-layer check, read, then rewrite as our own', () => {
  for (const s of ['skill-intake.mjs', '/codex-security-review', 'KHÔNG chép nguyên mã', 'mode: "learned"', 'mode: "adapted"', '"learned"', '"adapted"', 'source: "new"', 'tool Write',
    'securityReview: { tool: "codex-security-review", verdict: "pass", commit }', '"unclear"', 'GitHub hoặc GitLab', 'source: "gitlab"',
    'File quá 5 MB không được tải về', 'máy chủ không hỗ trợ lọc thì script từ chối kho', 'giới hạn còn lại'])
    assert.ok(TAO_PHONG.includes(s), `tao-phong.md: ${s}`);
  assert.ok(SKILL.includes('KHÔNG chép nguyên mã'));
});
