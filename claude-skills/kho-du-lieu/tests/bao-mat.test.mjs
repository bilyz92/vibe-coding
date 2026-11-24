// What must never get into kho.db: secret files, Claude's conversations, commit diffs (AC-13 … AC-15).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { makeEnv, kho, seed, write, writeJson, git, them } from './helpers.mjs';

const db = (e) => fs.readFileSync(path.join(e.COMPANY_DIR, 'kho', 'kho.db'));
const dump = (e, table) => JSON.stringify(kho(e, ['query', `SELECT * FROM ${table}`]).out.rows);
const SECRET_NAMES = ['.env', '.env.local', 'khoa.pem', 'x.key', 'id_rsa', 'credentials.json', 'token.txt'];

test('AC-13: files with secret names are never read, wherever they are', () => {
  const e = makeEnv();
  const repo = seed(e);
  const canary = 'SECRET_CANARY_123';
  for (const n of SECRET_NAMES) { write(path.join(repo, n), canary); write(path.join(repo, 'docs', n), canary); }
  // (.md names too, so the name rule is what keeps them out, not the extension)
  for (const n of ['.env.md', 'token.md', 'my-secret.md', 'credentials.md', 'id_rsa.md', 'khoa.pem.md', 'deploy.key.md']) write(path.join(repo, 'docs', n), `# ${canary}\n${canary}`);
  write(path.join(repo, 'docs', 'secrets', 'plain.md'), canary);   // (a folder with a secret name)
  write(path.join(repo, 'docs', 'ok.md'), '# Bình thường\nzokword');
  fs.symlinkSync(path.join(repo, '.env'), path.join(repo, 'docs', 'link.md'));   // (a link to a secret)
  write(path.join(e.KHO_DIR, '.env'), canary);
  write(path.join(e.KHO_DIR, 'token-notes.md'), `---\nloai: nghien-cuu\n---\n${canary}`);
  const b = kho(e, ['build']);
  assert.equal(b.code, 0, b.stderr);
  assert.equal(kho(e, ['search', canary]).out.results.length, 0);
  assert.equal(kho(e, ['search', 'zokword']).out.results.length, 1);
  assert.ok(!db(e).includes(canary), 'canary found in kho.db');
  const all = ['docs', 'knowledge', 'fts'].map((t) => dump(e, t)).join('\n');
  for (const n of [...SECRET_NAMES, '.env.md', 'token.md', 'my-secret.md', 'credentials.md', 'secrets', 'link.md', 'token-notes.md'])
    assert.ok(!all.includes(n), `${n} is in the tables`);
});

test('AC-14: Claude\'s projects folder is never read, even when it looks like a repo', () => {
  const e = makeEnv();
  seed(e);
  const canary = 'CHAT_CANARY_456';
  const chats = e.CLAUDE_PROJECTS_DIR = path.join(e.KHO_PROJECTS_DIR, 'claude-projects');
  write(path.join(chats, '-home-x-project', 'abc.jsonl'), `{"text":"${canary}"}`);
  write(path.join(chats, 'PROGRESS.md'), `## Bài học\n- ${canary}\n`);
  write(path.join(chats, 'docs', 'chat.md'), canary);
  writeJson(path.join(e.COMPANY_DIR, 'repos.json'), { repos: [chats, path.join(chats, '-home-x-project')] });
  const b = kho(e, ['build']);
  assert.equal(b.code, 0, b.stderr);
  assert.ok(!db(e).includes(canary), 'canary found in kho.db');
  assert.ok(!dump(e, 'repos').includes('claude-projects'));
});

test('AC-15: a commit that touched .env keeps only hash, author, date and message', () => {
  const e = makeEnv();
  const repo = seed(e);
  write(path.join(repo, '.env'), 'API_KEY=DIFF_CANARY_789\n');
  git(repo, 'add', '-f', '.env'); git(repo, 'commit', '-q', '-m', 'thêm cấu hình');
  const hash = git(repo, 'rev-parse', 'HEAD').trim();
  kho(e, ['build']);
  const rows = kho(e, ['query', `SELECT * FROM commits WHERE hash = '${hash}'`]).out.rows;
  assert.equal(rows.length, 1);
  assert.deepEqual(Object.keys(rows[0]).sort(), ['author', 'date', 'hash', 'message', 'repo']);
  assert.equal(rows[0].author, 'Tester');
  assert.equal(rows[0].message, 'thêm cấu hình');
  assert.ok(!db(e).includes('DIFF_CANARY_789'));
  assert.ok(!db(e).includes('.env'));
});

