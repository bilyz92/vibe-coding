#!/usr/bin/env node
// Takes in an outside skill repo to read, never to install: checks the URL (https github.com / gitlab.com only) before
// any network use, clones it shallow into a new, empty folder under a scratch root (never ~/.claude/skills) with hooks,
// every protocol but https, submodules and LFS turned off and a clean git environment (no inherited GIT_*, no user or
// system config), checks the tree against size limits before checking it out, runs nothing from it, then reports the
// commit, the license and a skill-audit of every folder holding a SKILL.md. Node stdlib only.
// What the download is bounded by: the clone asks the server to leave out every file over maxFileBytes (a server that
// ignores the filter is refused), and the folder is watched while git runs (over 2 x maxTotalBytes git is killed). Still
// unbounded: what arrives between two looks at the folder (every 200 ms), and the time, up to timeoutMs.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { auditSkill } from './skill-audit.mjs';

const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
const HOSTS = { 'github.com': [2, 2], 'gitlab.com': [2, 20] };   // (how many path segments: owner/repo; group/.../repo)

/** -> { host, segments, repo, cloneUrl }; anything but https://github.com/<owner>/<repo> or https://gitlab.com/<group...>/<repo> throws. */
export function parseRepoUrl(url) {
  const bad = () => new Error(`URL không nhận: ${JSON.stringify(url)} (chỉ https://github.com/<owner>/<repo> hoặc https://gitlab.com/<nhóm>/<repo>)`);
  const m = typeof url === 'string' && /^https:\/\/(github\.com|gitlab\.com)\/([^?#]*)$/.exec(url);
  if (!m) throw bad();
  const segments = m[2].replace(/\/$/, '').replace(/\.git$/, '').split('/');
  const [min, max] = HOSTS[m[1]];
  if (segments.length < min || segments.length > max || !segments.every((s) => SEGMENT.test(s) && !s.includes('..'))) throw bad();
  const repo = `https://${m[1]}/${segments.join('/')}`;
  return { host: m[1], segments, repo, cloneUrl: `${repo}.git` };
}

/** Options given to every git command: no hooks, no protocol but https (and file, for the tests' local repo only). */
const safeFlags = (allowFile) => ['-c', 'core.hooksPath=/dev/null', '-c', 'protocol.allow=never', '-c', 'protocol.https.allow=always',
  ...(allowFile ? ['-c', 'protocol.file.allow=always'] : [])];

/** The git arguments of the clone (no checkout: the tree is checked against the limits first). The filter leaves out
    every file over maxFileBytes (git's blob:limit=n leaves out files of n bytes and more, hence the + 1). */
export function cloneArgs(url, dest, { allowFile = false, maxFileBytes = LIMITS.maxFileBytes } = {}) {
  return [...safeFlags(allowFile), 'clone', '--no-checkout', '--depth', '1', `--filter=blob:limit=${maxFileBytes + 1}`,
    '--no-recurse-submodules', '--quiet', '--', url, dest];
}

/** The environment git runs in: the caller's without any GIT_* variable, with an empty HOME of this run (so no
    ~/.gitconfig and no XDG config is read), no system config, no prompt, no LFS download, and English messages (the
    warning of a server that ignores the size filter is matched as written). */
export function cleanGitEnv(env, home) {
  const out = Object.fromEntries(Object.entries(env).filter(([k]) => !k.startsWith('GIT_') && k !== 'XDG_CONFIG_HOME'));
  return { ...out, HOME: home, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_TERMINAL_PROMPT: '0', GIT_LFS_SKIP_SMUDGE: '1', LC_ALL: 'C' };
}

export const LIMITS = { maxFiles: 5000, maxTotalBytes: 50 * 1024 * 1024, maxFileBytes: 5 * 1024 * 1024, maxDepth: 20 };

/** `git ls-tree -r -l -z HEAD` output against the limits -> the first one broken, as a message, or null. */
function overLimits(lsTree, { maxFiles, maxTotalBytes, maxFileBytes, maxDepth }) {
  const entries = lsTree.split('\0').filter(Boolean).map((e) => {
    const tab = e.indexOf('\t'), meta = e.slice(0, tab), p = e.slice(tab + 1);   // (a path may hold a tab itself)
    return { size: Number(meta.trim().split(/\s+/)[3]) || 0, path: p };   // (a submodule's size is "-")
  });
  if (entries.length > maxFiles) return `${entries.length} file (tối đa ${maxFiles})`;
  const total = entries.reduce((n, e) => n + e.size, 0);
  if (total > maxTotalBytes) return `tổng ${total} byte (tối đa ${maxTotalBytes})`;
  const big = entries.find((e) => e.size > maxFileBytes);
  if (big) return `${big.path}: ${big.size} byte (tối đa ${maxFileBytes} mỗi file)`;
  const deep = entries.find((e) => e.path.split('/').length - 1 > maxDepth);
  if (deep) return `${deep.path}: sâu ${deep.path.split('/').length - 1} thư mục (tối đa ${maxDepth})`;
  return null;
}

const inside = (root, p) => p === root || p.startsWith(root + path.sep);

/** Run by a child node: runs git (argv after the folder and the cap) in a process group of its own, looks at the folder's
    size every 200 ms and when git ends; over the cap it kills the whole group (git-remote-https, fetch-pack and
    index-pack too, which would go on writing into files already removed) and exits 3. A timeout's SIGTERM kills the group too. */
const WATCH = `
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const [dir, cap, ...args] = process.argv.slice(1);
const size = (p) => fs.readdirSync(p, { withFileTypes: true }).reduce((n, e) => {
  const f = path.join(p, e.name);
  try { return n + (e.isDirectory() ? size(f) : fs.lstatSync(f).size); } catch { return n; }
}, 0);
const over = () => { try { return size(dir) > Number(cap); } catch { return false; } };
const git = spawn('git', args, { stdio: ['ignore', 'inherit', 'inherit'], detached: true });
const killAll = () => { try { process.kill(-git.pid, 'SIGKILL'); } catch { /* ESRCH: the group is gone already */ } };
const stop = () => { killAll(); process.exit(3); };
const t = setInterval(() => { if (over()) stop(); }, 200);
process.on('SIGTERM', () => { killAll(); process.exit(1); });
git.on('exit', (code) => { clearInterval(t); if (over()) stop(); process.exit(code ?? 1); });
`;

/** Every folder (relative, '.' for the root) holding a regular SKILL.md; symlinks and .git are not followed. */
function skillDirs(root, rel = '.', out = []) {
  const abs = path.join(root, rel);
  if (fs.lstatSync(path.join(abs, 'SKILL.md'), { throwIfNoEntry: false })?.isFile()) out.push(rel);
  for (const e of fs.readdirSync(abs, { withFileTypes: true }))
    if (e.isDirectory() && e.name !== '.git' && e.name !== 'node_modules') skillDirs(root, rel === '.' ? e.name : `${rel}/${e.name}`, out);
  return out;
}

// (each title must open the file, so "this is NOT the MIT License" is not read as MIT)
const SPDX = [[/^(the )?MIT License/i, 'MIT'], [/^Apache License[\s\S]{0,40}Version 2\.0/i, 'Apache-2.0'], [/^ISC License/i, 'ISC'],
  [/^Mozilla Public License[\s\S]{0,20}2\.0/i, 'MPL-2.0'], [/^GNU GENERAL PUBLIC LICENSE[\s\S]{0,40}Version 3/i, 'GPL-3.0'],
  [/^GNU GENERAL PUBLIC LICENSE[\s\S]{0,40}Version 2/i, 'GPL-2.0'], [/^BSD 3-Clause/i, 'BSD-3-Clause'], [/^BSD 2-Clause/i, 'BSD-2-Clause']];
/** Known terms added on top of a standard license (a short list, not a proof): a file holding one is not read as the plain
    license. The verdict is a hint shown to anh in the proposal, never a reason to skip reading the LICENSE. */
const EXTRA_TERMS = /commons clause|non-?commercial|additional (terms|restrictions)/i;

const SIMPLE_SPDX = /^[A-Za-z0-9][A-Za-z0-9.+-]{0,63}$/;   // (one id like MIT or Apache-2.0: no OR/AND/WITH expression)

// The licenses accepted from the LICENSE file alone: the full standard text (scripts/licenses/), whole words compared.
const CANONICAL_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'licenses');
const TITLES = { MIT: /^(the )?mit license( \(mit\))? /i, 'Apache-2.0': /^(?!)/, 'BSD-2-Clause': /^bsd 2-clause( "simplified")? license /i, 'BSD-3-Clause': /^bsd 3-clause( "new" or "revised")? license /i };
// A copyright notice is the one free field of these texts, and it is dropped before comparing, so only the plain form
// counts: year, a short name, no sentence. Any other line stays in the comparison and so breaks the match.
const NOTICE = /^\s*(?:copyright\s+(?:(?:\(c\)|©)\s*)?(?:\d{4}(?:\s*[-–,]\s*\d{4})*,?|\[yyyy\])\s+(?:\[name of copyright owner\]|[\p{L}\p{N}&'’.-]{1,40}(?: [\p{L}\p{N}&'’.-]{1,40}){0,4}(?:, (?:inc|llc|ltd)\.?)?)\.?(?:\s+all rights reserved\.?)?|all rights reserved\.?)\s*$/iu;
const NOTICE_TERMS = /\b(may|must|shall|only|not|no|use|sell|resale|commercial|internal|personal|except|unless|without|require\w*|forbid\w*|prohibit\w*|restrict\w*|licen[cs]e[sd]?|permission|terms?|conditions?)\b/i;
const END_OF_TERMS = 'END OF TERMS AND CONDITIONS';
const isNotice = (line) => NOTICE.test(line) && !NOTICE_TERMS.test(line);
const words = (text) => text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => !isNotice(l)).join(' ').replace(/\s+/g, ' ').trim();

