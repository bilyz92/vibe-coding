import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as S from '../scripts/scaffold.mjs';

const REAL = path.resolve(import.meta.dirname, '../../phong-ky-su/department.json');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'cty-'));
function setup() {
  const env = { COMPANY_DIR: tmp(), SKILLS_DIR: tmp(), CLAUDE_AGENTS_DIR: tmp() };
  fs.mkdirSync(path.join(env.SKILLS_DIR, 'phong-ky-su'));
  fs.copyFileSync(REAL, path.join(env.SKILLS_DIR, 'phong-ky-su', 'department.json'));
  fs.mkdirSync(path.join(env.SKILLS_DIR, '_agents'));
  return env;
}
/** Every file under a folder, with its content, so "nothing changed" can be compared. */
const snapshot = (dir) => fs.readdirSync(dir, { recursive: true }).sort().map((f) => {
  const p = path.join(dir, f); return fs.statSync(p).isFile() ? `${f}:${fs.readFileSync(p, 'utf8')}` : f;
});
const video = () => ({
  name: 'phong-video', title: 'Phòng Video', handles: 'Làm video giới thiệu sản phẩm: kịch bản, dựng, lồng tiếng', skill: 'phong-video',
  allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'], budgetUsd: 10, external: 'Không tự đăng video lên YouTube hay TikTok.',
  roles: [
    { agent: 'video-lead', title: 'Trưởng phòng Video', kind: 'lead', model: 'opus', description: 'Lên kế hoạch video từ phiếu', tools: ['Read', 'Write'] },
    { agent: 'bien-kich', title: 'Biên kịch', kind: 'lam', model: 'sonnet', description: 'Viết kịch bản video', tools: ['Read', 'Write'] },
    { agent: 'dung-video', title: 'Dựng video', kind: 'lam', model: 'sonnet', description: 'Dựng video bằng ffmpeg', tools: ['Read', 'Bash'] },
    { agent: 'kiem-duyet-video', title: 'Kiểm duyệt', kind: 'kiem', model: 'sonnet', description: 'Xem video theo tiêu chí', tools: ['Read'] },
    { agent: 'thu-ky-video', title: 'Thư ký', kind: 'thu-ky', model: 'haiku', description: 'Ghi tiến độ và kết quả vào phiếu', tools: ['Read', 'Bash', 'Write'] },
  ],
  workflow: ['Lead đọc phiếu và lên kế hoạch', 'Biên kịch viết kịch bản', 'Dựng video', 'Kiểm duyệt', 'Anh duyệt trước khi đăng'],
  skills: [
    { name: 'design-taste-frontend', source: 'local' },
    { name: 'remotion-skill', source: 'github', url: 'https://github.com/x/remotion-skill', commit: 'abc1234', audit: { ok: true, blocking: [], info: [] },
      securityReview: { tool: 'codex-security-review', verdict: 'pass', commit: 'abc1234' }, license: 'MIT' },
    { name: 'long-tieng', source: 'new' },
  ],
  machineTools: [{ name: 'ffmpeg', present: false, install: 'sudo apt install ffmpeg' }],
  costs: [{ what: 'Giọng đọc AI', estimate: '~0,3 USD/phút' }],
});

test('addRole creates the agent in both dirs and appends the role', () => {
  const env = setup();
  const r = S.addRole('phong-ky-su', { agent: 'ky-thuat-bao-mat', title: 'Kỹ sư bảo mật', kind: 'lam', model: 'sonnet', tools: ['Read', 'Grep'],
    description: 'Rà soát lỗ hổng bảo mật trong diff trước khi review' }, { env });
  assert.equal(r.created, true);
  const a = fs.readFileSync(path.join(env.SKILLS_DIR, '_agents', 'ky-thuat-bao-mat.md'), 'utf8');
  assert.match(a, /^---\nname: ky-thuat-bao-mat\ndescription: "Rà soát[^\n]*"\ntools: Read, Grep\nmodel: sonnet\n---\n/);
  assert.equal(fs.readFileSync(path.join(env.CLAUDE_AGENTS_DIR, 'ky-thuat-bao-mat.md'), 'utf8'), a);
  const d = JSON.parse(fs.readFileSync(path.join(env.SKILLS_DIR, 'phong-ky-su', 'department.json'), 'utf8'));
  assert.deepEqual(d.roles.at(-1), { agent: 'ky-thuat-bao-mat', title: 'Kỹ sư bảo mật', kind: 'lam', model: 'sonnet' });
  assert.deepEqual(r.files.sort(), ['_agents/ky-thuat-bao-mat.md', 'phong-ky-su/department.json']);
});

