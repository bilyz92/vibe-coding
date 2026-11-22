#!/usr/bin/env node
// Phòng Kỹ sư phần mềm — before a task starts: is this a git repo on GitHub or GitLab, is gh / glab signed in, may we
// push and open PRs / MRs, is the main checkout clean, and may the department auto-merge. GitHub: the repo allows it and
// the default branch requires CI checks (branch protection or a ruleset; without them `gh pr merge --auto` merges at
// once). GitLab: the project has a .gitlab-ci.yml, "Pipelines must succeed" is on (else `glab mr merge --auto-merge`
// merges at once), and we may merge into the protected default branch. Neither needs admin rights.
// -> { ok, problems (blocking), warnings, platform, repo, defaultBranch, autoMerge, requiredChecks }.
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const run = (cmd, args, opts) => new Promise((resolve) => execFile(cmd, args, { timeout: 20_000, ...opts }, (err, out, errOut) => resolve({ ok: !err, out: String(out || '').trim(), err: String(errOut || '') })));
const json = (s) => { try { return JSON.parse(s); } catch { return undefined; } };
const fail = (problems, repo = null, platform = null) => ({ ok: false, problems, warnings: [], platform, repo, defaultBranch: null, autoMerge: false });

/** Tracked changes only: the department works in worktrees cut from origin, so files the tools keep in the main
    checkout (PROGRESS.md, .codex-review/) never reach a PR; a status that can't be read is a problem in itself. */
