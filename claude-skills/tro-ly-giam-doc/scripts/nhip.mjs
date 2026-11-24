#!/usr/bin/env node
// Nhịp công ty: the nightly round, started by cron. Rebuilds the kho, then writes the day's digest (improvement loop
// due, stuck tickets, owed reviews, ledgers, accounts) to <companyDir>/ban-tin/<YYYY-MM-DD>.md. It calls no model and
// sends nothing out: the only address it reaches is My Office on this machine, through digest.mjs. One digest a day: a
// later run the same day stands aside unless --lai; a day whose kho failed, or that has no file yet, is free to try again.
// Node stdlib only.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { companyDir, edit } from './store.mjs';
import { digest } from './digest.mjs';
import { places } from '../../kho-du-lieu/scripts/kho.mjs';

const KHO_CLI = path.resolve(import.meta.dirname, '../../kho-du-lieu/scripts/kho.mjs');
const KHO_LIMIT_MS = 90 * 60_000, OWNER_MAX_MS = 3 * 3600_000;   // (the owner limit is above the build's: a pid can be reused)
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
const pad = (n) => String(n).padStart(2, '0');

/** The local date, as the file name of that day's digest. */
export const dayOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Rebuilds the kho in a child process, so a crash or the time limit cannot stop the digest -> { ok, text }. */
export function buildKho({ env = process.env, spawn = spawnSync } = {}) {
  const startedAt = Date.now();
  const r = spawn(process.execPath, [KHO_CLI, 'build'], { env, encoding: 'utf8', timeout: KHO_LIMIT_MS, maxBuffer: 64 * 1024 * 1024 });
  const { db } = places(env);
  if (r.status === 0) {
    const { nhom, canhBao } = JSON.parse(r.stdout);
    const rows = Object.values(nhom).reduce((a, b) => a + b, 0), secs = Math.round((Date.now() - startedAt) / 1000);
    return { ok: true, text: `dựng lại xong, ${rows} mục, ${secs} giây, ${canhBao} cảnh báo` };
  }
  try { for (const end of ['', '-journal']) fs.rmSync(`${db}.tmp-${r.pid}${end}`, { force: true }); } catch { /* nothing to clean */ }   // (a killed build cannot clean up)
  const why = r.error?.message || String(r.stderr ?? '').trim().split('\n').at(-1) || `thoát với mã ${r.status}`;
  let old = 'chưa có bản cũ';
  try { old = `vẫn dùng bản ${fs.statSync(db).mtime.toLocaleString('vi-VN')}`; } catch { /* none */ }
  return { ok: false, text: `LỖI: ${why.slice(0, 300)}; ${old}` };
}

/** Claims the round -> whether it is ours. A lock left by a process that died, or held too long, is taken over. */
function claim(file, now) {
  let mine = false;
  edit(file, (o) => {
    if (o?.pid && now - o.at < OWNER_MAX_MS && alive(o.pid)) return o;
    mine = true;
    return { pid: process.pid, at: now.getTime() };
  });
  return mine;
}

/** One round -> { ok, file, kho } or { ok: true, file, skipped }. */
export async function beat({ env = process.env, now = new Date(), force = false, fetchAccounts, buildKho: rebuild = buildKho, makeDigest = digest } = {}) {
  const dir = path.join(companyDir({ env }), 'ban-tin'), file = path.join(dir, `${dayOf(now)}.md`), lock = path.join(dir, 'nhip.json');
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });   // (tickets and account emails: for this user only)
  const done = () => !force && fs.existsSync(file) && !/\n- Kho: LỖI[^\n]*\n$/.test(fs.readFileSync(file, 'utf8'));
  if (done()) return { ok: true, file, skipped: 'đã có bản tin hôm nay' };
  if (!claim(lock, now)) return { ok: true, file, skipped: 'đang chạy' };
  try {
    if (done()) return { ok: true, file, skipped: 'đã có bản tin hôm nay' };   // (another run finished while this one was claiming)
    const kho = rebuild({ env });
    const md = await makeDigest({ env, now, ...(fetchAccounts && { fetchAccounts }) });
    const tmp = `${file}.tmp.${process.pid}`;
    fs.writeFileSync(tmp, `${md}\n## Nhịp đêm\n- Kho: ${kho.text}\n`, { mode: 0o600 });
    fs.renameSync(tmp, file);
    return { ok: kho.ok, file, kho: kho.text };
  } finally { edit(lock, () => ({})); }
}

// CLI: nhip.mjs [--lai] — JSON on stdout; exit 1 when the kho or the digest failed.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  try {
    if (args.some((a) => a !== '--lai')) throw new Error('Dùng: nhip.mjs [--lai]');
    const r = await beat({ force: args.includes('--lai') });
    console.log(JSON.stringify(r));
    if (!r.ok) process.exitCode = 1;
  } catch (e) { console.error(e.message); process.exitCode = 1; }
}
