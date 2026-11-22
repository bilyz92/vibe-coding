#!/usr/bin/env node
// Kho dữ liệu: the company's knowledge in one place. `them` adds a research / plan / strategy / decision document as a
// .md in the knowledge folder (git, one commit per document); `build` gathers that folder, the company's tickets,
// departments, proposals, outside skills, improvement state, and from every known repo its lessons, docs, commit log
// and Codex review sessions into one SQLite file with full-text search; `search`, `query` (read only) and `stats` read
// it. Never read: files with secret names, Claude's conversations, commit diffs. Node stdlib only (node:sqlite).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

/** Every place kho reads or writes; each one can be moved by an environment variable. */
export function places(env = process.env) {
  const home = os.homedir(), company = env.COMPANY_DIR || path.join(home, '.claude', 'company');
  return {
    company, db: path.join(company, 'kho', 'kho.db'),
    kho: env.KHO_DIR || path.join(home, 'company', 'tri-thuc'),
    projects: env.KHO_PROJECTS_DIR || path.join(home, 'project'),
    skills: env.SKILLS_DIR || path.join(home, '.claude', 'skills'),
    chats: env.CLAUDE_PROJECTS_DIR || path.join(home, '.claude', 'projects'),
  };
}

export const LOAI = ['thi-truong', 'doi-thu', 'ke-hoach', 'chien-luoc', 'quyet-dinh', 'nghien-cuu'];
const GROUPS = [['tài liệu', 'knowledge'], ['phiếu', 'tickets'], ['phòng ban', 'departments'], ['đề xuất', 'proposals'], ['skill ngoài', 'third_party'],
  ['cải tiến', 'improvements'], ['bài học', 'lessons'], ['docs', 'docs'], ['commit', 'commits'], ['phiên review', 'reviews']];
// search: groups in this order (knowledge first, commits last), FTS rank within a group.
const ORDER = `CASE nhom WHEN 'tài liệu' THEN 0 WHEN 'docs' THEN 1 WHEN 'bài học' THEN 2 WHEN 'commit' THEN 4 ELSE 3 END`;
const NO_DB = 'Chưa có kho dữ liệu: chạy `kho build` trước (node kho.mjs build).';
const fail = (msg) => { throw new Error(msg); };

/** Lower case, no Vietnamese marks (NFD, marks dropped, đ -> d): what is indexed and what is searched. */
export const norm = (s) => String(s ?? '').normalize('NFC').normalize('NFD').replace(/\p{M}/gu, '').replace(/[đĐ]/g, 'd').toLowerCase();

// A file or folder with one of these names is skipped before it is opened (.env*, *.env, x.env.y, *.pem, *.key, id_*,
// credentials, token, secret).
const SECRET = [/^\.env/i, /(^|\.)env(\.|$)/i, /\.(pem|key)(\.|$)/i, /^id_/i, /credentials/i, /token/i, /secret/i];
export const secretName = (name) => SECRET.some((re) => re.test(name));

