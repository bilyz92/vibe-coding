// node --test ~/.claude/skills/phong-ky-su/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { chooseLevel, recheck, MAX_FILES, MAX_LINES } from '../scripts/rigor.mjs';

const CLI = path.resolve(import.meta.dirname, '../scripts/rigor.mjs');
/** A temp dir removed when the test ends. */
const tmp = (t) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'phong-rigor-')); t.after(() => fs.rmSync(d, { recursive: true, force: true })); return d; };
const f = (p, added, deleted = 0) => ({ path: p, added, deleted });
/** A unified diff of one file: `ctx` kept, `del` removed, `add` added. */
const diff = (p, { add = [], del = [], ctx = [] } = {}) =>
  [`diff --git a/${p} b/${p}`, `--- a/${p}`, `+++ b/${p}`, '@@ -1 +1 @@', ...ctx.map((l) => ` ${l}`), ...del.map((l) => `-${l}`), ...add.map((l) => `+${l}`)].join('\n');
const CATCH_UP = ['ba', 'planner + /codex-plan-review', 'tester'];

test('the thresholds are 3 files and 150 lines', () => {
  assert.equal(MAX_FILES, 3); assert.equal(MAX_LINES, 150);
});

test('AC-1: the word nhanh or day-du in the request forces the level; both -> day-du', () => {
  assert.deepEqual(chooseLevel('Sửa nút Lưu, làm nhanh giúp anh'), { level: 'nhanh', source: 'ep-tay' });
  assert.deepEqual(chooseLevel('Thêm báo cáo, day-du nhé', { estFiles: 1, estLines: 5 }), { level: 'day-du', source: 'ep-tay' });
  assert.deepEqual(chooseLevel('NHANH thôi nhưng phải day-du'), { level: 'day-du', source: 'ep-tay' });
  assert.equal(chooseLevel('tạo nhánh mới cho việc này', { estFiles: 9, estLines: 900 }).level, 'day-du');   // ("nhánh" is not "nhanh")
});

test('AC-2: no forcing word -> by the estimate; at most 3 files and 150 lines is nhanh, missing estimate is day-du', () => {
  assert.deepEqual(chooseLevel('sửa nút', { estFiles: 3, estLines: 150 }), { level: 'nhanh', source: 'uoc-luong' });
  assert.deepEqual(chooseLevel('sửa nút', { estFiles: 4, estLines: 10 }), { level: 'day-du', source: 'uoc-luong' });
  assert.deepEqual(chooseLevel('sửa nút', { estFiles: 1, estLines: 151 }), { level: 'day-du', source: 'uoc-luong' });
  assert.equal(chooseLevel('sửa nút').level, 'day-du');
  assert.equal(chooseLevel('sửa nút', { estFiles: 2 }).level, 'day-du');
});

test('AC-3: lines are added + deleted of non-test files; test files are not counted; binary = 0 lines, 1 file', () => {
  const tests = [f('a.test.js', 400), f('src/b.spec.ts', 300), f('tests/x.mjs', 200), f('src/__tests__/y.js', 100), f('c.test.mjs', 999, 5)];
  const code = [f('src/a.js', 50), f('src/b.js', 40, 10), f('src/c.js', 50)];
  assert.equal(recheck('nhanh', [...code, ...tests]).level, 'nhanh');
  assert.equal(recheck('nhanh', [...code, ...tests]).lineCount, 150);
  assert.equal(recheck('nhanh', [...code, ...tests]).fileCount, 3);
  assert.equal(recheck('nhanh', [...code, f('src/d.js', 1)]).level, 'day-du');
  assert.equal(recheck('nhanh', [f('src/a.js', 100, 51)]).level, 'day-du');   // (deleted lines count)
  assert.equal(recheck('nhanh', [f('src/a.js', 150), f('img.png', '-', '-'), f('b.js', 0)]).level, 'nhanh');
  const bin = recheck('nhanh', [f('src/a.js', 1), f('img.png', '-', '-'), f('b.js', 1), f('c.js', 1)]);
  assert.equal(bin.level, 'day-du'); assert.equal(bin.fileCount, 4); assert.equal(bin.lineCount, 3);
});