/** -> the SPDX id when text is exactly one standard license (its title and copyright notices aside), else null. Anything added, cut or reworded is not it. */
export function canonicalLicense(text) {
  const got = words(text);
  for (const [id, title] of Object.entries(TITLES)) {
    const want = words(fs.readFileSync(path.join(CANONICAL_DIR, `${id}.txt`), 'utf8'));
    const forms = id === 'Apache-2.0' ? [want, want.slice(0, want.indexOf(END_OF_TERMS) + END_OF_TERMS.length)] : [want];
    if (forms.includes(got.replace(title, ''))) return id;
  }
  return null;
}

/** -> { package, file, verdict }: package.json's "license" string, the license recognised in the LICENSE-like file (both
    always read; null when missing), and verdict = that SPDX id when both are there and say the same simple id, or when the
    repo has no package.json and its only license file is one standard text whole (canonicalLicense); else 'unclear'. */
export function readLicense(root) {
  const names = fs.readdirSync(root).filter((f) => /^(LICEN[CS]E|COPYING)(\.(md|txt))?$/i.test(f) && fs.lstatSync(path.join(root, f)).isFile());
  const name = names[0];
  let pkgLicense = null;
  const pkg = path.join(root, 'package.json'), pkgStat = fs.lstatSync(pkg, { throwIfNoEntry: false });
  if (pkgStat?.isFile()) {
    try { const l = JSON.parse(fs.readFileSync(pkg, 'utf8')).license; if (typeof l === 'string') pkgLicense = l.slice(0, 100); } catch { /* not JSON: no license from it */ }
  }
  let file = null, canonical = null;
  if (name) {
    const all = fs.readFileSync(path.join(root, name), 'utf8'), t = all.trimStart().slice(0, 2000);
    canonical = canonicalLicense(all);
    file = canonical ?? (EXTRA_TERMS.test(all) ? null : SPDX.find(([re]) => re.test(t))?.[1] ?? null);
  }
  const agreed = pkgLicense && file && SIMPLE_SPDX.test(pkgLicense) && pkgLicense === file;
  const verdict = agreed || (!pkgStat && canonical && names.length === 1) ? file : 'unclear';
  return { package: pkgLicense, file, verdict };
}

