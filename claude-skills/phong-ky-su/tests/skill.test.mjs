// node --test ~/.claude/skills/phong-ky-su/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { preflight } from '../scripts/preflight.mjs';

const SKILL = fs.readFileSync(path.resolve(import.meta.dirname, '../SKILL.md'), 'utf8');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'phong-skill-'));

test('the skill names itself and covers the whole department and its rules', () => {
  assert.match(SKILL, /^---\nname: phong-ky-su\n/);
  for (const s of ['ba', 'planner', 'coding', 'tester', 'release-ops', 'thu-ky', 'truc-production',
    'preflight', 'parallelGroups', 'recordReturn', 'mainStatus', 'revertPlan', 'PushNotification', 'pending add', 'code-review',
    'Xong / Đang làm / Chờ anh / Chờ đối tác', '[phòng-kỹ-sư]', 'PHONG_KY_SU_BUDGET_USD', 'checklist',
    '/codex-plan-review', '/codex-impl-review', '/codex-security-review', 'safe-deploy', 'progress.mjs'])
    assert.ok(SKILL.includes(s), s);
});

test('the stage report always says what is left, through the report script', () => {
  const step = SKILL.slice(SKILL.indexOf('9. **Thư ký**'), SKILL.indexOf('## Sáu chốt an toàn'));
  for (const s of ['`Còn lại: …`', '`doing`', 'nợ `shortcut:`', 'cái chưa kiểm', 'cái chờ anh', '`Còn lại: không còn gì`']) assert.ok(step.includes(s), s);
});

test('the skill takes a ticket from the Trợ lý giám đốc and writes its result back', () => {
  for (const s of ['phiếu <id>', 'tickets.mjs status <id> "đang làm"', 'tickets.mjs result <id>', 'tickets.mjs escalate <id>']) assert.ok(SKILL.includes(s), s);
});

test('the ledger line and the lesson are compulsory steps, which tickets.mjs result checks', () => {
  for (const s of ['`<id>` = mã phiếu', 'Bắt buộc', '"lesson": "không có"']) assert.ok(SKILL.includes(s), s);
});

/** A git repo with an origin on GitHub, and a fake gh driven by FAKE_* variables. */
function setup() {
  const dir = tmp(), bin = tmp(), g = (...a) => execFileSync('git', a, { cwd: dir, encoding: 'utf8' });
  g('init', '-q'); g('config', 'user.email', 't@t'); g('config', 'user.name', 't');
  fs.writeFileSync(path.join(dir, 'f.js'), 'x\n'); g('add', '-A'); g('commit', '-qm', 'i');
  g('remote', 'add', 'origin', 'git@github.com:owner/repo.git');
  fs.writeFileSync(path.join(bin, 'gh'), `#!/bin/sh
case "$1 $2" in
  "auth status") exit \${FAKE_AUTH:-0} ;;
  "repo view") if [ -n "$FAKE_REPO" ]; then echo "$FAKE_REPO"; else echo '{"viewerPermission":"WRITE","autoMergeAllowed":true,"defaultBranchRef":{"name":"main"}}'; fi ;;
  "api repos/owner/repo/branches/main") [ -n "$FAKE_BRANCH" ] && echo "$FAKE_BRANCH" || { echo "Not Found" >&2; exit 1; } ;;
  "api repos/owner/repo/rules/branches/main") [ -n "$FAKE_RULES" ] && echo "$FAKE_RULES" || echo "[]" ;;
esac
`, { mode: 0o755 });
  const env = (extra) => ({ ...process.env, PATH: `${bin}:${process.env.PATH}`, ...extra });
  return { dir, env };
}
const BRANCH_WITH_CHECKS = '{"protected":true,"protection":{"required_status_checks":{"contexts":["CI (Node 20)"]}}}';

test('preflight: all set', async () => {
  const { dir, env } = setup();
  assert.deepEqual(await preflight(dir, { env: env({ FAKE_BRANCH: BRANCH_WITH_CHECKS }) }), { ok: true, problems: [], warnings: [], platform: 'github', repo: 'owner/repo', defaultBranch: 'main', autoMerge: true, requiredChecks: ['CI (Node 20)'] });
});

test('preflight: required checks set through a ruleset count too', async () => {
  const { dir, env } = setup();
  const r = await preflight(dir, { env: env({ FAKE_BRANCH: '{"protected":false}', FAKE_RULES: '[{"type":"required_status_checks","parameters":{"required_status_checks":[{"context":"CI"}]}}]' }) });
  assert.equal(r.autoMerge, true);
});