const inside = (dir, p) => p === dir || p.startsWith(dir + path.sep);
const realOr = (p) => { try { return fs.realpathSync(p); } catch { return path.resolve(p); } };
const MAX_BYTES = 2 * 1024 * 1024;
const today = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;
const list = (x) => [x].flat().filter((v) => v != null).flatMap((v) => String(v).split(',')).map((v) => v.trim()).filter(Boolean);
const h1 = (text) => text.match(/^#\s+(.+?)\s*#*\s*$/m)?.[1];

const isDir = (st) => !!st && st.isDirectory();
const parts = (p) => p.split(path.sep).filter(Boolean);
/** The one gate before kho opens anything. `base` bounds where p may be (KHO_DIR, COMPANY_DIR, a repo, or / for
    --tu-file): p must be under it, and no part of p may have a secret name. Every part of p from / down is lstat-ed one
    by one — a link anywhere, above base too, is refused, never followed. The real path must also stay out of Claude's
    conversations (ctx.chats). -> the lstat of p, null when p (or a folder on the way) is not there, or false when refused
    (also when the filesystem says no: ctx.warn names it). */
function check(p, ctx, base) {
  const abs = path.resolve(p), rel = path.relative(path.resolve(base), abs);
  if (rel.startsWith('..') || path.isAbsolute(rel) || parts(abs).some(secretName)) return false;
  try {
    let cur = path.parse(abs).root, st = fs.lstatSync(cur, { throwIfNoEntry: false });
    for (const part of ['', ...parts(abs)]) {
      if (part) { cur = path.join(cur, part); st = fs.lstatSync(cur, { throwIfNoEntry: false }); }
      if (!st) return null;
      if (st.isSymbolicLink()) return false;
    }
    const real = fs.realpathSync(abs);
    return parts(real).some(secretName) || inside(ctx.chats, real) ? false : st;
  } catch (e) { ctx.warn?.(`Bỏ qua (không đọc được: ${e.code ?? e.message}): ${abs}`); return false; }
}

/** A folder kho writes into: every part from / is checked (no link anywhere), then it is created. */
function ensureDir(dir, ctx) {
  const st = check(dir, ctx, path.parse(path.resolve(dir)).root);
  if (st === false) fail(`Không ghi vào thư mục có link hoặc tên bí mật trên đường dẫn: ${dir}`);
  if (st && !st.isDirectory()) fail(`Không phải thư mục: ${dir}`);
  fs.mkdirSync(dir, { recursive: true });
}

/** A folder's entries, or [] with a warning when it cannot be read. */
function listDir(dir, ctx) {
  try { return fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)); } catch (e) { ctx.warn(`Bỏ qua thư mục không đọc được (${e.code ?? e.message}): ${dir}`); return []; }
}

/** A file's text through check(): null when it is missing or refused (refused, unreadable and too large are warned about). */
function readSafe(file, ctx, base) {
  const st = check(file, ctx, base);
  if (st === false || (st && !st.isFile())) { ctx.warn(`Bỏ qua (link, tên bí mật hoặc không phải file): ${file}`); return null; }
  if (!st) return null;
  if (st.size > MAX_BYTES) { ctx.warn(`Bỏ qua file quá 2 MiB: ${file}`); return null; }
  try { return fs.readFileSync(file, 'utf8'); } catch (e) { ctx.warn(`Bỏ qua file không đọc được (${e.code ?? e.message}): ${file}`); return null; }
}
const readJsonSafe = (file, ctx, base) => { const t = readSafe(file, ctx, base); if (t === null) return undefined; try { return JSON.parse(t); } catch { return null; } };

/** .md files under root -> absolute paths. The root and every entry go through check() from base; .git and
    node_modules are skipped; a file over 2 MiB, or a folder that cannot be read, is skipped with a warning. */
function mdFiles(root, ctx, base = root) {
  const out = [];
  const rootSt = check(root, ctx, base);
  if (rootSt === false) { ctx.warn(`Bỏ qua thư mục (link, tên bí mật): ${root}`); return out; }
  if (!rootSt?.isDirectory()) return out;
  const walk = (dir) => {
    for (const e of listDir(dir, ctx)) {
      const p = path.join(dir, e.name), st = check(p, ctx, base);
      if (!st) continue;
      if (st.isDirectory()) { if (e.name !== '.git' && e.name !== 'node_modules') walk(p); }
      else if (st.isFile() && e.name.endsWith('.md')) { if (st.size > MAX_BYTES) ctx.warn(`Bỏ qua file quá 2 MiB: ${p}`); else out.push(p); }
    }
  };
  walk(root);
  return out;
}

// --- documents: the small YAML frontmatter kho writes ---
const scalar = (v) => { if (v.startsWith('"')) { try { return JSON.parse(v); } catch { return v; } } return v; };
/** -> { meta, body }; a file without frontmatter is all body. */
export function parseDoc(text) {
  if (!text.startsWith('---\n')) return { meta: {}, body: text };
  const end = text.indexOf('\n---\n', 3);
  if (end < 0) return { meta: {}, body: text };
  const meta = {};
  let key = null;
  for (const line of text.slice(4, end).split('\n')) {
    const item = line.match(/^\s+-\s+(.*)$/), kv = line.match(/^([a-z-]+):\s*(.*)$/);
    if (item && key) meta[key].push(scalar(item[1]));
    else if (kv) { key = kv[2] === '' ? kv[1] : null; meta[kv[1]] = kv[2] === '' ? [] : kv[2] === '[]' ? [] : scalar(kv[2]); }
  }
  return { meta, body: text.slice(end + 5) };
}
const yamlList = (xs) => (xs.length ? `\n${xs.map((x) => `  - ${JSON.stringify(x)}`).join('\n')}` : ' []');
const slug = (s) => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/, '');