test('symlinks are refused at every place kho opens, and a secret name anywhere in the path keeps it out', () => {
  const e = makeEnv();
  const repo = seed(e);
  const canary = 'LINK_CANARY_321';
  const outside = path.join(e.root, 'outside');   // (what every link points at)
  write(path.join(outside, 'repo', 'docs', 'x.md'), canary);
  write(path.join(outside, 'repo', 'PROGRESS.md'), `## Bài học\n- ${canary}\n`);
  write(path.join(outside, 'a.md'), `# ${canary}\n${canary}`);
  writeJson(path.join(outside, 'ticket.json'), { id: 'P-20261101-100009-lnk', title: canary, status: 'mới', notes: [], history: [], after: [] });
  writeJson(path.join(outside, 'dept.json'), { name: 'phong-link', title: canary });
  writeJson(path.join(outside, 'third.json'), { skills: [{ name: canary }] });
  writeJson(path.join(outside, 'improve.json'), { lastAt: canary });
  writeJson(path.join(outside, 'meta.json'), { skill: canary, verdict: canary, rounds: 1 });
  const link = (target, at) => { fs.mkdirSync(path.dirname(at), { recursive: true }); fs.rmSync(at, { recursive: true, force: true }); fs.symlinkSync(target, at); };
  // the knowledge folder itself is a link
  const realKho = path.join(outside, 'kho'); write(path.join(realKho, 'k.md'), canary); link(realKho, e.KHO_DIR);
  // a repo in repos.json, and a folder in the project folder, that are links
  write(path.join(e.COMPANY_DIR, 'repos.json'), JSON.stringify({ repos: [path.join(e.root, 'listed-link')] }));
  link(path.join(outside, 'repo'), path.join(e.root, 'listed-link'));
  link(path.join(outside, 'repo'), path.join(e.KHO_PROJECTS_DIR, 'project-link'));
  // inside a real repo: docs/ as a link, PROGRESS.md as a link, meta.json as a link
  const repoB = path.join(e.KHO_PROJECTS_DIR, 'repo-b');
  fs.mkdirSync(repoB, { recursive: true });
  link(path.join(outside, 'repo', 'docs'), path.join(repoB, 'docs'));
  link(path.join(outside, 'repo', 'PROGRESS.md'), path.join(repo, 'PROGRESS.md'));
  link(path.join(outside, 'meta.json'), path.join(repo, '.codex-review', 'sessions', 'codex-impl-review-20261101-002', 'meta.json'));
  // company files as links
  link(path.join(outside, 'ticket.json'), path.join(e.COMPANY_DIR, 'tickets', 'P-20261101-100009-lnk.json'));
  link(path.join(outside, 'dept.json'), path.join(e.SKILLS_DIR, 'phong-link', 'department.json'));
  link(path.join(outside, 'ticket.json'), path.join(e.COMPANY_DIR, 'proposals', 'D-20261101-100009-lnk.json'));
  link(path.join(outside, 'third.json'), path.join(e.COMPANY_DIR, 'third-party.json'));
  link(path.join(outside, 'improve.json'), path.join(e.COMPANY_DIR, 'improve.json'));
  // a repo with a secret name, and an .env in the middle of a file name
  const secretRepo = path.join(e.KHO_PROJECTS_DIR, 'my-secrets-repo');
  write(path.join(secretRepo, 'docs', 'plain.md'), canary);
  write(path.join(repo, 'docs', 'Config.ENV.md'), canary);
  const b = kho(e, ['build']);
  assert.equal(b.code, 0, b.stderr);
  assert.match(b.stderr, /link/i);
  assert.ok(!db(e).includes(canary), 'canary found in kho.db');
  assert.equal(kho(e, ['search', 'zdocsword']).out.results.length, 1);   // (the rest is still built)
  assert.equal(kho(e, ['stats']).out.nhom['phiếu'], 2);
});

test('them --tu-file refuses a link', () => {
  const e = makeEnv();
  write(path.join(e.root, 'real.md'), '# Thật\nabc');
  fs.symlinkSync(path.join(e.root, 'real.md'), path.join(e.root, 'link.md'));
  const r = kho(e, ['them', '--tu-file', path.join(e.root, 'link.md'), '--loai', 'nghien-cuu']);
  assert.notEqual(r.code, 0);
  assert.match(r.stderr, /Không nhập/);
});

test('secret names include .env anywhere as a dotted part', async () => {
  const { secretName } = await import('../scripts/kho.mjs');
  for (const n of ['.env', '.env.local', '.envrc', 'Config.ENV.md', 'prod.env', 'env', 'x.pem', 'a.key.md', 'id_rsa', 'aws-credentials', 'token.txt', 'my-secret.md'])
    assert.ok(secretName(n), n);
  for (const n of ['environment.md', 'monkey.md', 'kenv.md', 'docs', 'a.md', 'keyboard.md']) assert.ok(!secretName(n), n);
});