test('preflight: protection with no required checks does not crash, and turns auto-merge off', async () => {
  const { dir, env } = setup();
  const r = await preflight(dir, { env: env({ FAKE_BRANCH: '{"protected":true,"protection":{"required_status_checks":null}}' }) });
  assert.equal(r.ok, true); assert.equal(r.autoMerge, false);
  assert.ok(r.warnings.some((w) => w.includes('auto-merge')));
});

test('preflight: a repo that does not allow auto-merge is caught before any work', async () => {
  const { dir, env } = setup();
  const r = await preflight(dir, { env: env({ FAKE_BRANCH: BRANCH_WITH_CHECKS, FAKE_REPO: '{"viewerPermission":"WRITE","autoMergeAllowed":false,"defaultBranchRef":{"name":"main"}}' }) });
  assert.equal(r.ok, true);
  assert.equal(r.autoMerge, false);
  assert.ok(r.warnings.some((w) => w.includes('Allow auto-merge')));
});

test('preflight: protection it cannot read says so instead of "no checks"', async () => {
  const { dir, env } = setup();
  const r = await preflight(dir, { env: env({ FAKE_RULES: 'x' }) });
  assert.equal(r.autoMerge, false);
  assert.ok(r.warnings.some((w) => w.includes('không đọc được')));
});

test('preflight: gh not signed in stops it, saying what to run', async () => {
  const { dir, env } = setup();
  const r = await preflight(dir, { env: env({ FAKE_AUTH: '1' }) });
  assert.equal(r.ok, false);
  assert.ok(r.problems.some((p) => p.includes('gh auth login')));
});

test('preflight: read-only access stops it', async () => {
  const { dir, env } = setup();
  const r = await preflight(dir, { env: env({ FAKE_REPO: '{"viewerPermission":"READ","autoMergeAllowed":true,"defaultBranchRef":{"name":"main"}}' }) });
  assert.equal(r.ok, false);
  assert.ok(r.problems.some((p) => p.includes('quyền')));
});

test('preflight: uncommitted changes on the main checkout stop it', async () => {
  const { dir, env } = setup();
  fs.writeFileSync(path.join(dir, 'f.js'), 'changed\n');
  const r = await preflight(dir, { env: env({ FAKE_BRANCH: BRANCH_WITH_CHECKS }) });
  assert.equal(r.ok, false);
  assert.ok(r.problems.some((p) => p.includes('chưa commit')));
});

test('preflight: not a git repo', async () => {
  const r = await preflight(tmp(), { env: process.env });
  assert.equal(r.ok, false);
  assert.ok(r.problems.some((p) => p.includes('git')));
});

test('the skill handles a partial pass, and checks main by the merge commit after a merge', () => {
  for (const s of ['ĐẠT MỘT PHẦN', 'mergeCommit', 'guards.mjs merge', 'guards.mjs main <owner/repo> <sha>', 'unknown'])
    assert.ok(SKILL.includes(s), s);
});

/** A git repo with an origin on GitLab (a group in a group), and a fake glab driven by FAKE_* variables. */
function setupGitlab() {
  const dir = tmp(), bin = tmp(), g = (...a) => execFileSync('git', a, { cwd: dir, encoding: 'utf8' });
  g('init', '-q'); g('config', 'user.email', 't@t'); g('config', 'user.name', 't');
  fs.writeFileSync(path.join(dir, 'f.js'), 'x\n'); g('add', '-A'); g('commit', '-qm', 'i');
  g('remote', 'add', 'origin', 'git@gitlab.com:heytek/team/my-company.git');
  fs.writeFileSync(path.join(bin, 'glab'), `#!/bin/sh
P=heytek%2Fteam%2Fmy-company
case "$1 $2" in
  "auth status") exit \${FAKE_AUTH:-0} ;;
  "api projects/$P") if [ -n "$FAKE_PROJECT" ]; then echo "$FAKE_PROJECT"; else echo '{"default_branch":"master","only_allow_merge_if_pipeline_succeeds":true,"permissions":{"project_access":null,"group_access":{"access_level":50}}}'; fi ;;
  "api projects/$P/repository/branches/master") if [ -n "$FAKE_BRANCH_FAIL" ]; then echo "$FAKE_BRANCH_FAIL" >&2; exit 1; elif [ -n "$FAKE_BRANCH_INFO" ]; then echo "$FAKE_BRANCH_INFO"; else echo '{"name":"master","protected":true}'; fi ;;
  "api projects/$P/protected_branches?per_page=100") if [ -n "$FAKE_PROT_LIST" ]; then echo "$FAKE_PROT_LIST"; else echo '[{"name":"master","merge_access_levels":[{"access_level":40}]}]'; fi ;;
  "api projects/$P/repository/files/.gitlab-ci.yml?ref=master") [ -z "$FAKE_NO_CI" ] && echo '{"file_name":".gitlab-ci.yml"}' || { echo "404 Not Found" >&2; exit 1; } ;;
esac
`, { mode: 0o755 });
  const env = (extra) => ({ ...process.env, PATH: `${bin}:${process.env.PATH}`, ...extra });
  return { dir, env };
}

