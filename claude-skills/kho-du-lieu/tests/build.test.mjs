// kho build: gathering everything into kho.db (AC-6 … AC-12).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { makeEnv, kho, them, seed, ticket, write, writeJson, git } from './helpers.mjs';

const GROUPS = ['tài liệu', 'phiếu', 'phòng ban', 'đề xuất', 'skill ngoài', 'cải tiến', 'bài học', 'docs', 'commit', 'phiên review'];
const ids = (r) => r.out.results.map((x) => x.ma);

test('AC-6: build creates kho.db and stats counts every group', () => {
  const e = makeEnv();
  seed(e);
  them(e, { tieuDe: 'Một tài liệu' });
  const b = kho(e, ['build']);
  assert.equal(b.code, 0, b.stderr);
  assert.ok(fs.existsSync(path.join(e.COMPANY_DIR, 'kho', 'kho.db')));
  const s = kho(e, ['stats']);
  assert.equal(s.code, 0, s.stderr);
  assert.deepEqual(Object.keys(s.out.nhom), GROUPS);
  assert.deepEqual(GROUPS.map((g) => s.out.nhom[g]), [1, 2, 1, 1, 1, 1, 1, 1, 2, 1]);
});

test('AC-7: a word found only in a ticket\'s analysis, result or notes finds that ticket', () => {
  const e = makeEnv();
  seed(e);
  kho(e, ['build']);
  for (const w of ['zanalysisword', 'zresultword', 'znotesword']) {
    const r = kho(e, ['search', w]);
    assert.equal(r.code, 0, r.stderr);
    assert.deepEqual(ids(r), ['P-20261101-100000-aaa'], w);
    assert.equal(r.out.results[0].nhom, 'phiếu');
  }
});

test('AC-8: query reads a Codex session\'s verdict and rounds', () => {
  const e = makeEnv();
  seed(e);
  kho(e, ['build']);
  const r = kho(e, ['query', 'SELECT verdict, rounds FROM reviews']);
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(r.out.rows, [{ verdict: 'APPROVE', rounds: 3 }]);
});

test('AC-9: a second build over the same data gives the same rows, no duplicates', () => {
  const e = makeEnv();
  seed(e);
  kho(e, ['build']);
  const one = kho(e, ['stats']).out;
  const b = kho(e, ['build']);
  assert.equal(b.code, 0, b.stderr);
  assert.deepEqual(kho(e, ['stats']).out, one);
  assert.equal(kho(e, ['query', 'SELECT count(*) AS n FROM fts']).out.rows[0].n, Object.values(one.nhom).reduce((a, b) => a + b, 0));
});

test('AC-10: a new ticket appears and a deleted doc disappears on the next build', () => {
  const e = makeEnv();
  const repo = seed(e);
  kho(e, ['build']);
  ticket(e, 'P-20261102-100000-new', { title: 'Phiếu mới zfreshword' });
  fs.rmSync(path.join(repo, 'docs', 'a.md'));
  kho(e, ['build']);
  assert.deepEqual(ids(kho(e, ['search', 'zfreshword'])), ['P-20261102-100000-new']);
  assert.deepEqual(kho(e, ['search', 'zdocsword']).out.results, []);
  assert.equal(kho(e, ['stats']).out.nhom.docs, 0);
});

test('AC-11: repos from repos.json and from the project folder (with PROGRESS.md or docs/) come in once each', () => {
  const e = makeEnv();
  const listed = path.join(e.root, 'elsewhere', 'listed');
  write(path.join(listed, 'docs', 'l.md'), 'zlistedword');
  const both = path.join(e.KHO_PROJECTS_DIR, 'both');
  write(path.join(both, 'PROGRESS.md'), '## Bài học\n- zbothword\n');
  write(path.join(e.KHO_PROJECTS_DIR, 'plain', 'README.md'), 'zplainword');
  write(path.join(e.KHO_PROJECTS_DIR, 'plain', 'notes.md'), 'zplainword');
  writeJson(path.join(e.COMPANY_DIR, 'repos.json'), { repos: [listed, both, `${both}/`] });
  const b = kho(e, ['build']);
  assert.equal(b.code, 0, b.stderr);
  assert.equal(kho(e, ['search', 'zlistedword']).out.results.length, 1);
  assert.equal(kho(e, ['search', 'zbothword']).out.results.length, 1);
  assert.deepEqual(kho(e, ['search', 'zplainword']).out.results, []);
  const repos = kho(e, ['query', 'SELECT path FROM repos ORDER BY path']).out.rows.map((r) => r.path);
  assert.deepEqual(repos, [both, listed].sort());
});

test('AC-12: a broken repo or a broken ticket file is skipped with a warning; the rest is built', () => {
  const e = makeEnv();
  seed(e);
  write(path.join(e.COMPANY_DIR, 'tickets', 'P-20261101-100002-bad.json'), '{ not json');
  const broken = path.join(e.KHO_PROJECTS_DIR, 'broken');
  write(path.join(broken, '.git'), 'gitdir: /nowhere');   // (looks like git, is not)
  write(path.join(broken, 'docs', 'b.md'), 'zbrokenword');
  const b = kho(e, ['build']);
  assert.equal(b.code, 0, b.stderr);
  assert.match(b.stderr, /P-20261101-100002-bad\.json/);
  assert.match(b.stderr, /broken/);
  const s = kho(e, ['stats']).out.nhom;
  assert.equal(s['phiếu'], 2);
  assert.equal(s.commit, 2);
  assert.equal(kho(e, ['search', 'zbrokenword']).out.results.length, 1);
});

