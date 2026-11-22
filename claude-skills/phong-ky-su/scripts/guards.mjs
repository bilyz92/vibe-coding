#!/usr/bin/env node
// Phòng Kỹ sư phần mềm — the safety rules that code can check (spec 5.2): when a task is stuck (the Tester sent it
// back more than 3 times), which tasks may run side by side (no shared file), whether main is red after a merge, and
// the commands that revert through a PR (never a push to main). Node stdlib + git + gh.
import { execFile, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { withLock } from '../../codex-review/scripts/progress-lock.mjs';

const STUCK_AFTER = 3;

/** Where per-repo state goes: inside the main .git (shared by worktrees; never tracked, never in `git status`), else <dir>/.phong-ky-su. */
export function stateDir(repoDir) {
  let dir;
  // (--git-common-dir: one place for the repo and all its worktrees, so a recreated worktree keeps the count)
  try { dir = path.resolve(repoDir, execFileSync('git', ['rev-parse', '--git-common-dir'], { cwd: repoDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(), 'phong-ky-su'); }
  catch { dir = path.join(repoDir, '.phong-ky-su'); }
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** One more return from the Tester for this task -> { count, stuck } (stuck once count > 3). */
export function recordReturn(repoDir, taskId) {
  const dir = stateDir(repoDir), file = path.join(dir, 'returns.json');
  return withLock(path.join(dir, 'returns.lock'), () => {   // (Testers side by side: no return lost)
    let all = {}; try { all = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* first one */ }
    const count = (all[taskId] || 0) + 1;
    all[taskId] = count;
    const tmp = `${file}.tmp.${process.pid}`;
    fs.writeFileSync(tmp, JSON.stringify(all, null, 2)); fs.renameSync(tmp, file);
    return { count, stuck: count > STUCK_AFTER };
  });
}

/** Groups of task ids that may run side by side: first fit, no shared file inside a group; a task that names no
    files can't be checked, so it runs alone, after the others. */
export function parallelGroups(tasks) {
  const groups = [], alone = [];
  for (const t of tasks) {
    if (!t.files?.length) { alone.push([t.id]); continue; }
    const g = groups.find((x) => !t.files.some((f) => x.files.has(f)));
    if (g) { g.ids.push(t.id); t.files.forEach((f) => g.files.add(f)); } else groups.push({ ids: [t.id], files: new Set(t.files) });
  }
  return [...groups.map((g) => g.ids), ...alone];
}

const RED = new Set(['failure', 'timed_out', 'startup_failure', 'action_required']);
const PASS = new Set(['success', 'neutral', 'skipped']);
const SHA = /^[0-9a-f]{7,40}$/i;
const cli = (cmd) => (args, env) => new Promise((resolve) => execFile(cmd, args, { env, timeout: 20_000 }, (err, out) => resolve(err ? null : String(out))));
const gh = cli('gh'), glab = cli('glab');
const project = (repo) => `projects/${encodeURIComponent(repo)}`;
const PIPE_PENDING = new Set(['created', 'waiting_for_resource', 'preparing', 'pending', 'running', 'scheduled', 'manual']);

/** GitLab: the newest pipeline of that commit decides. */
async function gitlabMainStatus(repo, sha, env) {
  let list; try { list = JSON.parse(await glab(['api', `${project(repo)}/pipelines?sha=${sha}&order_by=id&sort=desc`], env)); } catch { return { state: 'unknown', sha, failed: [] }; }
  if (!Array.isArray(list)) return { state: 'unknown', sha, failed: [] };
  const p = list[0];
  if (!p || PIPE_PENDING.has(p.status)) return { state: 'pending', sha, failed: [] };
  if (p.status === 'success') return { state: 'green', sha, failed: [] };
  if (p.status === 'failed') return { state: 'red', sha, failed: [`pipeline #${p.id}`] };
  return { state: 'unknown', sha, failed: [] };   // (canceled, skipped: someone looks)
}

/** The checks of this one commit on main -> { state: green | red | pending | unknown, sha, failed: [check names] }.
    required (preflight's requiredChecks): green only when each of them exists, has finished and passed — a green
    run of something else proves nothing; not created or still running = pending; cancelled = unknown (someone looks).
    Without a list: every check must pass. Any real failure (failure / timed_out / startup_failure) is red at once.
    opts.env: for tests. */
export async function mainStatus(repo, sha, { env = process.env, required = [], platform = 'github' } = {}) {
  if (!SHA.test(String(sha))) throw new Error(`Không phải mã commit: ${sha}`);
  if (platform === 'gitlab') return gitlabMainStatus(repo, sha, env);
  const out = await gh(['api', `repos/${repo}/commits/${sha}/check-runs?per_page=100`], env);
  let runs; try { runs = JSON.parse(out).check_runs; } catch { return { state: 'unknown', sha, failed: [] }; }
  if (!Array.isArray(runs)) return { state: 'unknown', sha, failed: [] };
  const failed = runs.filter((r) => RED.has(r.conclusion)).map((r) => r.name);
  if (failed.length) return { state: 'red', sha, failed };
  const judged = required.length ? required.map((name) => runs.find((r) => r.name === name)) : runs;
  if (!judged.length || judged.some((r) => !r || r.status !== 'completed')) return { state: 'pending', sha, failed };
  return { state: judged.every((r) => PASS.has(r.conclusion)) ? 'green' : 'unknown', sha, failed };
}

/** Our own PR's merge -> { state: MERGED | OPEN | CLOSED | unknown, sha: the merge commit or null }. */
export async function mergeCommit(repo, prNumber, { env = process.env, platform = 'github' } = {}) {
  if (platform === 'gitlab') {
    try {
      const j = JSON.parse(await glab(['api', `${project(repo)}/merge_requests/${Number(prNumber)}`], env));
      return { state: { merged: 'MERGED', opened: 'OPEN', closed: 'CLOSED' }[j.state] || 'unknown', sha: j.merge_commit_sha || j.squash_commit_sha || null };
    } catch { return { state: 'unknown', sha: null }; }
  }
  const out = await gh(['pr', 'view', String(Number(prNumber)), '--repo', repo, '--json', 'state,mergeCommit'], env);
  try { const j = JSON.parse(out); return { state: j.state || 'unknown', sha: j.mergeCommit?.oid || null }; }
  catch { return { state: 'unknown', sha: null }; }
}

/** The commands that revert a merge through its own branch and PR / MR, onto the real default branch. Never pushes to
    that branch. */
export function revertPlan(mergeSha, prNumber, { platform = 'github', defaultBranch = 'main' } = {}) {
  if (!SHA.test(String(mergeSha))) throw new Error(`Không phải mã commit: ${mergeSha}`);
  if (!/^[\w./-]+$/.test(defaultBranch)) throw new Error(`Tên nhánh lạ: ${defaultBranch}`);
  const short = mergeSha.slice(0, 7), branch = `revert/${short}`, base = defaultBranch;
  const why = `CI trên ${base} đỏ sau ${short}${prNumber ? ` (${platform === 'gitlab' ? 'MR !' : 'PR #'}${Number(prNumber)})` : ''}; hoàn tác để ${base} xanh lại.`;
  return [
    `git fetch origin ${base}`,
    `git switch -c ${branch} origin/${base}`,
    `git revert -m 1 ${mergeSha} --no-edit || git revert ${mergeSha} --no-edit`,
    `git push -u origin ${branch}`,
    platform === 'gitlab'
      ? `glab mr create --source-branch ${branch} --target-branch ${base} --title "Revert: ${base} đỏ sau ${short}" --description "${why}" --yes`
      : `gh pr create --base ${base} --head ${branch} --title "Revert: ${base} đỏ sau ${short}" --body "${why}"`,
  ];
}

// CLI: return <repoDir> <taskId> | groups <json-file> | main <repo> <sha> [--gitlab] [--required 'CI (Node 20, ubuntu)' …]
//      | merge <repo> <pr|mr> [--gitlab] | revert-plan <sha> [pr] [--gitlab] [--branch <default branch>]
//      (one --required per check: names may hold commas; --gitlab for a GitLab project such as group/sub/name)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [op, a, b, ...rest] = process.argv.slice(2), out = (x) => process.stdout.write(`${JSON.stringify(x)}\n`);
  const all = [b, ...rest], platform = all.includes('--gitlab') ? 'gitlab' : 'github';
  const flag = (n) => { const i = all.indexOf(`--${n}`); return i >= 0 ? all[i + 1] : undefined; };
  const pr = b && !b.startsWith('--') ? b : undefined;
  if (op === 'return') out(recordReturn(a, b));
  else if (op === 'groups') out(parallelGroups(JSON.parse(fs.readFileSync(a, 'utf8'))));
  else if (op === 'main') mainStatus(a, b, { platform, required: rest.flatMap((x, i) => (rest[i - 1] === '--required' && x ? [x] : [])) }).then(out);
  else if (op === 'merge') mergeCommit(a, b, { platform }).then(out);
  else if (op === 'revert-plan') out(revertPlan(a, pr, { platform, defaultBranch: flag('branch') || 'main' }));
  else { console.error('Dùng: guards.mjs return|groups|main|merge|revert-plan …'); process.exit(1); }
}