function git(dir, args) {
  const r = spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.error || r.status !== 0) throw new Error(`git ${args.find((a) => !a.startsWith('-') && !a.includes('=')) ?? ''}: ${(r.stderr || r.error?.message || '').trim()}`);
  return r.stdout;
}

/** Commits one file in the knowledge folder, making it a git repo first if it is not one. */
function commitDoc(dir, file, title) {
  if (!fs.existsSync(path.join(dir, '.git'))) git(dir, ['init', '-q']);
  const has = (k) => spawnSync('git', ['-C', dir, 'config', k], { encoding: 'utf8' }).stdout?.trim();
  const opts = ['-c', 'commit.gpgsign=false', ...(has('user.name') ? [] : ['-c', 'user.name=kho-du-lieu']), ...(has('user.email') ? [] : ['-c', 'user.email=kho-du-lieu@localhost'])];
  const name = path.basename(file);
  git(dir, ['add', '--', name]);
  git(dir, [...opts, 'commit', '-q', '-m', `Thêm tri thức: ${title}`, '--', name]);
}

/** Adds one document -> { ok, file } (or { ok, daCo: true, file } when --tu-file brings the same file again). */
export function them(v, p = places()) {
  let body = v['noi-dung'] ?? '', title = v['tieu-de'], sources = list(v.nguon), src = null;
  if (v['tu-file']) {
    src = path.resolve(v['tu-file']);
    const st = check(src, { chats: realOr(p.chats) }, path.parse(src).root);
    if (st === false) fail(`Không nhập link, file bí mật hay hội thoại Claude: ${src}`);
    if (!st?.isFile()) fail(`Không có file: ${src}`);
    if (st.size > MAX_BYTES) fail(`File quá 2 MiB, không nhập: ${src}`);
    body = fs.readFileSync(src, 'utf8');
    title ??= h1(body);
    sources = [...new Set([src, ...sources])];
  }
  const missing = [!v.loai && 'loai', !String(title ?? '').trim() && 'tieu-de', !sources.length && 'nguon'].filter(Boolean);
  if (missing.length) fail(`Thiếu trường: ${missing.join(', ')}`);
  title = String(title).trim().replace(/\s+/g, ' ');
  const status = v['trang-thai'] ?? 'hieu-luc', day = v.ngay ?? today(), ticket = v.phieu ?? '', tags = list(v.the);
  if (!LOAI.includes(v.loai)) fail(`loai không hợp lệ: ${v.loai} (một trong: ${LOAI.join(', ')})`);
  if (!['hieu-luc', 'cu'].includes(status) && !/^thay-bang:[^\s/\\]+\.md$/.test(status))
    fail(`trang-thai không hợp lệ: ${status} (hieu-luc | cu | thay-bang:<file>.md)`);
  if (!isDate(day)) fail(`ngay không hợp lệ: ${day} (YYYY-MM-DD)`);
  if (ticket && !/^[A-Za-z0-9][A-Za-z0-9-]{0,63}$/.test(ticket)) fail(`phieu không hợp lệ: ${ticket}`);
  const name = slug(title);
  if (!name) fail(`tieu-de không tạo được tên file: ${title}`);
  const quiet = { chats: realOr(p.chats), warn: () => {} };
  ensureDir(p.kho, quiet);
  if (src) {   // (the same source with the same body is already in: nothing to add)
    for (const f of mdFiles(p.kho, quiet)) {
      const d = parseDoc(readSafe(f, quiet, p.kho) ?? '');
      if ([d.meta.nguon].flat().includes(src) && d.body === body) return { ok: true, daCo: true, file: f };
    }
  }
  const file = path.join(p.kho, `${day}-${name}.md`);
  const text = `---\nloai: ${v.loai}\ntieu-de: ${JSON.stringify(title)}\nngay: ${day}\nphieu: ${JSON.stringify(ticket)}\ntrang-thai: ${status}\n`
    + `nguon:${yamlList(sources)}\nthe:${yamlList(tags)}\n---\n${body}`;
  if (Buffer.byteLength(text) > MAX_BYTES) fail('Tài liệu quá 2 MiB, không thêm: tách thành nhiều tài liệu nhỏ hơn');
  try { fs.writeFileSync(file, text, { flag: 'wx' }); } catch (e) {
    if (e.code === 'EEXIST') fail(`Tài liệu đã có: ${file} (không ghi đè; đổi --tieu-de hoặc --ngay)`);
    throw e;
  }
  try { commitDoc(p.kho, file, title); } catch (e) {   // (all or nothing: a document that is not committed is not left behind)
    spawnSync('git', ['-C', p.kho, 'rm', '-q', '--cached', '--ignore-unmatch', '--', path.basename(file)]);
    fs.rmSync(file, { force: true });
    fail(`Không commit được, chưa thêm tài liệu: ${e.message}`);
  }
  return { ok: true, file };
}

