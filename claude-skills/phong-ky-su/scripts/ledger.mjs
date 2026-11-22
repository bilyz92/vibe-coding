#!/usr/bin/env node
// Phòng Kỹ sư phần mềm — the ledger that says whether the `nhanh` level pays off: per task its level, when it started
// and merged, Codex rounds and escapes (a revert or a fix ticket, recorded by hand). Kept next to the Tester returns,
// inside git-common-dir (shared by worktrees, never in `git status`), written under a lock. Node stdlib + git.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stateDir } from './guards.mjs';
import { withLock } from '../../codex-review/scripts/progress-lock.mjs';

const LEVELS = ['day-du', 'nhanh'], ESCAPES = ['revert', 'fix-ticket'];
const MIN_NHANH = 6, PASS_PCT = 40, STOP_PCT = 20;
const WEAK = `chưa đủ ${MIN_NHANH} việc, kết luận yếu`;

function checkLevel(level) { if (!LEVELS.includes(level)) throw new Error(`Không có mức "${level}" (day-du | nhanh)`); }
function isoTime(at) {
  if (at == null) return new Date().toISOString();
  const t = Date.parse(at); if (Number.isNaN(t)) throw new Error(`Không phải thời điểm: ${at}`);
  return new Date(t).toISOString();
}

const ledgerFile = (repoDir) => path.join(stateDir(repoDir), 'ledger.json');
/** Every entry, [] when there is no ledger yet. A broken file is an error (never overwritten with an empty ledger). */
export function readLedger(repoDir) {
  const file = ledgerFile(repoDir);
  if (!fs.existsSync(file)) return [];
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { throw new Error(`Sổ ${file} hỏng: ${e.message}`); }
}

/** fn(entries) under the lock; the entries are written back (tmp + rename) -> what fn returns. */
function edit(repoDir, fn) {
  const dir = stateDir(repoDir), file = path.join(dir, 'ledger.json');
  return withLock(path.join(dir, 'ledger.lock'), () => {   // (several sessions side by side: nothing lost)
    const all = readLedger(repoDir), result = fn(all);
    const tmp = `${file}.tmp.${process.pid}`;
    fs.writeFileSync(tmp, JSON.stringify(all, null, 2)); fs.renameSync(tmp, file);
    return result;
  });
}
/** fn(the entry with that id) -> the entry; an unknown id is an error, nothing is added. */
const change = (repoDir, id, fn) => edit(repoDir, (all) => {
  const e = all.find((x) => x.id === id); if (!e) throw new Error(`Không có việc ${id} trong sổ`);
  fn(e); return e;
});

/** A new task -> its entry. Started again (same id): the first entry stands. */
export function startTask(repoDir, { id, level } = {}) {
  if (!id) throw new Error('Thiếu id việc');
  checkLevel(level);
  return edit(repoDir, (all) => {
    const had = all.find((x) => x.id === id); if (had) return had;
    const e = { id, level, startedAt: new Date().toISOString(), mergedAt: null, codexRounds: 0, escapes: 0 };
    all.push(e); return e;
  });
}
export const recordMerge = (repoDir, id, at) => { const t = isoTime(at); return change(repoDir, id, (e) => { e.mergedAt = t; }); };
export const addCodexRound = (repoDir, id) => change(repoDir, id, (e) => { e.codexRounds += 1; });
export function recordEscape(repoDir, id, kind) {
  if (!ESCAPES.includes(kind)) throw new Error(`Lỗi lọt phải là ${ESCAPES.join(' | ')}: ${kind}`);
  return change(repoDir, id, (e) => { e.escapes += 1; });
}
/** The level raised after a recheck (nhanh -> day-du, or kept); never lowered; startedAt kept. */
export function setLevel(repoDir, id, level) {
  checkLevel(level);
  return change(repoDir, id, (e) => {
    if (e.level === 'day-du' && level === 'nhanh') throw new Error(`Không hạ mức việc ${id} từ day-du xuống nhanh`);
    e.level = level;
  });
}

function median(xs) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
/** Per level: { count, merged, medianMs (start -> merge, merged tasks only; null if none), escapes, rounds }. */
export function summarize(entries) {
  return Object.fromEntries(LEVELS.map((level) => {
    const es = entries.filter((e) => e.level === level), done = es.filter((e) => e.mergedAt);
    return [level, { count: es.length, merged: done.length, medianMs: median(done.map((e) => Date.parse(e.mergedAt) - Date.parse(e.startedAt))),
      escapes: es.reduce((s, e) => s + (e.escapes || 0), 0), rounds: es.reduce((s, e) => s + (e.codexRounds || 0), 0) }];
  }));
}

/** summarize() -> { verdict: dat | dung | chua-ket-luan, reductionPct, reason, warnings }. Any escape at nhanh stops it;
    then nhanh must cut the median time by >= 40% to pass, < 20% stops it, in between is not yet decided. */
export function verdict(summary) {
  const d = summary['day-du'], n = summary.nhanh;
  const warnings = n.merged < MIN_NHANH ? [WEAK] : [];
  const r = (v, reductionPct, reason) => ({ verdict: v, reductionPct, reason, warnings });
  const raw = d.merged && n.merged && d.medianMs > 0 ? ((d.medianMs - n.medianMs) * 100) / d.medianMs : null;   // (decides)
  const pct = raw == null ? null : Math.round(raw * 100) / 100;   // (shown)
  if (n.escapes >= 1) return r('dung', pct, `mức nhanh có ${n.escapes} lỗi lọt`);
  if (raw == null) return r('chua-ket-luan', null, `chưa có việc đã merge ở mức ${!n.merged ? 'nhanh' : 'day-du'}`);
  if (raw >= PASS_PCT) return r('dat', pct, `nhanh giảm ${pct}% thời gian, không lỗi lọt`);
  if (raw < STOP_PCT) return r('dung', pct, `nhanh chỉ giảm ${pct}% thời gian (< ${STOP_PCT}%)`);
  return r('chua-ket-luan', pct, `nhanh giảm ${pct}% thời gian (${STOP_PCT}%–${PASS_PCT}%)`);
}

// CLI: start <repo> <id> <day-du|nhanh> | level <repo> <id> <day-du|nhanh> | round <repo> <id>
//      | merge <repo> <id> [ISO time] | escape <repo> <id> <revert|fix-ticket> | summary <repo>
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [op, repo, id, arg] = process.argv.slice(2), out = (x) => process.stdout.write(`${JSON.stringify(x)}\n`);
  try {
    if (op === 'start') out(startTask(repo, { id, level: arg }));
    else if (op === 'level') out(setLevel(repo, id, arg));
    else if (op === 'round') out(addCodexRound(repo, id));
    else if (op === 'merge') out(recordMerge(repo, id, arg));
    else if (op === 'escape') out(recordEscape(repo, id, arg));
    else if (op === 'summary') { const s = summarize(readLedger(repo)); out({ ...s, ...verdict(s) }); }
    else throw new Error('Dùng: ledger.mjs start|level|round|merge|escape|summary <repo> …');
  } catch (e) { console.error(e.message); process.exit(1); }
}
