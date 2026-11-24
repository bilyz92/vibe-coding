// One way to change a repo's PROGRESS.md, for everyone who writes it (quota.mjs: owed Codex reviews; the
// phong-ky-su scripts: stage reports and lessons): under a lock (a directory, made atomically), written to a temp file
// and renamed into place, so writers side by side lose nothing. A lock whose owner died, or older than 30 s, is
// broken instead of blocking every later write. Node stdlib only.
import fs from 'node:fs';
import path from 'node:path';

const STALE_MS = 30_000, DEAD_MS = 1_000, TRIES = 250, WAIT_MS = 20;
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };

function stale(lock) {
  try {
    const { pid, at } = JSON.parse(fs.readFileSync(path.join(lock, 'owner'), 'utf8'));
    // (a dead owner only after DEAD_MS: one that just let go and exited may already be followed by a new holder, whose
    // fresh lock must not be taken for its stale one — writes hold the lock for milliseconds)
    return Date.now() - at > STALE_MS || (Date.now() - at > DEAD_MS && !alive(pid));
  } catch {   // (no owner file yet: just being made, unless it's been like that a while)
    try { return Date.now() - fs.statSync(lock).mtimeMs > STALE_MS; } catch { return false; }
  }
}

/* Removing the lock — a holder letting go, or a waiter breaking a stale one — happens only under a second lock, the
   breaker (<lock>.breaker): so the lock a waiter judged stale is still that very lock when it removes it (no holder can
   let go and no other waiter can break it in between, and a new one can't be taken while it's there). */
function underBreaker(lock, fn) {
  const breaker = `${lock}.breaker`;
  for (let i = 0; i < TRIES; i++) {
    try { fs.mkdirSync(breaker); } catch {
      try { if (Date.now() - fs.statSync(breaker).mtimeMs > STALE_MS) fs.rmSync(breaker, { recursive: true, force: true }); } catch { /* gone */ }
      sleep(WAIT_MS); continue;
    }
    try { return fn(); } finally { fs.rmSync(breaker, { recursive: true, force: true }); }
  }
  throw new Error(`Đang bị khoá (${breaker})`);
}

/** Runs fn() holding the lock <lock> (a directory) -> what fn returns. Shared by every read-modify-write of a state file. */
export function withLock(lock, fn) {
  let held = false;
  for (let i = 0; i < TRIES && !held; i++) {
    try { fs.mkdirSync(lock); held = true; } catch {
      if (stale(lock)) { underBreaker(lock, () => { if (stale(lock)) fs.rmSync(lock, { recursive: true, force: true }); }); continue; }   // (judged again, under the breaker)
      sleep(WAIT_MS);
    }
  }
  if (!held) throw new Error(`Đang bị khoá (${lock})`);
  try {
    fs.writeFileSync(path.join(lock, 'owner'), JSON.stringify({ pid: process.pid, at: Date.now() }));
    return fn();
  } finally { underBreaker(lock, () => fs.rmSync(lock, { recursive: true, force: true })); }
}

/** fn(the file's text, '# Tiến độ\n' when there is none) -> the new text; written atomically under the lock. */
export function editProgress(repoDir, fn) {
  const file = path.join(repoDir, 'PROGRESS.md');
  withLock(path.join(repoDir, '.progress.lock'), () => {
    const before = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '# Tiến độ\n';
    const tmp = `${file}.tmp.${process.pid}`;
    fs.writeFileSync(tmp, fn(before).replace(/\n*$/, '\n'));
    fs.renameSync(tmp, file);
  });
}