test('preflight on GitLab: all set (nested group, master, pipeline must succeed)', async () => {
  const { dir, env } = setupGitlab();
  assert.deepEqual(await preflight(dir, { env: env() }),
    { ok: true, problems: [], warnings: [], platform: 'gitlab', repo: 'heytek/team/my-company', defaultBranch: 'master', autoMerge: true, requiredChecks: ['pipeline'] });
});

test('preflight on GitLab: no pipeline, or pipelines not required, turns auto-merge off and says so', async () => {
  const { dir, env } = setupGitlab();
  const noCi = await preflight(dir, { env: env({ FAKE_NO_CI: '1' }) });
  assert.equal(noCi.autoMerge, false); assert.ok(noCi.warnings.some((w) => w.includes('.gitlab-ci.yml')));
  const loose = await preflight(dir, { env: env({ FAKE_PROJECT: '{"default_branch":"master","only_allow_merge_if_pipeline_succeeds":false,"permissions":{"project_access":{"access_level":40}}}' }) });
  assert.equal(loose.autoMerge, false); assert.ok(loose.warnings.some((w) => w.includes('Pipelines must succeed')));
});

test('preflight on GitLab: glab not signed in, Reporter access, or no right to merge into master', async () => {
  const { dir, env } = setupGitlab();
  assert.ok((await preflight(dir, { env: env({ FAKE_AUTH: '1' }) })).problems.some((p) => p.includes('glab auth login')));
  const rep = await preflight(dir, { env: env({ FAKE_PROJECT: '{"default_branch":"master","only_allow_merge_if_pipeline_succeeds":true,"permissions":{"project_access":{"access_level":20}}}' }) });
  assert.equal(rep.ok, false); assert.ok(rep.problems.some((p) => p.includes('quyền')));
  const dev = await preflight(dir, { env: env({ FAKE_PROJECT: '{"default_branch":"master","only_allow_merge_if_pipeline_succeeds":true,"permissions":{"project_access":{"access_level":30}}}' }) });
  assert.equal(dev.ok, true); assert.equal(dev.autoMerge, false); assert.ok(dev.warnings.some((w) => w.includes('merge vào master')));
});

test('the skill opens and auto-merges MRs on GitLab', () => {
  for (const s of ['glab mr create', 'glab mr merge', '--auto-merge', '--gitlab', 'platform']) assert.ok(SKILL.includes(s), s);
});

test('preflight on GitLab: unreadable branch protection, or only per-user rules, never turns auto-merge on', async () => {
  const { dir, env } = setupGitlab();
  const broken = await preflight(dir, { env: env({ FAKE_BRANCH_FAIL: '500 Internal Server Error' }) });
  assert.equal(broken.autoMerge, false); assert.ok(broken.warnings.some((w) => w.includes('không đọc được')));
  const open = await preflight(dir, { env: env({ FAKE_BRANCH_INFO: '{"name":"master","protected":false}' }) });
  assert.equal(open.autoMerge, true);
  const perUser = await preflight(dir, { env: env({ FAKE_PROT_LIST: '[{"name":"master","merge_access_levels":[{"access_level":40,"user_id":7}]}]' }) });
  assert.equal(perUser.autoMerge, false); assert.ok(perUser.warnings.some((w) => w.includes('merge vào master')));
});

test('preflight on GitLab: every matching rule counts, exact and wildcard, the most permissive wins', async () => {
  const { dir, env } = setupGitlab();
  const devProject = '{"default_branch":"master","only_allow_merge_if_pipeline_succeeds":true,"permissions":{"project_access":{"access_level":30}}}';
  const onlyWild = '[{"name":"rel-*","merge_access_levels":[{"access_level":30}]},{"name":"*","merge_access_levels":[{"access_level":40}]}]';
  assert.equal((await preflight(dir, { env: env({ FAKE_PROJECT: devProject, FAKE_PROT_LIST: onlyWild }) })).autoMerge, false);
  assert.equal((await preflight(dir, { env: env({ FAKE_PROT_LIST: onlyWild }) })).autoMerge, true);   // (Owner, 50)
  const exactPlusWild = '[{"name":"master","merge_access_levels":[{"access_level":40}]},{"name":"mast*","merge_access_levels":[{"access_level":30}]}]';
  assert.equal((await preflight(dir, { env: env({ FAKE_PROJECT: devProject, FAKE_PROT_LIST: exactPlusWild }) })).autoMerge, true);   // (the wildcard lets Developers merge)
  assert.equal((await preflight(dir, { env: env({ FAKE_PROT_LIST: 'x' }) })).autoMerge, false);
});