// --- build ---
const SCHEMA = `
CREATE TABLE knowledge(path TEXT PRIMARY KEY, loai, tieu_de, ngay, phieu, trang_thai, nguon, the, body);
CREATE TABLE tickets(id TEXT PRIMARY KEY, title, status, department, created_at, updated_at, data);
CREATE TABLE departments(name TEXT PRIMARY KEY, title, status, handles, data);
CREATE TABLE proposals(id TEXT PRIMARY KEY, status, name, data);
CREATE TABLE third_party(name TEXT PRIMARY KEY, source, commit_hash, audited_at, mode, findings);
CREATE TABLE improvements(last_at, data);
CREATE TABLE repos(path TEXT PRIMARY KEY);
CREATE TABLE lessons(repo, text);
CREATE TABLE docs(repo, path TEXT PRIMARY KEY, title, body);
CREATE TABLE commits(repo, hash TEXT PRIMARY KEY, author, date, message);
CREATE TABLE reviews(repo, session, skill, verdict, rounds, timestamp, PRIMARY KEY(repo, session));
CREATE VIRTUAL TABLE fts USING fts5(tieu_de_n, noi_dung_n, nhom UNINDEXED, ma UNINDEXED, tieu_de UNINDEXED, duong_dan UNINDEXED,
  noi_dung UNINDEXED, ngay UNINDEXED, loai UNINDEXED, the UNINDEXED, trang_thai UNINDEXED);`;

/** Every string inside a JSON value, one per line (what a ticket or a proposal is searched by). */
const strings = (x) => (typeof x === 'string' ? [x] : Array.isArray(x) ? x.flatMap(strings) : x && typeof x === 'object' ? Object.values(x).flatMap(strings) : []);
const sqlVal = (x) => (x === undefined || x === null ? null : typeof x === 'boolean' ? Number(x) : typeof x === 'object' ? JSON.stringify(x) : x);
const jsonFiles = (dir, ctx, base) => (isDir(check(dir, ctx, base)) ? listDir(dir, ctx).map((e) => e.name).filter((n) => n.endsWith('.json')) : []);

/** A linked git worktree (.git is a file and git's own folder is not the shared one): the same history, docs and
    lessons as its main checkout. A .git file git cannot read is not one. */
function linkedWorktree(dir) {
  if (!fs.lstatSync(path.join(dir, '.git'), { throwIfNoEntry: false })?.isFile()) return false;
  const r = spawnSync('git', ['-C', dir, 'rev-parse', '--git-dir', '--git-common-dir'], { encoding: 'utf8' });   // (paths may be relative to dir)
  const [own, common] = r.status === 0 ? r.stdout.trim().split('\n') : [];
  return !!own && !!common && realOr(path.resolve(dir, own)) !== realOr(path.resolve(dir, common));
}

/** Repos from repos.json (always) and folders in the project folder that have a PROGRESS.md or docs/ and are not a
    linked git worktree — once each, never inside the Claude conversations folder. -> real paths, sorted. */
