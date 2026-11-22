// Codex out of quota or credits: tell it apart from other failures, keep the reviews it owes in the repo's
// PROGRESS.md (under "## Chờ Codex review", so Claude carries on with other work and any later session sees them),
// and probe whether Codex answers again. Node stdlib only.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { editProgress } from './progress-lock.mjs';

const QUOTA_RE = /out of credits|refill|usage limit|rate[ _-]?limit|quota|insufficient_quota|\b429\b|too many requests/i;
export const HEADING = '## Chờ Codex review';

/** Is this error Codex running out of quota / credits (as opposed to any other failure)? */
export const isQuotaError = (msg) => QUOTA_RE.test(String(msg ?? ''));

/** "try again in 2h 5m" / "in 35 minutes" / "in 40s" -> seconds, or null when the message gives no time. */
export function retryAfterSeconds(msg) {
  const m = /\bin\s+((?:\d+\s*(?:h|hours?|m|min(?:ute)?s?|s|sec(?:ond)?s?)\s*)+)/i.exec(String(msg ?? ''));
  if (!m) return null;
  let s = 0;
  for (const [, n, u] of m[1].matchAll(/(\d+)\s*(h|hours?|m|min(?:ute)?s?|s|sec(?:ond)?s?)/gi)) s += Number(n) * (/^h/i.test(u) ? 3600 : /^m/i.test(u) ? 60 : 1);
  return s || null;
}

const file = (repoDir) => path.join(repoDir, 'PROGRESS.md');
const LINE = /^- \[( |x)\] (CR-\d{8}-\d{6}-[a-z0-9]{3}) · ([^·]+) · ([^·]+) · nhánh ([^·]+) · (.*)$/;
const stamp = (d) => d.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);

