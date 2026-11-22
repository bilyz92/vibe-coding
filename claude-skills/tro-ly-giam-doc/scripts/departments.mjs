#!/usr/bin/env node
// Sổ phòng ban: every department declares itself in a department.json next to its skill (<SKILLS_DIR>/<skill>/), so
// the Trợ lý giám đốc knows who handles what. Also: the trial counters of departments on probation and the list of
// repos the company works in — runtime data, in companyDir. Node stdlib only.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { companyDir, readJson, edit } from './store.mjs';

export const skillsDir = ({ env = process.env } = {}) => env.SKILLS_DIR || path.join(os.homedir(), '.claude', 'skills');
export const MODELS = ['opus', 'sonnet', 'haiku'];
export const KINDS = ['lead', 'lam', 'kiem', 'thu-ky'];
export const GRADUATE_AFTER = 3, FLAG_AFTER = 2;
const NAME = /^[a-z0-9][a-z0-9-]{0,63}$/;
export const TOOL = /^[A-Za-z][\w.:*()-]{0,99}$/;   // (one tool name: no spaces or newlines, nothing that could end the frontmatter line)
const text = (x) => typeof x === 'string' && x.trim() !== '';

/** -> the problems with a department.json (empty when it is valid). Every department has a Lead, a doer, a checker and
    a Thư ký. */
export function validateDepartment(d) {
  if (!d || typeof d !== 'object') return ['không phải object'];
  const p = [];
  if (!NAME.test(d.name ?? '')) p.push('name: chữ thường, số, gạch ngang');
  for (const k of ['title', 'handles', 'skill', 'external']) if (!text(d[k])) p.push(`${k}: thiếu`);
  if (!['active', 'probation'].includes(d.status)) p.push('status: active | probation');
  if (d.skill !== undefined && d.skill !== d.name) p.push('skill: phải trùng name (thư mục của phòng)');
  if (!(d.allowedTools === 'all' || (Array.isArray(d.allowedTools) && d.allowedTools.every((t) => TOOL.test(t))))) p.push('allowedTools: "all" hoặc danh sách tên công cụ');
  if (!(typeof d.budgetUsd === 'number' && d.budgetUsd > 0)) p.push('budgetUsd: số > 0');
  if (!Array.isArray(d.roles) || !d.roles.length) return [...p, 'roles: thiếu'];
  d.roles.forEach((r, i) => {
    if (!NAME.test(r?.agent ?? '')) p.push(`roles[${i}].agent: tên không hợp lệ`);
    if (!text(r?.title)) p.push(`roles[${i}].title: thiếu`);
    if (!MODELS.includes(r?.model)) p.push(`roles[${i}].model: ${MODELS.join(' | ')}`);
    if (!KINDS.includes(r?.kind)) p.push(`roles[${i}].kind: ${KINDS.join(' | ')}`);
  });
  for (const k of KINDS) if (!d.roles.some((r) => r?.kind === k)) p.push(`roles: thiếu vai loại ${k}`);
  const agents = d.roles.map((r) => r?.agent);
  for (const a of new Set(agents.filter((x, i) => agents.indexOf(x) !== i))) p.push(`roles: agent ${a} bị trùng`);
  return p;
}

/** -> { departments, warnings }: each <SKILLS_DIR>/<dir>/department.json that is valid, sorted by name. */
export function loadDepartments({ env = process.env } = {}) {
  const root = skillsDir({ env }), departments = [], warnings = [];
  let dirs = [];
  try { dirs = fs.readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name); } catch { /* none */ }
  for (const n of dirs.sort()) {
    const f = path.join(root, n, 'department.json');
    if (!fs.existsSync(f)) continue;
    const d = readJson(f), problems = validateDepartment(d);
    if (!problems.length && d.name !== n) problems.push(`name ${d.name} khác tên thư mục`);
    if (problems.length) warnings.push(`Bỏ qua ${n}/department.json: ${problems.join('; ')}`);
    else departments.push(d);
  }
  return { departments, warnings };
}

const words = (s) => new Set(String(s ?? '').toLowerCase().match(/[\p{L}\p{N}]+/gu) || []);
/** Share of the smaller text's words found in the other one (0..1). */
export function overlap(a, b) {
  const A = words(a), B = words(b);
  if (!A.size || !B.size) return 0;
  const [small, big] = A.size <= B.size ? [A, B] : [B, A];
  return [...small].filter((w) => big.has(w)).length / small.size;
}

/** The department with the same name, or whose "handles" shares ≥ 60 % of its words -> it, or null. */
export function findSimilar(departments, { name, handles }) {
  return departments.find((d) => d.name === name) || departments.find((d) => overlap(d.handles, handles) >= 0.6) || null;
}