function findRepos(p, ctx) {
  const found = new Set();
  const add = (dir, needsContent) => {
    const st = check(dir, ctx, needsContent ? p.projects : dir);
    if (st === false) { if (!needsContent || !secretName(path.basename(dir))) ctx.warn(`Bỏ qua repo (link, tên bí mật hoặc hội thoại Claude): ${dir}`); return; }
    if (!st?.isDirectory()) { if (!needsContent) ctx.warn(`Bỏ qua repo không có: ${dir}`); return; }
    if (needsContent && !fs.existsSync(path.join(dir, 'PROGRESS.md')) && !fs.existsSync(path.join(dir, 'docs'))) return;
    if (needsContent && linkedWorktree(dir)) return;
    found.add(realOr(dir));
  };
  const listed = readJsonSafe(path.join(p.company, 'repos.json'), ctx, p.company) ?? { repos: [] };
  if (!Array.isArray(listed?.repos)) ctx.warn('Bỏ qua repos.json hỏng');
  for (const r of listed?.repos ?? []) if (typeof r === 'string') add(path.resolve(r), false);
  const names = isDir(check(p.projects, ctx, p.projects)) ? listDir(p.projects, ctx).map((e) => e.name) : [];
  for (const n of names) add(path.join(p.projects, n), true);
  return [...found].sort();
}