/** Adds an owed review to PROGRESS.md -> its id. entry: { skill, scope, branch, reason, at? } */
export function addPending(repoDir, { skill, scope, branch, reason, at = new Date() }) {
  const id = `CR-${stamp(at)}-${Math.random().toString(36).slice(2, 5).padEnd(3, '0')}`;
  const clean = (s) => String(s ?? '').replace(/[·\n]/g, ' ').trim() || '-';
  const line = `- [ ] ${id} · ${clean(skill)} · ${clean(scope)} · nhánh ${clean(branch)} · ${at.toISOString().slice(0, 16).replace('T', ' ')} UTC · ${clean(reason)}`;
  editProgress(repoDir, (doc) => {   // (the lock shared with phong-ky-su's reports and lessons)
    let text = doc;
    if (!text.includes(`\n${HEADING}\n`) && !text.startsWith(`${HEADING}\n`)) text = `${text.replace(/\s*$/, '\n')}\n${HEADING}\n\n`;
    const lines = text.split('\n'), h = lines.indexOf(HEADING);
    let end = h + 1;   // after the heading's last item (or its blank line)
    while (end < lines.length && !/^## /.test(lines[end])) end++;
    while (end > h + 1 && lines[end - 1].trim() === '') end--;
    lines.splice(end, 0, ...(end === h + 1 ? ['', line] : [line]));
    return lines.join('\n');
  });
  return id;
}

/** The owed reviews in PROGRESS.md -> [{ id, done, skill, scope, branch, rest }] */
export function listPending(repoDir) {
  const f = file(repoDir);
  if (!fs.existsSync(f)) return [];
  return fs.readFileSync(f, 'utf8').split('\n').map((l) => LINE.exec(l)).filter(Boolean)
    .map((m) => ({ id: m[2], done: m[1] === 'x', skill: m[3].trim(), scope: m[4].trim(), branch: m[5].trim(), rest: m[6].trim() }));
}

/** Ticks an owed review off -> whether it was there. */
export function markDone(repoDir, id) {
  if (!fs.existsSync(file(repoDir))) return false;
  let hit = false;
  editProgress(repoDir, (doc) => doc.split('\n').map((l) => { const m = LINE.exec(l); if (m && m[2] === id && m[1] === ' ') { hit = true; return l.replace('- [ ]', '- [x]'); } return l; }).join('\n'));
  return hit;
}

/** The Codex account to use now: what My Office wrote in ~/.codex-now (one with room left), unless CODEX_HOME is set or
    that folder has no sign-in -> a folder, or null (Codex's own default). */
export function activeCodexHome({ env = process.env, homeDir = os.homedir() } = {}) {
  if (env.CODEX_HOME) return null;
  try {
    const dir = fs.readFileSync(path.join(homeDir, '.codex-now'), 'utf8').trim();
    if (!dir || !path.isAbsolute(dir)) return null;
    const real = fs.realpathSync(dir);   // (the target is what gets pinned: a link retargeted later must not move a session)
    return fs.lstatSync(path.join(real, 'auth.json')).isFile() ? real : null;
  } catch { return null; }
}

/** The home a new session runs in and keeps: an explicit CODEX_HOME, else the account My Office chose, else null. */
export const sessionCodexHome = ({ env = process.env, homeDir = os.homedir() } = {}) => env.CODEX_HOME || activeCodexHome({ env: {}, homeDir });

/** The home a quota probe uses on each try: the CODEX_HOME given when the command started (never overridden), else the
    account My Office chooses now, else null (the caller unsets CODEX_HOME: Codex's default). */
export const quotaCodexHome = (explicit, { homeDir = os.homedir() } = {}) => explicit || activeCodexHome({ env: {}, homeDir });

/** Asks Codex for a one-word answer -> { status: 'ok' | 'quota' | 'error', detail, retry_after_seconds }.
    command: { cmd, prependArgs } (the runner's resolveCodexCommand()). */
/** Codex's own account of its limits (`codex app-server`: account/rateLimits/read) -> { reached, resetsAt (ms) } or null
    (no answer: an older codex, not signed in). A tiny request can still go through when the real work wouldn't (the
    week's limit on the model reviews use): this says what Codex itself counts. */
export function readLimits({ command, timeoutMs = 20_000 } = {}) {
  return new Promise((resolve) => {
    let child, buf = '', done = false;
    const finish = (r) => { if (done) return; done = true; clearTimeout(timer); try { child?.kill(); } catch { /* gone */ } resolve(r); };
    const timer = setTimeout(() => finish(null), timeoutMs);
    try { child = spawn(command.cmd, [...command.prependArgs, 'app-server'], { stdio: ['pipe', 'pipe', 'ignore'] }); } catch { finish(null); return; }
    child.on('error', () => finish(null)); child.on('exit', () => finish(null)); child.stdin.on('error', () => {});
    const send = (o) => { try { child.stdin.write(`${JSON.stringify(o)}\n`); } catch { /* gone */ } };
    child.stdout.on('data', (d) => {
      buf += d;
      for (let i = buf.indexOf('\n'); i >= 0; i = buf.indexOf('\n')) {
        const line = buf.slice(0, i); buf = buf.slice(i + 1);
        let m; try { m = JSON.parse(line); } catch { continue; }
        if (m.id === 1) { send({ method: 'initialized', params: {} }); send({ id: 2, method: 'account/rateLimits/read', params: {} }); }
        else if (m.id === 2) {
          const r = m.result?.rateLimits; if (!r) { finish(null); return; }
          const wins = [r.primary, r.secondary].filter((w) => w && Number.isFinite(w.usedPercent));
          const full = wins.filter((w) => w.usedPercent >= 100), stops = full.length ? full : r.rateLimitReachedType ? wins : [];
          finish({ reached: stops.length > 0, resetsAt: stops.length ? Math.max(...stops.map((w) => (w.resetsAt || 0) * 1000)) : 0 });
        }
      }
    });
    send({ id: 1, method: 'initialize', params: { clientInfo: { name: 'codex-review', title: 'codex-review', version: '1' } } });
  });
}

export async function probeQuota({ command, timeoutMs = 120_000 } = {}) {
  const lim = await readLimits({ command });
  if (lim?.reached) return { status: 'quota', detail: 'Codex rate limit reached', retry_after_seconds: lim.resetsAt ? Math.max(60, Math.round((lim.resetsAt - Date.now()) / 1000)) : null };
  return new Promise((resolve) => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-probe-'));
    let out = '', done = false;
    const finish = (r) => { if (done) return; done = true; clearTimeout(timer); try { fs.rmSync(cwd, { recursive: true, force: true }); } catch { /* fine */ } resolve(r); };
    let child;
    try {
      child = spawn(command.cmd, [...command.prependArgs, 'exec', '--skip-git-repo-check', '--sandbox', 'read-only', 'Reply with the single word OK'], { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) { finish({ status: 'error', detail: String(e.message || e).slice(0, 300) }); return; }
    const timer = setTimeout(() => { try { child.kill(); } catch { /* gone */ } finish({ status: 'error', detail: 'probe timed out' }); }, timeoutMs);
    child.stdout.on('data', (c) => { out += c; });
    child.stderr.on('data', (c) => { out += c; });
    child.on('error', (e) => finish({ status: 'error', detail: String(e.message || e).slice(0, 300) }));
    child.on('close', (code) => {
      const tail = out.trim().slice(-400);
      if (isQuotaError(out)) finish({ status: 'quota', detail: tail, retry_after_seconds: retryAfterSeconds(out) });
      else finish(code === 0 ? { status: 'ok', detail: tail } : { status: 'error', detail: tail });
    });
  });
}