/** An agent's tools must be ones its department allows. */
export function toolsAllowed(department, tools) {
  if (department.allowedTools === 'all') return { ok: true, extra: [] };
  const extra = tools.filter((t) => !department.allowedTools.includes(t));
  return { ok: extra.length === 0, extra };
}

const trialFile = (name, env) => {
  if (!NAME.test(name ?? '')) throw new Error(`Mã không hợp lệ: ${JSON.stringify(name)}`);
  return path.join(companyDir({ env }), 'departments', `${name}.json`);
};
const shape = (s) => {
  const accepted = s?.accepted ?? 0, rejectedInRow = s?.rejectedInRow ?? 0;
  return { accepted, rejectedInRow, readyToGraduate: accepted >= GRADUATE_AFTER, flagged: rejectedInRow >= FLAG_AFTER };
};

/** The user accepted (or sent back) a probation department's result -> its trial state. */
export function recordOutcome(name, accepted, { env = process.env } = {}) {
  return shape(edit(trialFile(name, env), (s) => {
    const c = shape(s);
    return accepted ? { accepted: c.accepted + 1, rejectedInRow: 0 } : { accepted: c.accepted, rejectedInRow: c.rejectedInRow + 1 };
  }));
}
export const trialState = (name, { env = process.env } = {}) => shape(readJson(trialFile(name, env)));

// Chế độ Auto (whole company): on, the Trợ lý giám đốc decides what it would otherwise ask anh, and probation results
// may finish without anh. The hard limits never change: outside actions, secrets and irreversible steps still wait.
const settingsFile = (env) => path.join(companyDir({ env }), 'settings.json');
export const autoMode = ({ env = process.env } = {}) => readJson(settingsFile(env))?.auto === true;
export function setAutoMode(on, { env = process.env } = {}) { edit(settingsFile(env), (s) => ({ ...(s ?? {}), auto: !!on })); return autoMode({ env }); }

const reposFile = (env) => path.join(companyDir({ env }), 'repos.json');
export const listRepos = ({ env = process.env } = {}) => readJson(reposFile(env))?.repos ?? [];
/** Remembers a repo the company worked in (for the digest). */
export function addRepo(dir, { env = process.env } = {}) {
  const abs = path.resolve(dir);
  edit(reposFile(env), (r) => ({ repos: [...new Set([...(r?.repos ?? []), abs])] }));
}

/** A repo named in a ticket -> its real path, or null unless the folder and its git data both sit in the project folder
    or the skills folder: ticket text must not widen what the kho reads or where a ledger is made (a repo elsewhere is
    added by hand, with add-repo). */
export function allowedRepo(dir, { env = process.env } = {}) {
  const real = (p) => { try { return fs.realpathSync(p); } catch { return null; } };
  const roots = [env.KHO_PROJECTS_DIR || path.join(os.homedir(), 'project'), skillsDir({ env })].map(real).filter(Boolean);
  const within = (p) => !!p && roots.some((r) => p === r || p.startsWith(r + path.sep));
  const repo = real(dir);
  if (!within(repo) || !fs.existsSync(path.join(repo, '.git'))) return null;
  const git = spawnSync('git', ['rev-parse', '--git-common-dir'], { cwd: repo, encoding: 'utf8' });
  return git.status === 0 && within(real(path.resolve(repo, git.stdout.trim()))) ? repo : null;
}
/** Remembers a ticket's repo, when it is an allowed one. */
export function addTicketRepo(dir, { env = process.env } = {}) {
  const repo = allowedRepo(dir, { env });
  if (repo) addRepo(repo, { env });
}

// CLI: list | add-repo DIR | outcome NAME nhan|tra-lai | trial NAME | auto [on|off|status] — JSON on stdout.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [op, a, b] = process.argv.slice(2);
  try {
    const out = {
      list: () => loadDepartments(),
      'add-repo': () => { addRepo(a); return listRepos(); },
      outcome: () => { if (!['nhan', 'tra-lai'].includes(b)) throw new Error('outcome NAME nhan|tra-lai'); return recordOutcome(a, b === 'nhan'); },
      trial: () => trialState(a),
      auto: () => { if (a === 'on' || a === 'off') setAutoMode(a === 'on'); else if (a && a !== 'status') throw new Error('auto on|off|status'); return { auto: autoMode() }; },
    }[op];
    if (!out) throw new Error('Dùng: departments.mjs list | add-repo DIR | outcome NAME nhan|tra-lai | trial NAME | auto [on|off|status]');
    console.log(JSON.stringify(out(), null, 2));
  } catch (e) { console.error(e.message); process.exit(1); }
}
