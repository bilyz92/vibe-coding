// The company's runtime data (tickets, proposals, trial counters, repo list, third-party skills): small JSON files in
// ~/.claude/company/ (COMPANY_DIR overrides it). Every read-modify-write goes under codex-review's withLock, so sessions
// side by side lose nothing. Node stdlib only.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { withLock } from '../../codex-review/scripts/progress-lock.mjs';

export const companyDir = ({ env = process.env } = {}) => env.COMPANY_DIR || path.join(os.homedir(), '.claude', 'company');

/** An id that is safe as a file name -> the id; anything else throws before a path is ever built from it. */
export function safeId(id) {
  if (typeof id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9-]{0,63}$/.test(id)) throw new Error(`Mã không hợp lệ: ${JSON.stringify(id)}`);
  return id;
}

/** -> the parsed file, or null when it is missing or not valid JSON. */
export function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

/** Writes through a temp file and a rename, so a reader never sees half a file. */
export function writeJson(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp.${process.pid}`;
  fs.writeFileSync(tmp, `${JSON.stringify(obj, null, 2)}\n`);
  fs.renameSync(tmp, file);
}

/** fn(the current object, or null) -> the new one; read and written under the file's lock. Returns what was written. */
export function edit(file, fn) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  return withLock(`${file}.lock`, () => { const next = fn(readJson(file)); writeJson(file, next); return next; });
}

/** A fresh id: <prefix>-YYYYMMDD-HHMMSS-xxx (UTC, three random letters). */
export function newId(prefix, now = new Date()) {
  const s = now.toISOString().replace(/[-:]/g, '');
  const rnd = Array.from({ length: 3 }, () => String.fromCharCode(97 + Math.floor(Math.random() * 26))).join('');
  return `${prefix}-${s.slice(0, 8)}-${s.slice(9, 15)}-${rnd}`;
}