function frontName(dir) {
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(fs.readFileSync(path.join(dir, 'SKILL.md'), 'utf8'))?.[1] ?? '';
  return /^name:\s*(\S[^\r\n]{0,99})/m.exec(fm)?.[1].trim() ?? null;
}

/**
 * -> { dir, repo, commit, license, skills: [{ dir, name, ok, blocking, info, files }] }. Throws on a refused URL, a scratch
 * root at or inside the skills folder, a destination that is not an empty folder, a failed clone, or a tree over the
 * limits (then what this run put in the destination is removed, and the destination too if this run made it).
 * opts.cloneUrlOverride (tests only: a local file:// repo) and opts.limits (tests: lower ones) are never read from the
 * command line or the environment.
 */
export function intake(url, { scratchRoot, env = process.env, skillsDir, timeoutMs = 120_000, cloneUrlOverride, limits } = {}) {
  const { host, segments, repo, cloneUrl } = parseRepoUrl(url);
  const root = fs.realpathSync(scratchRoot), rootSt = fs.statSync(root);
  if (rootSt.uid !== process.getuid() || rootSt.mode & 0o022) throw new Error(`Thư mục tạm phải của anh, không để người khác ghi được: ${root}`);
  for (let a = path.dirname(root); ; a = path.dirname(a)) {   // (a parent others may write to, without the sticky bit, could swap the folder)
    const as = fs.statSync(a);
    if ((as.uid !== process.getuid() && as.uid !== 0) || (as.mode & 0o022 && !(as.mode & 0o1000)))
      throw new Error(`Thư mục cha của thư mục tạm để người khác đổi được: ${a}`);
    if (a === path.dirname(a)) break;
  }
  const forbidden = [skillsDir ?? path.join(env.HOME || os.homedir(), '.claude', 'skills'), path.resolve(import.meta.dirname, '../..')];
  for (const f of forbidden) {
    let real = path.resolve(f); try { real = fs.realpathSync(f); } catch { /* missing: compare as written */ }
    if (inside(real, root)) throw new Error(`Thư mục tạm không được nằm trong thư mục skills (${real}): ${root}`);
  }
  const dir = path.join(root, [host, ...segments].join('-'));
  const st = fs.lstatSync(dir, { throwIfNoEntry: false });
  if (!st) fs.mkdirSync(dir, { mode: 0o700 });
  else if (!st.isDirectory() || fs.readdirSync(dir).length) throw new Error(`Thư mục đích phải mới và trống: ${dir}`);
  else if (st.uid !== process.getuid() || st.mode & 0o022) throw new Error(`Thư mục đích có sẵn phải của anh, không để người khác ghi được: ${dir}`);

  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-intake-home-'));
  const gitEnv = cleanGitEnv(env, home), flags = safeFlags(Boolean(cloneUrlOverride));
  const run = (args, what) => {
    const r = spawnSync('git', args, { env: gitEnv, timeout: timeoutMs, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if (r.status !== 0) throw new Error(`git ${what} lỗi: ${(r.stderr || r.error?.message || 'quá giờ').trim().slice(0, 500)}`);
    return r.stdout;
  };
  const lim = { ...LIMITS, ...limits };
  let commit;
  try {
    const args = cloneArgs(cloneUrlOverride ?? cloneUrl, dir, { allowFile: Boolean(cloneUrlOverride), maxFileBytes: lim.maxFileBytes });
    const c = spawnSync(process.execPath, ['-e', WATCH, '--', dir, String(lim.maxTotalBytes * 2), ...args],
      { env: gitEnv, timeout: timeoutMs, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if (c.status === 3) throw new Error(`Kho vượt giới hạn khi đang tải: thư mục quá ${lim.maxTotalBytes * 2} byte, đã dừng git và xoá phần đã tải`);
    if (c.status !== 0) throw new Error(`git clone lỗi: ${(c.stderr || c.error?.message || 'quá giờ').trim().slice(0, 500)}`);
    if (/filtering not recognized by server/.test(c.stderr))
      throw new Error('Máy chủ không hỗ trợ lọc file theo cỡ (partial clone): không nhận kho này, đã xoá phần đã tải');
    // (objects the filter left out are listed as "?<id>"; --missing=print never fetches them, ls-tree -l would)
    if (run([...flags, '-C', dir, 'rev-list', '--objects', '--missing=print', 'HEAD'], 'rev-list').split('\n').some((l) => l.startsWith('?')))
      throw new Error(`Kho vượt giới hạn: có file lớn hơn ${lim.maxFileBytes} byte, không tải các file đó; đã xoá phần đã tải`);
    const over = overLimits(run([...flags, '-C', dir, 'ls-tree', '-r', '-l', '-z', 'HEAD'], 'ls-tree'), lim);
    if (over) throw new Error(`Kho vượt giới hạn, chưa lấy file ra và đã xoá phần đã tải: ${over}`);
    run([...flags, '-C', dir, 'checkout', '-q', 'HEAD'], 'checkout');
    commit = run([...flags, '-C', dir, 'rev-parse', 'HEAD'], 'rev-parse').trim();
  } catch (e) {
    if (st) for (const f of fs.readdirSync(dir)) fs.rmSync(path.join(dir, f), { recursive: true, force: true });
    else fs.rmSync(dir, { recursive: true, force: true });
    throw e;
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }

  const skills = skillDirs(dir).map((rel) => {
    const abs = path.join(dir, rel);
    return { dir: rel, name: frontName(abs) ?? (rel === '.' ? segments.at(-1) : path.basename(rel)), ...auditSkill(abs) };
  });
  return { dir, repo, commit, license: readLicense(dir), skills };
}

// CLI: skill-intake.mjs <url> [--scratch <dir>] -> the report as JSON (exit 0 even when a skill is blocked: read "ok").
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [url, ...rest] = process.argv.slice(2);
  const i = rest.indexOf('--scratch');
  if (!url || (i >= 0 && !rest[i + 1])) { console.error('Dùng: skill-intake.mjs <url> [--scratch <thư mục>]'); process.exit(1); }
  try {
    parseRepoUrl(url);   // (a refused URL makes no temp folder either)
    const scratchRoot = i >= 0 ? rest[i + 1] : fs.mkdtempSync(path.join(os.tmpdir(), 'skill-intake-'));
    console.log(JSON.stringify(intake(url, { scratchRoot }), null, 2));
  } catch (e) { console.error(e.message); process.exit(1); }
}