test('AC-4: a sensitive path is always day-du, reason nhay-cam, even when nhanh was forced', () => {
  assert.equal(chooseLevel('làm nhanh').level, 'nhanh');
  for (const p of ['prisma/migrations/2026_x/migration.sql', '.env', '.env.local', 'Dockerfile', 'api/Dockerfile.prod', 'docker-compose.yml',
    '.gitlab-ci.yml', '.github/workflows/ci.yml', 'deploy/run.sh', 'src/auth/session.ts', 'lib/crypto/hash.js', 'src/cors.ts', 'src/middleware.ts']) {
    const r = recheck('nhanh', [f(p, 1)]);
    assert.equal(r.level, 'day-du', p); assert.equal(r.reason, 'nhay-cam', p);
  }
  for (const p of ['src/author.js', 'docs/deployment.md', 'src/button.tsx']) assert.equal(recheck('nhanh', [f(p, 1)]).level, 'nhanh', p);
});

test('AC-5: sensitive content in added lines only -> day-du; the same text deleted or as context is not', () => {
  const lines = [`'use server'`, `"use server"`, 'const u = process.env.DB_URL', 'const SECRET = 1', 'API_KEY=x', 'const password = form.get("p")', 'headers.token = t',
    `res.setHeader('Access-Control-Allow-Origin', '*')`, `createHash('sha256')`, `import crypto from 'node:crypto'`,
    'const q = `SELECT id FROM users`', 'INSERT INTO logs VALUES (1)', 'await prisma.$queryRaw`x`', 'await prisma.$executeRaw`x`'];
  for (const l of lines) {
    const r = recheck('nhanh', [f('src/x.ts', 1, 1)], diff('src/x.ts', { add: [l], del: ['old'] }));
    assert.equal(r.level, 'day-du', l); assert.equal(r.reason, 'nhay-cam', l);
    assert.equal(recheck('nhanh', [f('src/x.ts', 1, 1)], diff('src/x.ts', { add: ['ok'], del: [l], ctx: [l] })).level, 'nhanh', `${l} (deleted / context)`);
  }
  assert.equal(recheck('nhanh', [f('src/x.ts', 2, 1)], diff('src/x.ts', { add: ['const label = "Lưu"', 'return label'], del: ['x'] })).level, 'nhanh');
});

test('AC-6: nhanh upgraded to day-du says why and which skipped steps to catch up', () => {
  const big = recheck('nhanh', [f('a.js', 1), f('b.js', 1), f('c.js', 1), f('d.js', 1)]);
  assert.deepEqual(big, { level: 'day-du', upgraded: true, reason: 'vuot-nguong', reasons: ['vuot-nguong'], catchUp: CATCH_UP, fileCount: 4, lineCount: 4, sensitive: [] });
  const mig = recheck('nhanh', [f('prisma/migrations/1/migration.sql', 3)]);
  assert.deepEqual(mig.catchUp, [...CATCH_UP, '/codex-security-review', 'prisma-migration-safety']);
  assert.deepEqual(mig.sensitive, [{ path: 'prisma/migrations/1/migration.sql', why: 'prisma/migrations/' }]);
  const action = recheck('nhanh', [f('app/actions.ts', 1)], diff('app/actions.ts', { add: [`'use server'`] }));
  assert.deepEqual(action.catchUp, [...CATCH_UP, '/codex-security-review', 'nextjs-server-action-security']);
  const all = recheck('nhanh', [f('.env.example', 1), f('a.js', 200)], diff('app/a.ts', { add: [`"use server"`] }));
  assert.deepEqual(all.reasons, ['nhay-cam', 'vuot-nguong']);
  assert.deepEqual(all.catchUp, [...CATCH_UP, '/codex-security-review', 'vibesec', 'nextjs-server-action-security']);
  const already = recheck('day-du', [f('.env', 1), f('a.js', 500)]);
  assert.equal(already.level, 'day-du'); assert.equal(already.upgraded, false); assert.deepEqual(already.catchUp, []);
  assert.deepEqual(recheck('nhanh', [f('a.js', 3)]), { level: 'nhanh', upgraded: false, reason: null, reasons: [], catchUp: [], fileCount: 1, lineCount: 3, sensitive: [] });
  assert.throws(() => recheck('vua', []), /mức/);
});