test('addRole refuses "trùng" when the agent is already installed, even outside the repo', () => {
  const env = setup();
  fs.writeFileSync(path.join(env.CLAUDE_AGENTS_DIR, 'reviewer.md'), 'x');
  const r = S.addRole('phong-ky-su', { agent: 'reviewer', title: 'R', kind: 'kiem', model: 'sonnet', tools: ['Read'], description: 'Đọc diff' }, { env });
  assert.equal(r.created, false);
  assert.equal(r.reason, 'trùng');
  assert.equal(fs.readFileSync(path.join(env.CLAUDE_AGENTS_DIR, 'reviewer.md'), 'utf8'), 'x');
});

test('addRole refuses "trùng" for a second Lead, and points to the existing one', () => {
  const env = setup();
  const r = S.addRole('phong-ky-su', { agent: 'lead-2', title: 'Lead', kind: 'lead', model: 'opus', tools: ['Read'], description: 'Lên kế hoạch' }, { env });
  assert.deepEqual([r.created, r.reason, r.existing], [false, 'trùng', 'planner']);
});

test('addRole refuses "vượt quyền" for tools the department does not allow', () => {
  const env = setup();
  const p = S.proposeDepartment(video(), { env });
  S.applyProposal(p.id, p.hash, { env });
  const r = S.addRole('phong-video', { agent: 'mxh', title: 'Đăng bài', kind: 'lam', model: 'sonnet', tools: ['Read', 'WebFetch'], description: 'Đăng video' }, { env });
  assert.deepEqual([r.created, r.reason], [false, 'vượt quyền']);
  assert.match(r.detail, /WebFetch/);
});

test('proposeDepartment writes only the proposal, and its summary has every part', () => {
  const env = setup(), before = [snapshot(env.SKILLS_DIR), snapshot(env.CLAUDE_AGENTS_DIR)];
  const p = S.proposeDepartment(video(), { env });
  assert.deepEqual([snapshot(env.SKILLS_DIR), snapshot(env.CLAUDE_AGENTS_DIR)], before);
  assert.match(p.id, /^D-\d{8}-\d{6}-[a-z]{3}$/);
  assert.ok(fs.existsSync(path.join(env.COMPANY_DIR, 'proposals', `${p.id}.json`)));
  for (const s of ['Phòng Video', '5 vai', '5 bước', 'design-taste-frontend', 'có sẵn', 'https://github.com/x/remotion-skill', 'đã kiểm', 'long-tieng', 'tự viết',
    'ffmpeg', 'sudo apt install ffmpeg', 'Giọng đọc AI', '~0,3 USD/phút', p.id, `Anh trả lời "ok ${p.id} ${p.hash.slice(0, 8)}" để lập phòng.`])
    assert.ok(p.summary.includes(s), s);
  assert.equal(S.listProposals({ env, status: 'chờ anh' }).length, 1);
});

test('proposeDepartment refuses a near-duplicate of phong-ky-su', () => {
  const env = setup();
  const s = { ...video(), name: 'phong-code', skill: 'phong-code', handles: 'Việc code: sửa lỗi, tính năng, refactor trong repo git' };
  assert.throws(() => S.proposeDepartment(s, { env }), /Đã có phòng gần giống: phong-ky-su/);
});

test('proposeDepartment refuses a skill that failed or skipped its audit, and tools beyond the department', () => {
  const env = setup();
  const bad = video(); bad.skills[1].audit = { ok: false, blocking: [{ kind: 'sensitive-path' }], info: [] };
  assert.throws(() => S.proposeDepartment(bad, { env }), /remotion-skill/);
  const none = video(); delete none.skills[1].audit;
  assert.throws(() => S.proposeDepartment(none, { env }), /remotion-skill/);
  const wide = video(); wide.roles[1].tools = ['Read', 'WebFetch'];
  assert.throws(() => S.proposeDepartment(wide, { env }), /WebFetch/);
});

