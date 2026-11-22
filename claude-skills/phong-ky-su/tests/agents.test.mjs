// node --test ~/.claude/skills/phong-ky-su/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.resolve(import.meta.dirname, '../../_agents');
function agent(name) {
  const text = fs.readFileSync(path.join(DIR, `${name}.md`), 'utf8');
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
  assert.ok(m, `${name}: frontmatter`);
  const fm = Object.fromEntries(m[1].split('\n').map((l) => /^(\w+):\s*(.*)$/.exec(l)).filter(Boolean).map((x) => [x[1], x[2].trim()]));
  return { fm, body: m[2], tools: (fm.tools || '').split(',').map((t) => t.trim()).filter(Boolean) };
}

// Each role runs on the cheapest model its work allows: planning and code on opus, checklist work on sonnet, notes on haiku.
const MODEL = { ba: 'sonnet', tester: 'sonnet', 'release-ops': 'sonnet', 'thu-ky': 'haiku' };
for (const name of Object.keys(MODEL)) {
  test(`${name}: frontmatter names it, says what it is for, runs on ${MODEL[name]}, lists its tools`, () => {
    const a = agent(name);
    assert.equal(a.fm.name, name);
    assert.ok(a.fm.description?.length > 40);
    assert.equal(a.fm.model, MODEL[name]);
    assert.ok(a.tools.length > 0);
  });
}

for (const name of ['planner', 'coding']) test(`${name} runs on opus`, () => assert.equal(agent(name).fm.model, 'opus'));

test('tester can never edit code', () => {
  const a = agent('tester');
  for (const t of ['Edit', 'Write', 'NotebookEdit']) assert.ok(!a.tools.includes(t), t);
  for (const s of ['ĐẠT', 'KHÔNG ĐẠT', 'không sửa code']) assert.ok(a.body.includes(s), s);
});

test('ba writes acceptance criteria as Given / When / Then', () => {
  const a = agent('ba');
  for (const s of ['Given', 'When', 'Then', 'user-story-ac-writer']) assert.ok(a.body.includes(s), s);
  for (const t of ['Edit', 'Write']) assert.ok(!a.tools.includes(t), t);
});

test('release-ops deploys through safe-deploy', () => assert.ok(agent('release-ops').body.includes('safe-deploy')));

test('thu-ky reports the four headings through progress.mjs', () => {
  const a = agent('thu-ky');
  for (const s of ['Xong', 'Đang làm', 'Chờ anh', 'Chờ đối tác', 'progress.mjs']) assert.ok(a.body.includes(s), s);
});

test('tester can pass only part of the criteria, and says which are unverified', () => {
  const a = agent('tester');
  assert.ok(a.body.includes('ĐẠT MỘT PHẦN'));
  assert.match(a.body, /chưa kiểm được/i);
});

test('release-ops checks main by the merge commit, with the full script path', () => {
  const a = agent('release-ops');
  assert.ok(a.body.includes('~/.claude/skills/phong-ky-su/scripts/guards.mjs main <owner/repo> <sha>'));
  assert.ok(a.body.includes('guards.mjs merge <owner/repo> <pr>'));
});

test('thu-ky writes the result into the ticket when there is one', () => {
  const a = agent('thu-ky');
  assert.ok(a.body.includes('tickets.mjs result <id>'));
  assert.equal(a.fm.model, 'haiku');
});

test('thu-ky passes text to progress.mjs through a JSON file written with Write', () => {
  const a = agent('thu-ky');
  assert.ok(a.body.includes('--json'));
  assert.match(a.body, /tool Write/);
});

test('truc-production only uses a read-only SSH alias and refuses without one', () => {
  const a = agent('truc-production');
  for (const s of ['-ro', 'command=', 'restrict', 'từ chối', 'need: \\"anh\\"']) assert.ok(a.body.includes(s), s);
});

test('release-ops names the default branch from preflight, never a fixed main', () => {
  const a = agent('release-ops');
  assert.ok(a.body.includes('<defaultBranch>'));
  assert.ok(!/\*\*`main` đỏ/.test(a.body));
});

test('coding carries the multi-layer review and the UI / DESIGN.md rules', () => {
  const a = agent('coding');
  assert.equal(a.fm.model, 'opus');
  for (const s of ['## Quy trình review (nhiều lớp)', 'Lớp 2 — Codex review đối kháng', 'Lớp 3 — Reviewer thứ hai', 'reverse-engineer-anything',
    'DESIGN.md (format của google-labs-code/design.md)', '@google/design.md lint'])
    assert.ok(a.body.includes(s), s);
});

test('coding marks temporary work, lists what is left, and a shortcut excuses nothing', () => {
  const b = agent('coding').body;
  for (const s of ['`shortcut: <giới hạn>, <khi nào nâng cấp>`', 'không miễn được lỗi bảo mật', 'không dùng để bỏ qua test',
    '`/ponytail-debt`', 'mục **Còn lại**', '"không còn gì"']) assert.ok(b.includes(s), s);
});

test('each role names the skills it uses', () => {
  const skills = { ba: ['use-case-writer'], tester: ['ui-ux-review', 'vibesec', 'fixing-accessibility'],
    'release-ops': ['prisma-migration-safety'], 'thu-ky': ['local-docs', 'long-session'] };
  for (const [name, list] of Object.entries(skills))
    for (const s of list) assert.ok(agent(name).body.includes(`\`${s}\``), `${name}: ${s}`);
  const t = agent('tester').body;
  assert.ok(t.includes('kết quả `vibesec` do điều phối chạy; Tester đọc kết quả khi kiểm'));
  assert.ok(!/Dockerfile/.test(t), 'tester does not repeat the vibesec triggers');
});