/** The "- …" lines of a PROGRESS.md's "## Bài học" section. */
function lessons(file, ctx, base) {
  const text = readSafe(file, ctx, base) ?? '';
  const start = text.search(/^## Bài học[ \t]*$/m);
  if (start < 0) return [];
  const rest = text.slice(start).split('\n').slice(1);
  const end = rest.findIndex((l) => l.startsWith('## '));
  return (end < 0 ? rest : rest.slice(0, end)).filter((l) => l.startsWith('- ')).map((l) => l.slice(2).trim());
}

/** Commit metadata only (hash, author, date, message): never a diff or a file list. */
function commits(repo) {
  const out = git(repo, ['-c', 'core.fsmonitor=false', '-c', 'log.showSignature=false', 'log', '--no-color', '--format=%H%x1f%an%x1f%aI%x1f%B%x1e']);
  return out.split('\x1e').map((r) => r.replace(/^\n+/, '')).filter(Boolean).map((r) => {
    const [hash, author, date, message] = r.split('\x1f');
    return { hash, author, date, message: (message ?? '').trim() };
  });
}

/** Rebuilds kho.db from scratch (into a temp file, then renamed over the old one). -> { ok, file, nhom, canhBao } */
export function build(p = places(), warn = (m) => console.error(`Cảnh báo: ${m}`)) {
  let warnings = 0;
  const w = (m) => { warnings++; warn(m); };
  const ctx = { chats: realOr(p.chats), warn: w };
  const dirs = (dir, base) => (isDir(check(dir, ctx, base)) ? listDir(dir, ctx).filter((e) => e.isDirectory()).map((e) => e.name) : []);
  ensureDir(path.dirname(p.db), ctx);
  const tmp = `${p.db}.tmp-${process.pid}`;
  fs.rmSync(tmp, { force: true });
  const db = new DatabaseSync(tmp);
  try {
    db.exec(SCHEMA);
    db.exec('BEGIN');
    const ins = {};
    const put = (table, row) => {
      const keys = Object.keys(row);
      ins[table] ??= db.prepare(`INSERT OR IGNORE INTO ${table}(${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`);
      return ins[table].run(...keys.map((k) => sqlVal(row[k]))).changes;
    };
    const index = (nhom, { ma, tieuDe, duongDan = null, noiDung = '', ngay = null, loai = null, the = null, trangThai = null }) =>
      put('fts', { tieu_de_n: norm(tieuDe), noi_dung_n: norm(noiDung), nhom, ma, tieu_de: tieuDe, duong_dan: duongDan, noi_dung: noiDung, ngay, loai, the, trang_thai: trangThai });

    for (const f of mdFiles(p.kho, ctx, p.kho)) {
      const text = readSafe(f, ctx, p.kho);
      if (text === null) continue;
      const { meta, body } = parseDoc(text);
      const tags = [meta.the].flat().filter(Boolean).map(String), title = String(meta['tieu-de'] || h1(body) || path.basename(f, '.md'));
      put('knowledge', { path: f, loai: meta.loai, tieu_de: title, ngay: meta.ngay, phieu: meta.phieu, trang_thai: meta['trang-thai'], nguon: [meta.nguon].flat().filter(Boolean), the: tags, body });
      index('tài liệu', { ma: f, tieuDe: title, duongDan: f, noiDung: body, ngay: meta.ngay ? String(meta.ngay) : null, loai: meta.loai ?? null,
        the: `,${tags.join(',')},`, trangThai: meta['trang-thai'] ?? null });
    }
    const ticketDir = path.join(p.company, 'tickets');
    for (const n of jsonFiles(ticketDir, ctx, p.company)) {
      const t = readJsonSafe(path.join(ticketDir, n), ctx, p.company);
      if (t === undefined) continue;
      if (!t || typeof t.id !== 'string' || typeof t.title !== 'string') { w(`Bỏ qua phiếu hỏng: ${n}`); continue; }
      if (!put('tickets', { id: t.id, title: t.title, status: t.status, department: t.department, created_at: t.createdAt, updated_at: t.updatedAt, data: t })) continue;
      index('phiếu', { ma: t.id, tieuDe: t.title, duongDan: path.join(ticketDir, n), noiDung: strings(t).join('\n'), ngay: String(t.updatedAt ?? t.createdAt ?? '').slice(0, 10) || null });
    }
    for (const n of dirs(p.skills, p.skills)) {
      const f = path.join(p.skills, n, 'department.json');
      const d = readJsonSafe(f, ctx, p.skills);
      if (d === undefined) continue;
      if (!d || typeof d.name !== 'string') { w(`Bỏ qua ${n}/department.json hỏng`); continue; }
      if (put('departments', { name: d.name, title: d.title, status: d.status, handles: d.handles, data: d }))
        index('phòng ban', { ma: d.name, tieuDe: String(d.title ?? d.name), duongDan: f, noiDung: strings(d).join('\n') });
    }
    const propDir = path.join(p.company, 'proposals');
    for (const n of jsonFiles(propDir, ctx, p.company)) {
      const d = readJsonSafe(path.join(propDir, n), ctx, p.company);
      if (d === undefined) continue;
      if (!d || typeof d !== 'object') { w(`Bỏ qua đề xuất hỏng: ${n}`); continue; }
      const id = String(d.id ?? path.basename(n, '.json'));
      if (put('proposals', { id, status: d.status, name: d.spec?.name, data: d }))
        index('đề xuất', { ma: id, tieuDe: String(d.spec?.title ?? d.spec?.name ?? id), duongDan: path.join(propDir, n), noiDung: strings(d).join('\n') });
    }
    const third = path.join(p.company, 'third-party.json');
    const r3 = readJsonSafe(third, ctx, p.company);
    if (r3 !== undefined) {
      const r = r3;
      if (!Array.isArray(r?.skills)) w('Bỏ qua third-party.json hỏng');
      for (const s of r?.skills ?? []) {
        if (typeof s?.name !== 'string') continue;
        if (put('third_party', { name: s.name, source: s.source, commit_hash: s.commit, audited_at: s.auditedAt, mode: s.mode, findings: s.findings }))
          index('skill ngoài', { ma: s.name, tieuDe: s.name, duongDan: third, noiDung: strings(s).join('\n'), ngay: s.auditedAt ? String(s.auditedAt).slice(0, 10) : null });
      }
    }
    const improve = path.join(p.company, 'improve.json');
    const r4 = readJsonSafe(improve, ctx, p.company);
    if (r4 !== undefined) {
      const r = r4;
      if (!r || typeof r !== 'object') w('Bỏ qua improve.json hỏng');
      else {
        put('improvements', { last_at: r.lastAt, data: r });
        index('cải tiến', { ma: 'improve.json', tieuDe: `Vòng cải tiến gần nhất: ${r.lastAt ?? '?'}`, duongDan: improve, noiDung: strings(r).join('\n'), ngay: r.lastAt ? String(r.lastAt).slice(0, 10) : null });
      }
    }

    for (const repo of findRepos(p, ctx)) {
      put('repos', { path: repo });
      const progress = path.join(repo, 'PROGRESS.md');
      for (const l of lessons(progress, ctx, repo)) {
        put('lessons', { repo, text: l });
        index('bài học', { ma: repo, tieuDe: l.slice(0, 100), duongDan: progress, noiDung: l });
      }
      for (const f of mdFiles(path.join(repo, 'docs'), ctx, repo)) {
        const body = readSafe(f, ctx, repo);
        if (body === null) continue;
        const title = h1(body) ?? path.basename(f, '.md');
        if (put('docs', { repo, path: f, title, body })) index('docs', { ma: f, tieuDe: title, duongDan: f, noiDung: body });
      }
      if (fs.existsSync(path.join(repo, '.git'))) {
        try {
          for (const c of commits(repo))   // (a hash already in, from another clone, is not indexed again)
            if (put('commits', { repo, ...c })) index('commit', { ma: c.hash, tieuDe: c.message.split('\n')[0], duongDan: repo, noiDung: `${c.message}\n${c.author}`, ngay: c.date?.slice(0, 10) ?? null });
        } catch (e) { w(`Bỏ qua commit của ${repo}: ${e.message.split('\n')[0]}`); }
      }
      const sessions = path.join(repo, '.codex-review', 'sessions');
      for (const n of dirs(sessions, repo)) {   // (meta.json only: prompts and outputs may hold code)
        const metaFile = path.join(sessions, n, 'meta.json');
        const m = readJsonSafe(metaFile, ctx, repo);
        if (m === undefined) continue;
        if (!m || typeof m !== 'object') { w(`Bỏ qua phiên review hỏng: ${metaFile}`); continue; }
        const rounds = typeof m.rounds === 'number' ? m.rounds : null;
        if (put('reviews', { repo, session: n, skill: m.skill, verdict: m.verdict, rounds, timestamp: m.timestamp }))
          index('phiên review', { ma: n, tieuDe: `${m.skill ?? n}: ${m.verdict ?? '?'}`, duongDan: path.join(sessions, n), noiDung: `${m.skill ?? ''} ${m.verdict ?? ''} ${repo}`, ngay: m.timestamp ? String(m.timestamp).slice(0, 10) : null });
      }
    }
    db.exec('COMMIT');
  } catch (e) { db.close(); fs.rmSync(tmp, { force: true }); throw e; }
  db.close();
  fs.renameSync(tmp, p.db);
  return { ok: true, file: p.db, nhom: stats(p).nhom, canhBao: warnings };
}

// --- reading ---
function openDb(p) {
  if (!fs.existsSync(p.db)) fail(NO_DB);
  return new DatabaseSync(p.db, { readOnly: true });
}

/** A piece of the original text around the first word that matched. */
function excerpt(text, tokens) {
  const t = String(text ?? '').normalize('NFC'), n = norm(t);
  const hits = tokens.map((w) => n.indexOf(w)).filter((i) => i >= 0);
  const at = hits.length ? Math.min(...hits) : 0, start = Math.max(0, at - 80), end = Math.min(t.length, at + 160);
  return `${start > 0 ? '…' : ''}${t.slice(start, end).replace(/\s+/g, ' ').trim()}${end < t.length ? '…' : ''}`;
}

/** Full-text search. The query's words are each quoted, so nothing in it is FTS5 syntax. Replaced and old documents
    are left out unless caCu. -> { results: [{ nhom, ma, tieuDe, duongDan, trich, ngay, nhan? }], message? } */
export function search(q, { loai, the, tuNgay, caCu = false } = {}, p = places()) {
  if (tuNgay != null && !isDate(tuNgay)) fail(`--tu-ngay không hợp lệ: ${tuNgay} (YYYY-MM-DD)`);
  const db = openDb(p);
  try {
    const tokens = norm(q).match(/[\p{L}\p{N}]+/gu) ?? [];
    if (!tokens.length) return { results: [], message: 'không có kết quả' };
    const where = ['fts MATCH ?'], params = [tokens.map((w) => `"${w}"`).join(' ')];
    if (loai) { where.push('loai = ?'); params.push(loai); }
    for (const tag of list(the)) { where.push('instr(the, ?) > 0'); params.push(`,${tag},`); }
    if (tuNgay) { where.push('ngay >= ?'); params.push(tuNgay); }
    if (!caCu) where.push("(trang_thai IS NULL OR (trang_thai <> 'cu' AND trang_thai NOT LIKE 'thay-bang:%'))");
    const rows = db.prepare(`SELECT nhom, ma, tieu_de, duong_dan, noi_dung, ngay, trang_thai FROM fts WHERE ${where.join(' AND ')} ORDER BY ${ORDER}, rank LIMIT 20`).all(...params);
    const results = rows.map((r) => {
      const nhan = r.trang_thai === 'cu' ? 'cũ' : String(r.trang_thai ?? '').startsWith('thay-bang:') ? `thay bằng ${r.trang_thai.slice(10)}` : undefined;
      return { nhom: r.nhom, ma: r.ma, tieuDe: r.tieu_de, duongDan: r.duong_dan, trich: excerpt(r.noi_dung, tokens), ngay: r.ngay, ...(nhan && { nhan }) };
    });
    return results.length ? { results } : { results, message: 'không có kết quả' };
  } finally { db.close(); }
}

const WRITES = /\b(insert|update|delete|drop|attach|detach|pragma|create|alter|vacuum|reindex)\b|\breplace\s+into\b/i;
/** One read-only SELECT (or WITH … SELECT) -> { rows }. The file is opened read only as well. */
export function query(sql, p = places()) {
  const text = String(sql ?? '').trim();
  const bare = text.replace(/'(?:[^']|'')*'|"(?:[^"]|"")*"/g, "''").replace(/;\s*$/, '');   // (string contents and one final ; out)
  if (!text) fail('Thiếu câu SELECT');
  if (bare.includes(';')) fail('Chỉ chạy được một câu lệnh');
  if (!/^(select|with)\b/i.test(bare) || WRITES.test(bare)) fail('query chỉ đọc: chỉ nhận SELECT hoặc WITH … SELECT');
  const db = openDb(p);
  try { return { rows: db.prepare(text.replace(/;\s*$/, '')).all() }; } finally { db.close(); }
}