/** A work repo whose origin is a local bare repo (no network): base commit pushed, origin/master fetched. */
function setupRepo(t, baseFiles = {}) {
  const root = tmp(t), bare = path.join(root, 'origin.git'), dir = path.join(root, 'work');
  execFileSync('git', ['init', '-q', '--bare', bare]);
  fs.mkdirSync(dir);
  const g = (...a) => execFileSync('git', a, { cwd: dir, encoding: 'utf8' });
  g('init', '-q'); g('symbolic-ref', 'HEAD', 'refs/heads/master'); g('config', 'user.email', 't@t'); g('config', 'user.name', 't');
  fs.writeFileSync(path.join(dir, 'app.js'), 'a\nb\n'); fs.writeFileSync(path.join(dir, '.gitignore'), 'out/\n');
  for (const [p, text] of Object.entries(baseFiles)) { fs.mkdirSync(path.dirname(path.join(dir, p)), { recursive: true }); fs.writeFileSync(path.join(dir, p), text); }
  g('add', '-A'); g('commit', '-qm', 'base'); g('remote', 'add', 'origin', bare); g('push', '-q', 'origin', 'master'); g('fetch', '-q', 'origin');
  const write = (p, text) => { fs.mkdirSync(path.dirname(path.join(dir, p)), { recursive: true }); fs.writeFileSync(path.join(dir, p), text); };
  const run = async (...args) => JSON.parse((await promisify(execFile)('node', [CLI, 'recheck', dir, ...args])).stdout);
  return { dir, g, write, run };
}
const n = (k) => Array.from({ length: k }, (_, i) => `line ${i}`).join('\n') + '\n';

test('AC-7: CLI recheck reads the diff against origin plus untracked files, prints one JSON line', async (t) => {
  const { g, write, run } = setupRepo(t);
  write('app.js', 'a\nb\nc\nd\n');   // (+2, uncommitted)
  write('src/new.js', n(3));          // (untracked: its 3 lines count)
  write('src/new.test.js', n(500));   // (untracked test: not counted)
  write('out/build.js', n(900));      // (ignored: not counted)
  let r = await run('nhanh');
  assert.equal(r.level, 'nhanh'); assert.equal(r.fileCount, 2); assert.equal(r.lineCount, 5);
  g('add', 'app.js'); g('commit', '-qm', 'wip');   // (committed on the branch: still against origin)
  assert.equal((await run('nhanh')).lineCount, 5);
  write('logo.png', Buffer.from([0, 1, 2, 0, 3]));   // (untracked binary: 1 file, 0 lines)
  r = await run('nhanh');
  assert.equal(r.fileCount, 3); assert.equal(r.lineCount, 5); assert.equal(r.level, 'nhanh');
  write('src/env.js', 'export const u = process.env.DB_URL\n');   // (untracked, sensitive content)
  r = await run('nhanh');
  assert.equal(r.level, 'day-du'); assert.equal(r.upgraded, true); assert.ok(r.reasons.includes('nhay-cam'));
  assert.deepEqual(r.sensitive.find((s) => s.path === 'src/env.js'), { path: 'src/env.js', why: 'process.env' });
  assert.equal((await run('nhanh', '--base', 'HEAD')).fileCount, 3);   // (an explicit base: only the untracked non-test files differ from HEAD)
});