test('AC-12: a repo whose git log fails does not stop the build', () => {
  const e = makeEnv();
  const repo = path.join(e.KHO_PROJECTS_DIR, 'empty-git');
  fs.mkdirSync(path.join(repo, 'docs'), { recursive: true });
  git(repo, 'init', '-q');   // (no commit yet: git log exits 128)
  write(path.join(repo, 'docs', 'x.md'), 'zemptyword');
  const b = kho(e, ['build']);
  assert.equal(b.code, 0, b.stderr);
  assert.equal(kho(e, ['search', 'zemptyword']).out.results.length, 1);
});

test('a .md over 2 MiB is skipped by build with a warning naming it', () => {
  const e = makeEnv();
  const repo = seed(e);
  write(path.join(repo, 'docs', 'huge.md'), `zhugeword ${'x'.repeat(2 * 1024 * 1024)}`);
  write(path.join(e.KHO_DIR, 'huge-kho.md'), `zhugeword ${'x'.repeat(2 * 1024 * 1024)}`);
  const b = kho(e, ['build']);
  assert.equal(b.code, 0, b.stderr);
  assert.match(b.stderr, /2 MiB: .*huge\.md/);
  assert.match(b.stderr, /2 MiB: .*huge-kho\.md/);
  assert.deepEqual(kho(e, ['search', 'zhugeword']).out.results, []);
});

test('every commit is kept: no cut-off', () => {
  const e = makeEnv();
  const repo = path.join(e.KHO_PROJECTS_DIR, 'many');
  write(path.join(repo, 'PROGRESS.md'), 'x');
  git(repo, 'init', '-q');
  // (5001 empty commits through fast-import: quicker than 5001 git commit calls)
  const lines = [];
  for (let i = 1; i <= 5001; i++) lines.push(`commit refs/heads/master\ncommitter T <t@e> ${1700000000 + i} +0000\ndata ${String(i).length}\n${i}\n${i > 1 ? '' : ''}`);
  const r = spawnSync('git', ['-C', repo, 'fast-import', '--quiet'], { input: lines.join('\n'), encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const b = kho(e, ['build']);
  assert.equal(b.code, 0, b.stderr);
  assert.equal(kho(e, ['stats']).out.nhom.commit, 5001);
});

test('a folder that cannot be read is skipped with a warning; the rest is built', (t) => {
  if (process.getuid?.() === 0) return t.skip('root đọc được mọi thư mục');
  const e = makeEnv();
  const repo = seed(e);
  const locked = path.join(repo, 'docs', 'locked');
  write(path.join(locked, 'x.md'), 'zlockedword');
  fs.chmodSync(locked, 0o000);
  after(() => fs.chmodSync(locked, 0o755));
  const b = kho(e, ['build']);
  assert.equal(b.code, 0, b.stderr);
  assert.match(b.stderr, /locked/);
  assert.equal(kho(e, ['search', 'zdocsword']).out.results.length, 1);
  assert.equal(kho(e, ['stats']).out.nhom.commit, 2);
});

test('a linked git worktree in the project folder is not indexed a second time; listed in repos.json it still is', () => {
  const e = makeEnv();
  const repo = seed(e);
  const wt = path.join(e.KHO_PROJECTS_DIR, 'repo-a-wt');
  git(repo, 'worktree', 'add', '-q', '-b', 'nhanh-phu', wt);
  const b = kho(e, ['build']);
  assert.equal(b.code, 0, b.stderr);
  assert.deepEqual(kho(e, ['query', 'SELECT path FROM repos']).out.rows.map((r) => r.path), [repo]);
  assert.equal(kho(e, ['search', 'zdocsword']).out.results.length, 1);
  assert.equal(kho(e, ['search', 'zlessonword']).out.results.length, 1);
  assert.equal(kho(e, ['stats']).out.nhom.commit, 2);
  writeJson(path.join(e.COMPANY_DIR, 'repos.json'), { repos: [wt] });
  assert.equal(kho(e, ['build']).code, 0);
  assert.deepEqual(kho(e, ['query', 'SELECT path FROM repos ORDER BY path']).out.rows.map((r) => r.path), [repo, wt].sort());
});

test('a repo whose .git is a file but is not a linked worktree (separate git dir, submodule) is still indexed', () => {
  const e = makeEnv();
  const repo = path.join(e.KHO_PROJECTS_DIR, 'tach-git');
  write(path.join(repo, 'docs', 's.md'), 'zseparateword');
  git(e.root, 'init', '-q', `--separate-git-dir=${path.join(e.root, 'gitdir-rieng')}`, repo);
  git(repo, 'add', '.'); git(repo, 'commit', '-q', '-m', 'zseparatecommit');
  const b = kho(e, ['build']);
  assert.equal(b.code, 0, b.stderr);
  assert.ok(fs.statSync(path.join(repo, '.git')).isFile());
  assert.equal(kho(e, ['search', 'zseparateword']).out.results.length, 1);
  assert.equal(kho(e, ['search', 'zseparatecommit']).out.results.length, 1);
});

test('the same commit reachable from two clones is indexed once', () => {
  const e = makeEnv();
  const repo = seed(e);
  const clone = path.join(e.KHO_PROJECTS_DIR, 'repo-a-clone');
  git(e.KHO_PROJECTS_DIR, 'clone', '-q', repo, clone);
  const b = kho(e, ['build']);
  assert.equal(b.code, 0, b.stderr);
  assert.equal(kho(e, ['query', 'SELECT count(*) AS n FROM repos']).out.rows[0].n, 2);
  assert.equal(kho(e, ['stats']).out.nhom.commit, 2);
  assert.equal(kho(e, ['search', 'zcommitword']).out.results.length, 1);
});