test('before merge, the diff is scanned by what it touches', () => {
  for (const s of ['prisma/migrations', 'prisma-migration-safety', `'use server'`, '"use server"', 'nextjs-server-action-security',
    'Dockerfile', 'CORS', 'vibesec', '/codex-security-review', 'Lỗi chặn từ các skill này tính như KHÔNG ĐẠT',
    '`git diff --name-only origin/<defaultBranch>`', '`git ls-files --others --exclude-standard`', 'trong worktree của việc, trước review/commit'])
    assert.ok(SKILL.includes(s), s);
  assert.ok(!SKILL.includes('git diff --name-only origin/<defaultBranch>...'), 'the scan must see uncommitted work');
});

test('the skill says who commits, and which reviewer runs when', () => {
  assert.ok(SKILL.includes('Điều phối (phiên chính) là người commit, sau review APPROVE và hook commit-gate; subagent không commit/push'));
  assert.ok(SKILL.includes('## Reviewer nào khi nào'));
  for (const [who, when] of [['/codex-impl-review', 'mọi việc'], ['/codex-security-review', 'nhạy cảm'], ['code-review', 'hết quota'], ['/codex-plan-review', 'kế hoạch']])
    assert.match(SKILL, new RegExp(`\\| \`${who}\`[^|\\n]*\\|[^\\n]*${when}`), who);
});

/** The text of the section whose heading holds `word`, up to the next `## `. */
const section = (word) => { const m = SKILL.match(new RegExp(`^## [^\\n]*${word}[^\\n]*\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'm')); return m ? m[1] : ''; };

test('AC-15: a "Mức" section: day-du as today, nhanh under 3 files / 150 lines not counting tests, forced by a word', () => {
  const s = section('Mức');
  assert.ok(s, 'section ## …Mức…');
  for (const x of ['`day-du`', '`nhanh`', '3 file', '150 dòng', 'không tính file test', 'ép', 'câu giao việc']) assert.ok(s.includes(x), x);
});

test('AC-16 / AC-17: what nhanh keeps and what it skips', () => {
  const s = section('Mức'), keep = s.match(/\*\*giữ\*\*[^\n]*/)?.[0] || '', skip = s.match(/\*\*bỏ\*\*[^\n]*/)?.[0] || '';
  for (const x of ['tiêu chí ngắn do điều phối viết', 'TDD', 'lint/typecheck/test', '`/codex-impl-review` tới APPROVE', 'CI xanh trước merge']) assert.ok(keep.includes(x), x);
  for (const x of ['agent `ba`', '`planner`', '`/codex-plan-review`', 'agent `tester`']) assert.ok(skip.includes(x), x);
  for (const x of ['`/codex-impl-review`', 'CI']) assert.ok(!skip.includes(x), `nhanh never skips ${x}`);
});

test('AC-18: sensitive or too big -> day-du with catch-up; recheck before review; the ledger is kept and summarized', () => {
  const s = section('Mức');
  for (const x of ['nhạy cảm', 'vượt ngưỡng', 'tự nâng `day-du`', 'chạy bù', 'rigor.mjs recheck', 'ledger.mjs', 'start', 'merge', 'round', 'escape', 'summary', 'lỗi lọt'])
    assert.ok(s.includes(x), x);
  const flow = section('Dòng chảy'), at = (x) => flow.indexOf(x);
  assert.ok(at('0. **Preflight**') < at('ledger.mjs start') && at('ledger.mjs start') < at('1. **BA**'), 'level + ledger start in step 0');
  assert.ok(at('rigor.mjs choose') > at('0. **Preflight**') && at('rigor.mjs choose') < at('1. **BA**'), 'level chosen in step 0');
  assert.ok(at('4. **Tester**') < at('rigor.mjs recheck') && at('rigor.mjs recheck') < at('5. **Review**'), 'recheck right before review');
  assert.ok(at('5. **Review**') < at('ledger.mjs round') && at('ledger.mjs round') < at('6. **PR / MR**'), 'one round per Codex pass');
  assert.ok(at('7. **Sau merge**') < at('ledger.mjs merge') && at('ledger.mjs merge') < at('8. **Deploy**'), 'merge time after merge');
});