/** -> { nhom: rows per group, theoLoai, theoTrangThai } */
export function stats(p = places()) {
  const db = openDb(p);
  try {
    const count = (col) => Object.fromEntries(db.prepare(`SELECT ${col} AS k, count(*) AS n FROM knowledge GROUP BY ${col} ORDER BY ${col}`).all().map((r) => [r.k ?? '(không có)', r.n]));
    return { nhom: Object.fromEntries(GROUPS.map(([name, table]) => [name, db.prepare(`SELECT count(*) AS n FROM ${table}`).get().n])),
      theoLoai: count('loai'), theoTrangThai: count('trang_thai') };
  } finally { db.close(); }
}

// CLI: them --loai L --tieu-de T --nguon N [--the a,b] [--ngay D] [--phieu P] [--trang-thai S] [--noi-dung X | --tu-file F]
//      | build | search <từ> [--loai L] [--the a,b] [--tu-ngay D] [--ca-cu] | query "<SELECT>" | stats — JSON on stdout; errors on stderr, exit 1.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const USAGE = 'Dùng: kho.mjs them --loai L --tieu-de T --nguon N … | build | search <từ> [--loai L] [--the a,b] [--tu-ngay D] [--ca-cu] | query "<SELECT>" | stats';
  try {
    const [op, ...rest] = process.argv.slice(2);
    const { values: v, positionals } = parseArgs({ args: rest, allowPositionals: true, strict: true, options: {
      'loai': { type: 'string' }, 'tieu-de': { type: 'string' }, 'nguon': { type: 'string', multiple: true }, 'the': { type: 'string' },
      'ngay': { type: 'string' }, 'phieu': { type: 'string' }, 'trang-thai': { type: 'string' }, 'noi-dung': { type: 'string' },
      'tu-file': { type: 'string' }, 'tu-ngay': { type: 'string' }, 'ca-cu': { type: 'boolean' } } });
    const out = {
      them: () => them(v),
      build: () => build(),
      search: () => search(positionals.join(' '), { loai: v.loai, the: v.the, tuNgay: v['tu-ngay'], caCu: v['ca-cu'] }),
      query: () => query(positionals.join(' ')),
      stats: () => stats(),
    }[op];
    if (!out) fail(USAGE);
    console.log(JSON.stringify(out(), null, 2));
  } catch (e) { console.error(e.message); process.exit(1); }
}