test('a link in a parent folder is refused too, wherever kho reads or writes', () => {
  const e = makeEnv();
  const repo = seed(e);
  const canary = 'PARENT_CANARY_654', outside = path.join(e.root, 'outside');
  const link = (target, at) => { fs.mkdirSync(path.dirname(at), { recursive: true }); fs.rmSync(at, { recursive: true, force: true }); fs.symlinkSync(target, at); };
  // repo/.codex-review is a link: sessions/…/meta.json under it is a real file
  writeJson(path.join(outside, 'cr', 'sessions', 's-1', 'meta.json'), { skill: canary, verdict: canary, rounds: 9 });
  link(path.join(outside, 'cr'), path.join(repo, '.codex-review'));
  // KHO_DIR/sub is a link
  write(path.join(outside, 'kho-sub', 'deep', 'k.md'), canary);
  write(path.join(e.KHO_DIR, 'ok.md'), '# ok\nzkhookword');
  link(path.join(outside, 'kho-sub'), path.join(e.KHO_DIR, 'sub'));
  // repo/docs/nested is a link to a folder holding a folder
  write(path.join(outside, 'docs-nested', 'more', 'd.md'), canary);
  link(path.join(outside, 'docs-nested'), path.join(repo, 'docs', 'nested'));
  // COMPANY_DIR/tickets is a link
  writeJson(path.join(outside, 'tickets', 'P-20261101-100008-lnk.json'), { id: 'P-20261101-100008-lnk', title: canary, status: 'mới', notes: [], history: [], after: [] });
  fs.rmSync(path.join(e.COMPANY_DIR, 'tickets'), { recursive: true });
  link(path.join(outside, 'tickets'), path.join(e.COMPANY_DIR, 'tickets'));
  const b = kho(e, ['build']);
  assert.equal(b.code, 0, b.stderr);
  assert.ok(!db(e).includes(canary), 'canary found in kho.db');
  assert.equal(kho(e, ['search', 'zkhookword']).out.results.length, 1);
  assert.equal(kho(e, ['search', 'zdocsword']).out.results.length, 1);
});

test('them refuses --tu-file through a linked folder, and a new KHO_DIR under a linked parent', () => {
  const e = makeEnv();
  write(path.join(e.root, 'real-dir', 'a.md'), '# A\nabc');
  fs.symlinkSync(path.join(e.root, 'real-dir'), path.join(e.root, 'link-dir'));
  const r = kho(e, ['them', '--tu-file', path.join(e.root, 'link-dir', 'a.md'), '--loai', 'nghien-cuu']);
  assert.notEqual(r.code, 0);
  assert.match(r.stderr, /Không nhập/);
  const target = path.join(e.root, 'target');
  fs.mkdirSync(path.join(target, 'mid'), { recursive: true });
  fs.symlinkSync(target, path.join(e.root, 'kho-link'));
  for (const kd of [path.join(e.root, 'kho-link', 'tri-thuc'), path.join(e.root, 'kho-link', 'mid', 'tri-thuc')]) {
    const t = kho({ ...e, KHO_DIR: kd }, ['them', '--loai', 'ke-hoach', '--tieu-de', 'X', '--nguon', 'n', '--noi-dung', 'b']);
    assert.notEqual(t.code, 0, kd);
    assert.match(t.stderr, /link/);
  }
  assert.ok(!fs.existsSync(path.join(target, 'tri-thuc')) && !fs.existsSync(path.join(target, 'mid', 'tri-thuc')));
});

test('build refuses to write kho.db through a link', () => {
  const e = makeEnv();
  fs.mkdirSync(path.join(e.root, 'elsewhere'));
  fs.symlinkSync(path.join(e.root, 'elsewhere'), path.join(e.COMPANY_DIR, 'kho'));
  const b = kho(e, ['build']);
  assert.notEqual(b.code, 0);
  assert.match(b.stderr, /link/);
  assert.deepEqual(fs.readdirSync(path.join(e.root, 'elsewhere')), []);
});

test('a root kho starts from (repo in repos.json, KHO_DIR) is refused when a parent above it is a link', () => {
  const e = makeEnv();
  const real = path.join(e.root, 'real'), alias = path.join(e.root, 'alias');
  write(path.join(real, 'repo', 'docs', 'x.md'), '# X\n\nALIAS_CANARY_789\n');
  write(path.join(real, 'repo', 'PROGRESS.md'), '# P\n\n## Bài học\n- 2026-11-01 · v · ALIAS_CANARY_789\n');
  fs.symlinkSync(real, alias);
  writeJson(path.join(e.COMPANY_DIR, 'repos.json'), { repos: [path.join(alias, 'repo')] });
  const b = kho(e, ['build']);
  assert.equal(b.code, 0, b.stderr);
  const db = fs.readFileSync(path.join(e.COMPANY_DIR, 'kho', 'kho.db'));
  assert.ok(!db.includes('ALIAS_CANARY_789'), 'repo under a linked parent must not be read');
  fs.mkdirSync(path.join(real, 'kho'));
  const t = them({ ...e, KHO_DIR: path.join(alias, 'kho') }, { tieuDe: 'Qua link cha' });
  assert.notEqual(t.code, 0);
  assert.deepEqual(fs.readdirSync(path.join(real, 'kho')), []);
});
