// Shared by the kho tests: a throwaway company (every path kho reads or writes points into one temp folder), a way to
// run the CLI against it, and small fixtures.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

export const KHO = path.resolve(import.meta.dirname, '../scripts/kho.mjs');

// Every temp company is removed when the test process exits.
const roots = new Set();
process.on('exit', () => { for (const r of roots) fs.rmSync(r, { recursive: true, force: true }); });

/** -> env for a fresh, empty company in a temp folder (nothing points at the real home). */
export function makeEnv() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kho-'));
  roots.add(root);
  const e = {
    COMPANY_DIR: path.join(root, 'company'), KHO_DIR: path.join(root, 'tri-thuc'), KHO_PROJECTS_DIR: path.join(root, 'project'),
    SKILLS_DIR: path.join(root, 'skills'), CLAUDE_PROJECTS_DIR: path.join(root, 'claude-projects'),
  };
  for (const d of [e.COMPANY_DIR, e.KHO_PROJECTS_DIR, e.SKILLS_DIR]) fs.mkdirSync(d, { recursive: true });
  return { root, ...e };
}

/** Runs kho.mjs with the temp company -> { code, out (parsed JSON or null), stdout, stderr }. */
export function kho(e, args, { input } = {}) {
  const { root, ...vars } = e;
  const r = spawnSync(process.execPath, [KHO, ...args], { env: { ...process.env, ...vars }, encoding: 'utf8', input });
  let out = null; try { out = JSON.parse(r.stdout); } catch { /* not JSON */ }
  return { code: r.status, out, stdout: r.stdout, stderr: r.stderr };
}

export const write = (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };
export const writeJson = (file, obj) => write(file, JSON.stringify(obj, null, 2));
export const mdFiles = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((n) => n.endsWith('.md')) : []);
export const sha = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
export const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

/** git in a fixture repo, with an identity so it works anywhere. */
export function git(dir, ...args) {
  const r = spawnSync('git', ['-C', dir, '-c', 'user.name=Tester', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', ...args], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr);
  return r.stdout;
}

/** A ticket file shaped like tickets.mjs writes it. */
export function ticket(e, id, extra = {}) {
  const at = '2026-11-01T10:00:00.000Z';
  writeJson(path.join(e.COMPANY_DIR, 'tickets', `${id}.json`), {
    id, title: `Phiếu ${id}`, request: 'việc gì đó', department: 'phong-marketing', repo: null, status: 'đang làm', parent: null, after: [],
    createdAt: at, updatedAt: at, analysis: null, issues: [], notes: [], result: null, history: [], ...extra,
  });
}

/** The full fixture of AC-6: 2 tickets, 1 department, 1 proposal, third-party.json, improve.json, one repo with lessons,
    docs/a.md, 2 commits and one Codex review session. -> the repo's path. */
export function seed(e) {
  ticket(e, 'P-20261101-100000-aaa', {
    analysis: { goal: 'mục tiêu', deliverables: ['bản'], criteria: ['tiêu chí'], assumptions: [], risks: [], departments: [], questions: [], ghi: 'zanalysisword' },
    notes: [{ at: '2026-11-01T10:00:00.000Z', by: 'x', text: 'ghi chú znotesword' }],
    issues: [{ at: '2026-11-01T10:00:00.000Z', by: 'x', problem: 'kẹt', need: 'anh', open: true }],
    result: { summary: 'xong zresultword', links: [] },
    history: [{ at: '2026-11-01T10:00:00.000Z', from: 'mới', to: 'đã giao', by: 'x' }],
  });
  ticket(e, 'P-20261101-100001-bbb');
  writeJson(path.join(e.SKILLS_DIR, 'phong-marketing', 'department.json'), { name: 'phong-marketing', title: 'Phòng Marketing', handles: 'bán hàng', status: 'probation', roles: [] });
  writeJson(path.join(e.COMPANY_DIR, 'proposals', 'D-20261101-100000-ccc.json'), { id: 'D-20261101-100000-ccc', status: 'đã duyệt', spec: { name: 'phong-video', title: 'Phòng Video', handles: 'làm video' } });
  writeJson(path.join(e.COMPANY_DIR, 'third-party.json'), { skills: [{ name: 'remotion-create', source: 'https://github.com/remotion-dev/skills', commit: 'c7cb2fd', auditedAt: '2026-11-03', findings: 'ok', mode: 'learned' }] });
  writeJson(path.join(e.COMPANY_DIR, 'improve.json'), { lastAt: '2026-11-03T01:34:39.681Z' });
  const repo = path.join(e.KHO_PROJECTS_DIR, 'repo-a');
  write(path.join(repo, 'PROGRESS.md'), '# Tiến độ\n\n## Bài học\n- 2026-11-01 · việc · bài học zlessonword\n\n## Khác\n- không phải bài học\n');
  write(path.join(repo, 'docs', 'a.md'), '# Tài liệu A\n\nNội dung zdocsword.\n');
  git(repo, 'init', '-q');
  git(repo, 'add', '.'); git(repo, 'commit', '-q', '-m', 'commit một');
  write(path.join(repo, 'README.md'), 'x'); git(repo, 'add', '.'); git(repo, 'commit', '-q', '-m', 'commit hai zcommitword');
  writeJson(path.join(repo, '.codex-review', 'sessions', 'codex-impl-review-20261101-001', 'meta.json'),
    { skill: 'codex-impl-review', rounds: 3, verdict: 'APPROVE', timestamp: '2026-11-01T10:00:00.000Z' });
  return repo;
}

/** Adds one knowledge document through the CLI. */
export const them = (e, { loai = 'nghien-cuu', tieuDe, nguon = 'https://example.com', the, noiDung = 'nội dung', ...rest }) => kho(e, ['them',
  '--loai', loai, '--tieu-de', tieuDe, '--nguon', nguon, ...(the ? ['--the', the] : []), '--noi-dung', noiDung,
  ...Object.entries(rest).flatMap(([k, v]) => [`--${k}`, v])]);