test('AC-7: CLI says what is wrong on stderr and exits 1', async (t) => {
  const { dir } = setupRepo(t);
  await assert.rejects(promisify(execFile)('node', [CLI, 'recheck', dir, 'vua']), (e) => e.code === 1 && /mức/.test(e.stderr));
  await assert.rejects(promisify(execFile)('node', [CLI, 'recheck', dir, 'nhanh', '--base', 'origin/khong-co']), (e) => e.code === 1 && e.stderr.length > 0);
  const { stdout } = await promisify(execFile)('node', [CLI, 'choose', 'làm nhanh']);
  assert.deepEqual(JSON.parse(stdout), { level: 'nhanh', source: 'ep-tay' });
  const est = JSON.parse((await promisify(execFile)('node', [CLI, 'choose', 'sửa nút', '--files', '2', '--lines', '40'])).stdout);
  assert.deepEqual(est, { level: 'nhanh', source: 'uoc-luong' });
});

test('ISSUE-1: raw SQL split over added lines of one hunk is caught; deleted / context lines still are not joined in', () => {
  const r1 = recheck('nhanh', [f('src/q.ts', 2)], diff('src/q.ts', { add: ['const q = `SELECT id', '  FROM users`'] }));
  assert.equal(r1.level, 'day-du'); assert.deepEqual(r1.sensitive, [{ path: 'src/q.ts', why: 'SQL thô' }]);
  assert.equal(recheck('nhanh', [f('src/q.ts', 2)], diff('src/q.ts', { add: ['db.run(`INSERT', 'INTO logs VALUES (1)`)'] })).level, 'day-du');
  assert.equal(recheck('nhanh', [f('src/q.ts', 1, 1)], diff('src/q.ts', { ctx: ['const q = `SELECT id'], add: ['  FROM users`'] })).level, 'nhanh');   // (SELECT only in context)
  assert.equal(recheck('nhanh', [f('src/q.ts', 1, 1)], diff('src/q.ts', { del: ['INSERT'], add: ['INTO the box'] })).level, 'nhanh');   // (INSERT only deleted)
  const twoHunks = [`diff --git a/src/q.ts b/src/q.ts`, '--- a/src/q.ts', '+++ b/src/q.ts', '@@ -1 +1 @@', '+// SELECT one', '@@ -9 +9 @@', '+import x FROM "y"'].join('\n');
  assert.equal(recheck('nhanh', [f('src/q.ts', 2)], twoHunks).level, 'nhanh');   // (not joined across hunks)
});

test('ISSUE-2: a rename is one file with its real numstat; path rules see the old and the new path; only really added lines are scanned', async (t) => {
  assert.equal(recheck('nhanh', [{ path: 'src/session.ts', oldPath: 'src/auth/session.ts', added: 0, deleted: 0 }]).level, 'day-du');   // (moved out of auth/)
  const big = n(200) + 'const token = process.env.TOKEN\n';
  const { g, write, run } = setupRepo(t, { 'src/big.js': big, 'src/auth/login.js': 'x\n' });
  g('mv', 'src/big.js', 'src/huge.js');
  let r = await run('nhanh');
  assert.deepEqual([r.level, r.fileCount, r.lineCount], ['nhanh', 1, 0]);   // (pure rename: not 201 deleted + 201 added)
  write('src/huge.js', big.replace('line 5\n', 'line five\n'));
  r = await run('nhanh');
  assert.deepEqual([r.level, r.fileCount, r.lineCount], ['nhanh', 1, 2]);   // (rename + edit: only the edit)
  g('mv', 'src/auth/login.js', 'src/login.js');
  r = await run('nhanh');
  assert.equal(r.level, 'day-du'); assert.deepEqual(r.sensitive, [{ path: 'src/login.js', why: 'auth/' }]);
});