async function dirtyProblem(repoDir, env) {
  const dirty = await run('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: repoDir, env });
  if (!dirty.ok) return 'Không đọc được trạng thái git của bản checkout chính.';
  return dirty.out ? 'Bản checkout chính có thay đổi chưa commit: commit hoặc stash trước, phòng không làm đè lên.' : null;
}

const DEVELOPER = 30;
async function gitlabPreflight(repoDir, repo, env) {
  const problems = [], warnings = [], api = (p) => run('glab', ['api', p], { env }).then((r) => (r.ok ? json(r.out) : undefined));
  if (!(await run('glab', ['auth', 'status'], { env })).ok) return fail(['glab chưa đăng nhập: anh gõ `! glab auth login`.'], repo, 'gitlab');
  const dirty = await dirtyProblem(repoDir, env); if (dirty) problems.push(dirty);
  const id = encodeURIComponent(repo), info = (await api(`projects/${id}`)) ?? {};
  const level = Math.max(info.permissions?.project_access?.access_level ?? 0, info.permissions?.group_access?.access_level ?? 0);
  const defaultBranch = info.default_branch || 'main';
  if (level < DEVELOPER) problems.push(`Không đủ quyền trên ${repo} (mức ${level || 'không rõ'}): cần Developer trở lên để push và mở MR — nhờ chủ repo cấp quyền.`);
  // Merging into the default branch: the branch says whether it is protected; if it is, every rule whose name matches
  // it (exact or wildcard, "*", "mast*") counts and the most permissive wins, as in GitLab. Only role-based levels can
  // grant: rules per user, per group or custom roles are not evaluated. Anything unreadable fails closed.
  const enc = encodeURIComponent(defaultBranch);
  const grants = (rule) => (rule?.merge_access_levels ?? []).some((x) => !x?.user_id && !x?.group_id && !x?.member_role_id
    && Number.isFinite(x?.access_level) && x.access_level > 0 && level >= x.access_level);
  const glob = (name) => new RegExp(`^${String(name).split('*').map((x) => x.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`);
  let canMerge = false, unreadable = false;
  const branch = await api(`projects/${id}/repository/branches/${enc}`);
  if (branch?.protected === false) canMerge = true;
  else if (branch?.protected === true) {
    const rules = await api(`projects/${id}/protected_branches?per_page=100`);
    if (!Array.isArray(rules)) unreadable = true;
    else canMerge = rules.filter((r) => glob(r?.name).test(defaultBranch)).some(grants);
  } else unreadable = true;
  if (unreadable) warnings.push(`Phòng không đọc được bảo vệ nhánh ${defaultBranch} của ${repo}: không bật auto-merge — phòng dừng ở MR, ghi vào "Chờ anh".`);
  else if (!canMerge) warnings.push(`Không đủ quyền merge vào ${defaultBranch} của ${repo} (theo vai trò; quy tắc riêng theo người hay nhóm không được tính): phòng dừng ở MR, ghi vào "Chờ anh".`);
  const hasCi = (await api(`projects/${id}/repository/files/.gitlab-ci.yml?ref=${encodeURIComponent(defaultBranch)}`)) !== undefined;
  if (!hasCi) warnings.push(`${repo} chưa có .gitlab-ci.yml trên ${defaultBranch}: không bật auto-merge — phòng dừng ở MR, ghi vào "Chờ anh".`);
  const strict = info.only_allow_merge_if_pipeline_succeeds === true;
  if (!strict) warnings.push(`${repo} chưa bật "Pipelines must succeed" (Settings → Merge requests): không bật auto-merge (glab sẽ merge ngay) — phòng dừng ở MR, ghi vào "Chờ anh".`);
  return { ok: problems.length === 0, problems, warnings, platform: 'gitlab', repo, defaultBranch, autoMerge: hasCi && strict && canMerge && problems.length === 0, requiredChecks: ['pipeline'] };
}

/** The CI checks the branch requires -> a list of names, or null when neither source could be read. */
async function requiredChecks(repo, branch, env) {
  const b = await run('gh', ['api', `repos/${repo}/branches/${branch}`], { env });
  const r = await run('gh', ['api', `repos/${repo}/rules/branches/${branch}`], { env });
  const prot = b.ok ? json(b.out) : undefined, rules = r.ok ? json(r.out) : undefined;
  if (prot === undefined && !Array.isArray(rules)) return null;
  const fromProt = prot?.protection?.required_status_checks?.contexts ?? [];
  const fromRules = (Array.isArray(rules) ? rules : []).filter((x) => x?.type === 'required_status_checks')
    .flatMap((x) => x.parameters?.required_status_checks ?? []).map((c) => c?.context).filter(Boolean);
  return [...(Array.isArray(fromProt) ? fromProt : []), ...fromRules];
}

export async function preflight(repoDir, { env = process.env } = {}) {
  const problems = [], warnings = [];
  const origin = await run('git', ['remote', 'get-url', 'origin'], { cwd: repoDir, env });
  if (!origin.ok) return fail(['Không phải repo git (hoặc chưa có remote origin).']);
  const lab = /gitlab\.com[:/](.+?)(?:\.git)?\/?$/.exec(origin.out);
  if (lab) return gitlabPreflight(repoDir, lab[1], env);
  const m = /github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/.exec(origin.out);
  if (!m) return fail([`origin không phải GitHub hay GitLab (${origin.out}): phòng chưa hỗ trợ.`]);
  const repo = m[1];
  if (!(await run('gh', ['auth', 'status'], { env })).ok) return fail(['gh chưa đăng nhập: anh gõ `! gh auth login`.'], repo, 'github');
  const dirty = await dirtyProblem(repoDir, env); if (dirty) problems.push(dirty);
  const info = json((await run('gh', ['repo', 'view', repo, '--json', 'viewerPermission,autoMergeAllowed,defaultBranchRef'], { env })).out) ?? {};
  const perm = info.viewerPermission, defaultBranch = info.defaultBranchRef?.name || 'main';
  if (!['WRITE', 'MAINTAIN', 'ADMIN'].includes(perm)) problems.push(`Không đủ quyền trên ${repo} (${perm || 'không rõ'}): cần WRITE để push và mở PR — nhờ chủ repo cấp quyền.`);
  const checks = await requiredChecks(repo, defaultBranch, env);
  if (checks === null) warnings.push(`Phòng không đọc được bảo vệ nhánh ${defaultBranch} của ${repo}: không bật auto-merge — phòng dừng ở PR, ghi vào "Chờ anh".`);
  else if (checks.length === 0) warnings.push(`${defaultBranch} của ${repo} chưa có check CI bắt buộc: không bật auto-merge (gh sẽ merge ngay) — phòng dừng ở PR, ghi vào "Chờ anh".`);
  if (info.autoMergeAllowed !== true) warnings.push(`${repo} chưa bật "Allow auto-merge" (Settings → General): không bật auto-merge — phòng dừng ở PR, ghi vào "Chờ anh".`);
  const autoMerge = Array.isArray(checks) && checks.length > 0 && info.autoMergeAllowed === true;
  return { ok: problems.length === 0, problems, warnings, platform: 'github', repo, defaultBranch, autoMerge, requiredChecks: checks || [] };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  preflight(process.argv[2] || process.cwd()).then((r) => { process.stdout.write(`${JSON.stringify(r, null, 2)}\n`); process.exitCode = r.ok ? 0 : 1; });
}