test('applyProposal with the right hash builds the department, on probation, and its own tests pass', async () => {
  const env = setup(), { id, hash } = S.proposeDepartment(video(), { env });
  const r = S.applyProposal(id, hash, { env });
  const root = path.join(env.SKILLS_DIR, 'phong-video');
  const d = JSON.parse(fs.readFileSync(path.join(root, 'department.json'), 'utf8'));
  assert.equal(d.status, 'probation');
  const skill = fs.readFileSync(path.join(root, 'SKILL.md'), 'utf8');
  assert.match(skill, /^---\nname: phong-video\n/);
  for (const s of ['Việc ra bên ngoài (đăng, gửi cho người khác, tiêu tiền, gọi dịch vụ trả phí, tạo tài khoản) luôn chờ anh duyệt.',
    'Phòng đang thử việc: mọi kết quả đặt phiếu sang "chờ anh nhận", không tự sang "xong".', 'tickets.mjs', 'video-lead', 'Dựng video', 'tickets.mjs escalate', 'Lead giám sát'])
    assert.ok(skill.includes(s), s);
  for (const a of ['video-lead', 'bien-kich', 'dung-video', 'kiem-duyet-video', 'thu-ky-video']) {
    assert.ok(fs.existsSync(path.join(env.SKILLS_DIR, '_agents', `${a}.md`)), a);
    assert.ok(fs.existsSync(path.join(env.CLAUDE_AGENTS_DIR, `${a}.md`)), a);
  }
  assert.ok(r.files.includes('phong-video/tests/department.test.mjs'));
  assert.equal(S.listProposals({ env, status: 'đã duyệt' }).length, 1);
  const { NODE_TEST_CONTEXT, ...clean } = process.env;   // (else the child reports to this runner, not to its stdout)
  const { stdout } = await promisify(execFile)('node', ['--test', '--test-reporter=tap', path.join(root, 'tests', 'department.test.mjs')], { env: clean });
  assert.match(stdout, /# fail 0|ℹ fail 0/);
});

test('applyProposal refuses once the proposal changed after it was shown', () => {
  const env = setup(), { id, hash } = S.proposeDepartment(video(), { env });
  const f = path.join(env.COMPANY_DIR, 'proposals', `${id}.json`);
  const p = JSON.parse(fs.readFileSync(f, 'utf8')); p.spec.allowedTools.push('WebFetch'); fs.writeFileSync(f, JSON.stringify(p));
  assert.throws(() => S.applyProposal(id, hash, { env }), /Đề xuất đã đổi, cần gửi lại anh/);
  const q = S.proposeDepartment({ ...video(), name: 'phong-video-2', skill: 'phong-video-2', handles: 'Quay phim sự kiện' , roles: video().roles.map((r) => ({ ...r, agent: `${r.agent}-2` })) }, { env });
  assert.throws(() => S.applyProposal(q.id, hash, { env }), /Đề xuất đã đổi, cần gửi lại anh/);
  assert.ok(!fs.existsSync(path.join(env.SKILLS_DIR, 'phong-video')));
});

test('applyProposal refuses a path-like id, a second apply, and writes nothing when an agent already exists', () => {
  const env = setup();
  assert.throws(() => S.applyProposal('../x', 'h', { env }), /Mã không hợp lệ/);
  const { id, hash } = S.proposeDepartment(video(), { env });
  fs.writeFileSync(path.join(env.CLAUDE_AGENTS_DIR, 'dung-video.md'), 'của người khác');
  const before = [snapshot(env.SKILLS_DIR), snapshot(env.CLAUDE_AGENTS_DIR)];
  assert.throws(() => S.applyProposal(id, hash, { env }), /dung-video/);
  assert.deepEqual([snapshot(env.SKILLS_DIR), snapshot(env.CLAUDE_AGENTS_DIR)], before);
  fs.rmSync(path.join(env.CLAUDE_AGENTS_DIR, 'dung-video.md'));
  S.applyProposal(id, hash, { env });
  assert.throws(() => S.applyProposal(id, hash, { env }), /chờ anh/);
});

test('rejectProposal keeps the proposal, marked "từ chối"', () => {
  const env = setup(), { id } = S.proposeDepartment(video(), { env });
  S.rejectProposal(id, { env });
  assert.equal(S.listProposals({ env, status: 'từ chối' })[0].id, id);
});

test('review fix: anh approves with the short code he saw; a hash read back from the file after an edit is refused', () => {
  const env = setup(), p = S.proposeDepartment(video(), { env });
  const code = p.hash.slice(0, 8);
  assert.ok(p.summary.includes(`Anh trả lời "ok ${p.id} ${code}" để lập phòng.`));
  const f = path.join(env.COMPANY_DIR, 'proposals', `${p.id}.json`), q = JSON.parse(fs.readFileSync(f, 'utf8'));
  q.spec.roles[0].tools = ['Read', 'Bash']; q.hash = S.hashSpec(q.spec); fs.writeFileSync(f, JSON.stringify(q));
  assert.throws(() => S.applyProposal(p.id, code, { env }), /Đề xuất đã đổi, cần gửi lại anh/);
  assert.throws(() => S.applyProposal(p.id, 'abc', { env }), /mã duyệt/);
});

test('review fix: the summary shows tools, budget and any hand-written instructions', () => {
  const env = setup(), s = video(); s.roles[2].body = 'Luôn dựng bằng ffmpeg trước.';
  const { summary } = S.proposeDepartment(s, { env });
  for (const x of ['Công cụ phòng: Read, Write, Edit, Bash, Glob, Grep', 'dung-video: Read, Bash', 'Ngân sách mỗi việc: 10 USD', 'Luôn dựng bằng ffmpeg trước.'])
    assert.ok(summary.includes(x), x);
});

test('review fix: a new department cannot ask for "all" tools', () => {
  const env = setup();
  assert.throws(() => S.proposeDepartment({ ...video(), allowedTools: 'all' }, { env }), /allowedTools/);
});

test('review fix: an apply that fails half-way leaves nothing behind and can be retried', () => {
  const env = setup(), { id, hash } = S.proposeDepartment(video(), { env });
  const before = [snapshot(env.SKILLS_DIR), snapshot(env.CLAUDE_AGENTS_DIR)];
  fs.chmodSync(env.CLAUDE_AGENTS_DIR, 0o555);
  try { assert.throws(() => S.applyProposal(id, hash, { env })); } finally { fs.chmodSync(env.CLAUDE_AGENTS_DIR, 0o755); }
  assert.deepEqual([snapshot(env.SKILLS_DIR), snapshot(env.CLAUDE_AGENTS_DIR)], before);
  assert.equal(S.listProposals({ env, status: 'chờ anh' }).length, 1);
  assert.ok(S.applyProposal(id, hash, { env }).files.length > 0);
});

test('review fix: listProposals skips a file without its spec', () => {
  const env = setup();
  fs.mkdirSync(path.join(env.COMPANY_DIR, 'proposals'), { recursive: true });
  fs.writeFileSync(path.join(env.COMPANY_DIR, 'proposals', 'D-1.json'), JSON.stringify({ id: 'D-1', status: 'chờ anh' }));
  assert.equal(S.listProposals({ env }).length, 0);
});

test('codex fix: outside skill names and role tool names are plain', () => {
  const env = setup();
  const s = video(); s.skills[1].name = '../../evil';
  assert.throws(() => S.proposeDepartment(s, { env }), /skill/);
  const r = S.addRole('phong-ky-su', { agent: 'x-role', title: 'X', kind: 'lam', model: 'sonnet', tools: ['Read\nmodel: opus'], description: 'việc x' }, { env });
  assert.equal(r.created, false);
});

test('codex fix: two pending proposals for the same department are refused', () => {
  const env = setup();
  S.proposeDepartment(video(), { env });
  assert.throws(() => S.proposeDepartment({ ...video(), roles: video().roles.map((r) => ({ ...r, agent: `${r.agent}-b` })) }, { env }), /đang chờ/);
});

test('codex fix: addRole that fails writing the manifest leaves no agent behind', () => {
  const env = setup();
  const man = path.join(env.SKILLS_DIR, 'phong-ky-su');
  fs.chmodSync(man, 0o555);
  try {
    assert.throws(() => S.addRole('phong-ky-su', { agent: 'bao-mat', title: 'Bảo mật', kind: 'lam', model: 'sonnet', tools: ['Read'], description: 'rà lỗ hổng' }, { env }));
  } finally { fs.chmodSync(man, 0o755); }
  assert.ok(!fs.existsSync(path.join(env.SKILLS_DIR, '_agents', 'bao-mat.md')));
  assert.ok(!fs.existsSync(path.join(env.CLAUDE_AGENTS_DIR, 'bao-mat.md')));
});

test('codex r2: two processes proposing the same department at once make one proposal', async () => {
  const env = setup(), f = path.join(env.COMPANY_DIR, 'spec.json');
  fs.writeFileSync(f, JSON.stringify(video()));
  const CLI = path.resolve(import.meta.dirname, '../scripts/scaffold.mjs'), run = promisify(execFile);
  const r = await Promise.allSettled(Array.from({ length: 4 }, () => run('node', [CLI, 'propose', '--json', f], { env: { ...process.env, ...env } })));
  assert.equal(r.filter((x) => x.status === 'fulfilled').length, 1);
  assert.equal(S.listProposals({ env }).length, 1);
});

test('codex: generated frontmatter is valid even with ": " in texts, and every agent carries the hard rules', () => {
  const env = setup(), s = video();
  s.title = 'Phòng Video: thử'; s.roles[0].description = 'Lead: lên kế hoạch video: cảnh, độ dài';
  const { id, hash } = S.proposeDepartment(s, { env });
  S.applyProposal(id, hash.slice(0, 8), { env });
  const fm = (f) => /^---\n([\s\S]*?)\n---\n/.exec(fs.readFileSync(f, 'utf8'))[1];
  const desc = (f) => { const l = fm(f).split('\n').find((x) => x.startsWith('description: ')).slice(13); return JSON.parse(l); };
  assert.match(desc(path.join(env.SKILLS_DIR, 'phong-video', 'SKILL.md')), /Phòng Video: thử/);
  assert.equal(desc(path.join(env.SKILLS_DIR, '_agents', 'video-lead.md')), 'Lead: lên kế hoạch video: cảnh, độ dài');
  for (const a of ['video-lead', 'bien-kich', 'dung-video', 'kiem-duyet-video', 'thu-ky-video']) {
    const t = fs.readFileSync(path.join(env.SKILLS_DIR, '_agents', `${a}.md`), 'utf8');
    assert.ok(t.includes('Việc ra bên ngoài (đăng, gửi cho người khác, tiêu tiền, gọi dịch vụ trả phí, tạo tài khoản) luôn chờ anh duyệt.'), a);
    assert.ok(t.includes('chờ anh nhận'), a);
  }
});

test('codex r1: a GitHub skill needs the second check, a passing codex-security-review of the same commit', () => {
  const env = setup();
  const p = S.proposeDepartment(video(), { env });
  assert.ok(p.summary.includes('đã kiểm 2 lớp'), p.summary);
  for (const sr of [undefined, { tool: 'codex-security-review', verdict: 'fail', commit: 'abc1234' },
    { tool: 'codex-security-review', verdict: 'pass', commit: 'def5678' }, { tool: 'codex-security-review', verdict: 'pass' },
    { tool: 'other-review', verdict: 'pass', commit: 'abc1234' }, 'pass']) {
    const s = { ...video(), name: 'phong-video-x', skill: 'phong-video-x', roles: video().roles.map((r) => ({ ...r, agent: `${r.agent}-x` })) };
    if (sr === undefined) delete s.skills[1].securityReview; else s.skills[1].securityReview = sr;
    assert.throws(() => S.proposeDepartment(s, { env }), /remotion-skill[^;]*security/, JSON.stringify(sr));
  }
  assert.equal(S.listProposals({ env }).length, 1);
});

test('review M7: a GitLab skill is taken like a GitHub one: url, commit, audit and a passing security review of that commit', () => {
  const env = setup();
  const gl = (patch = {}) => {
    const s = { ...video(), name: 'phong-video-gl', skill: 'phong-video-gl', roles: video().roles.map((r) => ({ ...r, agent: `${r.agent}-gl` })) };
    s.skills[1] = { name: 'remotion-skill', source: 'gitlab', url: 'https://gitlab.com/g/sub/remotion-skill', commit: 'abc1234',
      audit: { ok: true, blocking: [], info: [] }, securityReview: { tool: 'codex-security-review', verdict: 'pass', commit: 'abc1234' }, license: 'MIT', ...patch };
    return s;
  };
  for (const patch of [{ url: undefined }, { commit: undefined }, { audit: undefined }, { securityReview: undefined },
    { securityReview: { tool: 'codex-security-review', verdict: 'pass', commit: 'def5678' } }])
    assert.throws(() => S.proposeDepartment(gl(patch), { env }), /remotion-skill/, JSON.stringify(patch));
  const p = S.proposeDepartment(gl(), { env });
  assert.ok(p.summary.includes('remotion-skill (GitLab https://gitlab.com/g/sub/remotion-skill @abc1234, giấy phép MIT, đã kiểm 2 lớp)'), p.summary);
});

test('review M2: a {{...}} written in a text is kept as written, never filled by a later placeholder', () => {
  const env = setup(), s = video();
  s.handles = 'Làm video {{workflow}} theo phiếu'; s.roles[1].description = 'Viết kịch bản {{external}} và {{name}}';
  const { id, hash } = S.proposeDepartment(s, { env });
  S.applyProposal(id, hash, { env });
  const fm = (t) => /^---\n([\s\S]*?)\n---\n/.exec(t)[1];
  const desc = (t) => JSON.parse(fm(t).split('\n').find((x) => x.startsWith('description: ')).slice(13));
  const skill = fs.readFileSync(path.join(env.SKILLS_DIR, 'phong-video', 'SKILL.md'), 'utf8');
  assert.deepEqual(fm(skill).split('\n').map((l) => l.split(':')[0]), ['name', 'description']);
  assert.match(desc(skill), /Làm video \{\{workflow\}\} theo phiếu/);
  assert.ok(skill.includes('Phòng nhận việc: Làm video {{workflow}} theo phiếu.'));
  const agent = fs.readFileSync(path.join(env.SKILLS_DIR, '_agents', 'bien-kich.md'), 'utf8');
  assert.deepEqual(fm(agent).split('\n').map((l) => l.split(':')[0]), ['name', 'description', 'tools', 'model']);
  assert.equal(desc(agent), 'Viết kịch bản {{external}} và {{name}}');
  assert.ok(agent.includes(`- ${s.external}`));
});

test('codex CR-dws #3: apply re-runs every proposal check: a pending proposal without the second security layer is refused', () => {
  const env = setup(), p = S.proposeDepartment(video(), { env });
  const f = path.join(env.COMPANY_DIR, 'proposals', `${p.id}.json`), q = JSON.parse(fs.readFileSync(f, 'utf8'));
  delete q.spec.skills[1].securityReview; q.hash = S.hashSpec(q.spec); fs.writeFileSync(f, JSON.stringify(q));   // (an older proposal, made before the gate)
  assert.throws(() => S.applyProposal(p.id, q.hash.slice(0, 8), { env }), /lớp kiểm 2/);
  assert.equal(fs.existsSync(path.join(env.SKILLS_DIR, 'phong-video')), false);
});

test('a direct install needs a clear license and the same tree in the proposal, the audit and the security review', () => {
  const env = setup(), tree = 'a'.repeat(40), s = { ...video(), name: 'phong-video-t', skill: 'phong-video-t', roles: video().roles.map((r) => ({ ...r, agent: `${r.agent}-t` })) };
  const sk = s.skills[1]; Object.assign(sk, { mode: 'installed' });
  assert.throws(() => S.proposeDepartment(s, { env }), /cài thẳng/);
  Object.assign(sk, { tree, audit: { ...sk.audit, tree }, securityReview: { ...sk.securityReview, tree: 'b'.repeat(40) } });
  assert.throws(() => S.proposeDepartment(s, { env }), /cài thẳng/);
  sk.securityReview.tree = tree;
  for (const license of ['unclear', 'GPL-3.0', 'MPL-2.0', 'ISC', 'Proprietary']) {
    sk.license = license;
    assert.throws(() => S.proposeDepartment(s, { env }), /cài thẳng/, license);
  }
  sk.license = 'MIT';
  assert.ok(S.proposeDepartment(s, { env }).summary.includes(`cài thẳng cây ${tree.slice(0, 12)}`));
});

test('codex CR-dws #2: an outside skill carries the license verdict of intake, and anh sees it in the one message', () => {
  const env = setup(), s = { ...video(), name: 'phong-video-l', skill: 'phong-video-l', roles: video().roles.map((r) => ({ ...r, agent: `${r.agent}-l` })) };
  delete s.skills[1].license;
  assert.throws(() => S.proposeDepartment(s, { env }), /remotion-skill[^;]*giấy phép/);
  s.skills[1].license = 'unclear';
  const p = S.proposeDepartment(s, { env });
  assert.ok(p.summary.includes('giấy phép chưa rõ (chỉ học ý tưởng, tự viết lại)'), p.summary);
});