test('ISSUE-4: an untracked symlink is one file whose content is its target string; the target is never read', async (t) => {
  const outside = tmp(t), secretFile = path.join(outside, 'cfg.js');
  fs.writeFileSync(secretFile, 'const k = process.env.KEY\n' + n(500));
  const { dir, run } = setupRepo(t, { 'lib/real.js': n(400) });
  fs.symlinkSync(secretFile, path.join(dir, 'out-link.js'));        // (outside the repo)
  fs.symlinkSync('lib/real.js', path.join(dir, 'in-link.js'));     // (to a file in the repo)
  fs.symlinkSync('lib', path.join(dir, 'dir-link'));               // (to a directory)
  const r = await run('nhanh');
  assert.deepEqual([r.level, r.fileCount, r.lineCount, r.sensitive], ['nhanh', 3, 3, []]);
});

test('Tester: "nhanh" after a negation does not force nhanh; it falls back to the estimate', () => {
  for (const s of ['không cần nhanh đâu', 'Đừng làm nhanh', 'khỏi nhanh, cứ làm kỹ', 'chẳng cần nhanh', 'không phải làm nhanh'])
    assert.deepEqual(chooseLevel(s, { estFiles: 9, estLines: 900 }), { level: 'day-du', source: 'uoc-luong' }, s);
  assert.deepEqual(chooseLevel('không cần nhanh', { estFiles: 1, estLines: 10 }), { level: 'nhanh', source: 'uoc-luong' });
  for (const s of ['làm nhanh nhé', 'Không gấp lắm, nhưng làm nhanh giúp anh']) assert.deepEqual(chooseLevel(s), { level: 'nhanh', source: 'ep-tay' }, s);
});

test('ISSUE-1 (round 2): a long multi-line query (30 columns, > 200 chars between SELECT and FROM) is caught', () => {
  const cols = Array.from({ length: 30 }, (_, i) => `  customer_column_${i},`);
  const add = ['const q = `SELECT', ...cols, '  id', 'FROM customers`'];
  assert.ok(add.slice(1, -1).join('\n').length > 200);
  const r = recheck('nhanh', [f('src/q.ts', add.length)], diff('src/q.ts', { add }));
  assert.equal(r.level, 'day-du'); assert.deepEqual(r.sensitive, [{ path: 'src/q.ts', why: 'SQL thô' }]);
});

test('ISSUE-6: "không những / không chỉ / chẳng những nhanh" is affirmative, still forces nhanh', () => {
  for (const s of ['không những nhanh mà còn gọn', 'Làm không chỉ nhanh mà phải đúng', 'chẳng những nhanh, lại rẻ', 'không chỉ làm nhanh mà còn gọn'])
    assert.deepEqual(chooseLevel(s), { level: 'nhanh', source: 'ep-tay' }, s);
  assert.equal(chooseLevel('không cần nhanh đâu', { estFiles: 9, estLines: 900 }).level, 'day-du');
});

// Codex vòng 3 (ISSUE-7): dò SQL phải tuyến tính — nhiều SELECT không có FROM không được làm chậm.
test('SQL thô: nhiều SELECT không FROM trong một khối lớn vẫn nhanh và đúng', () => {
  const big = '+' + 'SELECT x '.repeat(40000);
  const diff = (body) => `diff --git a/src/q.js b/src/q.js\n--- a/src/q.js\n+++ b/src/q.js\n@@ -0,0 +1 @@\n${body}\n`;
  const files = [{ path: 'src/q.js', added: 1, deleted: 0 }];
  const t0 = Date.now();
  const clean = recheck('nhanh', files, diff(big));
  assert.ok(Date.now() - t0 < 1000, `chậm: ${Date.now() - t0} ms`);
  assert.equal(clean.sensitive.some((s) => s.why === 'SQL thô'), false);
  const hit = recheck('nhanh', files, diff(big + ' FROM users'));
  assert.equal(hit.sensitive.some((s) => s.why === 'SQL thô'), true);
});
