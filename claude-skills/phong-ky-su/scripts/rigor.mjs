#!/usr/bin/env node
// Phòng Kỹ sư phần mềm — the level of a task: `day-du` (every step) or `nhanh` (a small task skips BA, the planner with
// its plan review, and the Tester). Chosen at the start from the request and an estimate; checked again on the real
// diff before review, and raised to day-du when the diff is too big or touches something sensitive. Never lowered.
// Node stdlib + git.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const MAX_FILES = 3, MAX_LINES = 150;
const LEVELS = ['day-du', 'nhanh'];
const CATCH_UP = ['ba', 'planner + /codex-plan-review', 'tester'];   // (what nhanh skipped)
const SCAN_SKILLS = ['vibesec', 'prisma-migration-safety', 'nextjs-server-action-security'];   // (in this order)

const base = (p) => p.split('/').pop();
/** [why, test on the path, the skill that scans it (null: /codex-security-review alone)] */
const PATH_RULES = [
  ['prisma/migrations/', (p) => /(^|\/)prisma\/migrations\//.test(p), 'prisma-migration-safety'],
  ['.env*', (p) => base(p).startsWith('.env'), 'vibesec'],
  ['Dockerfile*', (p) => base(p).startsWith('Dockerfile'), 'vibesec'],
  ['docker-compose*', (p) => base(p).startsWith('docker-compose'), 'vibesec'],
  ['.gitlab-ci.yml', (p) => base(p) === '.gitlab-ci.yml', 'vibesec'],
  ['.github/workflows/', (p) => /(^|\/)\.github\/workflows\//.test(p), 'vibesec'],
  ['deploy/', (p) => /(^|\/)deploy\//.test(p), 'vibesec'],
  ['auth/', (p) => /(^|\/)auth\//.test(p), 'vibesec'],
  ['crypto/', (p) => /(^|\/)crypto\//.test(p), null],
  ['cors', (p) => /cors/i.test(p), 'vibesec'],
  ['middleware', (p) => /middleware/i.test(p), 'vibesec'],
];
/** [why, pattern on the added lines of one hunk, skill] — false positives are fine: they only cost a full run. */
const CONTENT_RULES = [
  [`'use server'`, /'use server'/, 'nextjs-server-action-security'],
  ['"use server"', /"use server"/, 'nextjs-server-action-security'],
  ['process.env', /process\.env/, 'vibesec'],
  ['SECRET', /secret/i, 'vibesec'],
  ['API_KEY', /api_key/i, 'vibesec'],
  ['password', /password/i, 'vibesec'],
  ['token', /token/i, 'vibesec'],
  ['Access-Control-Allow-Origin', /access-control-allow-origin/i, 'vibesec'],
  ['crypto', /createHash|crypto/i, null],
  ['SQL thô', { test: rawSql }, null],   // (across lines, but only inside one block: a hunk's added lines)
];

/** SELECT … FROM (across lines), INSERT INTO, $queryRaw, $executeRaw. One linear pass: a FROM anywhere after the first
    SELECT matches the same texts as /SELECT[\s\S]*?FROM/ without its quadratic backtracking on many SELECTs, no FROM. */
function rawSql(text) {
  if (/\bINSERT\s+INTO\b|\$queryRaw|\$executeRaw/i.test(text)) return true;
  const select = /\bSELECT\b/i.exec(text);
  return !!select && /\bFROM\b/i.test(text.slice(select.index + select[0].length));
}

const isTest = (p) => /\.(test|spec)\.[^/]+$/.test(p) || /(^|\/)(tests|__tests__)\//.test(p);
const lines = (n) => (Number.isFinite(Number(n)) ? Number(n) : 0);   // (numstat `-`: binary)
function checkLevel(level) { if (!LEVELS.includes(level)) throw new Error(`Không có mức "${level}" (day-du | nhanh)`); }

const NEGATIONS = new Set(['không', 'chẳng', 'đừng', 'khỏi']);
/** "không cần nhanh", "đừng làm nhanh": a negation among the 3 words before it, in the same clause. "không những",
    "không chỉ", "chẳng những" (not only) are affirmative: taken out first. */
const negated = (before) => before.split(/[,.;:!?\n]/).pop().toLowerCase().replace(/(không|chẳng)\s+(những|chỉ)(?!\p{L})/gu, ' ')
  .trim().split(/\s+/).slice(-3).some((w) => NEGATIONS.has(w));

/** The request (and an estimate) -> { level, source: ep-tay | uoc-luong }. The word day-du or nhanh forces it (both:
    day-du; a negated nhanh does not count); otherwise nhanh only when the estimate is there and within 3 files and 150 lines. */
export function chooseLevel(text = '', { estFiles, estLines } = {}) {
  text = text.normalize('NFC');
  const at = (w) => [...text.matchAll(new RegExp(`(?<![\\p{L}\\p{N}_-])${w}(?![\\p{L}\\p{N}_-])`, 'giu'))].map((m) => m.index);
  if (at('day-du').length) return { level: 'day-du', source: 'ep-tay' };
  if (at('nhanh').some((i) => !negated(text.slice(0, i)))) return { level: 'nhanh', source: 'ep-tay' };
  const small = [estFiles, estLines].every((x) => x != null && Number.isFinite(Number(x))) && Number(estFiles) <= MAX_FILES && Number(estLines) <= MAX_LINES;
  return { level: small ? 'nhanh' : 'day-du', source: 'uoc-luong' };
}

/** The added lines of a unified diff, joined per file and hunk -> [[path, text]] (deleted and context lines left
    out), so a statement split over lines is still seen whole. */
function addedBlocks(diff) {
  const out = []; let file = null, prev = '', block = null;
  const flush = () => { if (block) out.push([file, block.join('\n')]); block = null; };
  for (const l of diff.split('\n')) {
    if (prev.startsWith('--- ') && l.startsWith('+++ ')) { flush(); const p = l.slice(4); file = p === '/dev/null' ? null : p.replace(/^b\//, ''); }
    else if (l.startsWith('@@') || l.startsWith('diff --git ')) flush();
    else if (l.startsWith('+') && file) (block ||= []).push(l.slice(1));
    prev = l;
  }
  flush();
  return out;
}

/** The level checked on the real diff: files [{ path, oldPath (renamed), added, deleted }] (numstat), diff = unified diff text ->
    { level, upgraded, reason, reasons, catchUp, fileCount, lineCount, sensitive: [{ path, why }] }. Test files don't
    count toward the size; every file counts toward sensitive. */
export function recheck(level, files, diff = '') {
  checkLevel(level);
  const counted = files.filter((f) => !isTest(f.path));
  const fileCount = counted.length, lineCount = counted.reduce((s, f) => s + lines(f.added) + lines(f.deleted), 0);
  const hits = new Map();   // (path + why -> { path, why, skill }, once each)
  const hit = (p, [why, , skill]) => { if (!hits.has(`${p}\0${why}`)) hits.set(`${p}\0${why}`, { path: p, why, skill }); };
  for (const f of files) for (const r of PATH_RULES) if (r[1](f.path) || (f.oldPath && r[1](f.oldPath))) hit(f.path, r);   // (a rename: both paths)
  for (const [p, text] of addedBlocks(diff)) for (const r of CONTENT_RULES) if (r[1].test(text)) hit(p, r);
  const sensitive = [...hits.values()];
  const reasons = [sensitive.length && 'nhay-cam', (fileCount > MAX_FILES || lineCount > MAX_LINES) && 'vuot-nguong'].filter(Boolean);
  const upgraded = level === 'nhanh' && reasons.length > 0;
  const catchUp = !upgraded ? [] : [...CATCH_UP, ...(sensitive.length ? ['/codex-security-review', ...SCAN_SKILLS.filter((s) => sensitive.some((x) => x.skill === s))] : [])];
  return { level: upgraded ? 'day-du' : level, upgraded, reason: reasons[0] || null, reasons, catchUp, fileCount, lineCount,
    sensitive: sensitive.map(({ path: p, why }) => ({ path: p, why })) };
}

const git = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
/** origin/HEAD, else origin/main or origin/master. */
function defaultBase(cwd) {
  try { return git(cwd, ['rev-parse', '--abbrev-ref', 'origin/HEAD']).trim(); } catch { /* not set */ }
  for (const b of ['origin/main', 'origin/master']) { try { git(cwd, ['rev-parse', '--verify', '-q', `${b}^{commit}`]); return b; } catch { /* next */ } }
  throw new Error('Không thấy nhánh mặc định trên origin: truyền --base origin/<defaultBranch>');
}

/** recheck on a worktree: the diff against base (committed or not) plus untracked files (all their lines added). */
export function recheckRepo(repoDir, level, { base: ref } = {}) {
  checkLevel(level);
  const cwd = git(repoDir, ['rev-parse', '--show-toplevel']).trim(), b = ref || defaultBase(cwd);
  // (numstat -z: "added\tdeleted\tpath\0", or for a rename "added\tdeleted\t\0old\0new\0": one file, its real counts)
  const files = [], tok = git(cwd, ['diff', '--numstat', '-z', '--find-renames', b]).split('\0');
  for (let i = 0; i < tok.length; i++) {
    if (!tok[i]) continue;
    const [added, deleted, ...p] = tok[i].split('\t');
    if (p.join('\t')) files.push({ path: p.join('\t'), added, deleted });
    else { files.push({ path: tok[i + 2], oldPath: tok[i + 1], added, deleted }); i += 2; }
  }
  let diff = git(cwd, ['-c', 'core.quotepath=false', 'diff', '--find-renames', '--no-ext-diff', '--no-color', '-U0', b]);
  for (const p of git(cwd, ['ls-files', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean)) {
    const full = path.join(cwd, p);
    const st = fs.lstatSync(full);
    if (st.isSymbolicLink()) {   // (one file whose content is the target string, as git stores it; the target is never read)
      files.push({ path: p, added: 1, deleted: 0 }); diff += `\n--- /dev/null\n+++ b/${p}\n+${fs.readlinkSync(full)}`; continue;
    }
    if (!st.isFile()) continue;
    const buf = fs.readFileSync(full);
    if (buf.subarray(0, 8000).includes(0)) { files.push({ path: p, added: '-', deleted: '-' }); continue; }
    const text = buf.toString('utf8').split('\n'); if (text.at(-1) === '') text.pop();
    files.push({ path: p, added: text.length, deleted: 0 });
    diff += `\n--- /dev/null\n+++ b/${p}\n${text.map((l) => `+${l}`).join('\n')}`;
  }
  return recheck(level, files, diff);
}

// CLI: choose "<request>" [--files <n>] [--lines <n>] | recheck <repoDir> <day-du|nhanh> [--base <ref>]
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [op, a, ...rest] = process.argv.slice(2), out = (x) => process.stdout.write(`${JSON.stringify(x)}\n`);
  const flag = (n) => { const i = rest.indexOf(`--${n}`); return i >= 0 ? rest[i + 1] : undefined; };
  try {
    if (op === 'choose') out(chooseLevel(a, { estFiles: flag('files'), estLines: flag('lines') }));
    else if (op === 'recheck') out(recheckRepo(a, rest[0], { base: flag('base') }));
    else throw new Error('Dùng: rigor.mjs choose "<câu giao việc>" [--files n] [--lines n] | recheck <repo> <day-du|nhanh> [--base <ref>]');
  } catch (e) { console.error(e.message); process.exit(1); }
}
