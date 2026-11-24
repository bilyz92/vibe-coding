// node --test ~/.claude/skills/tro-ly-giam-doc/tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile, spawnSync } from 'node:child_process';
import { promisify } from 'node:util';
import { beat, buildKho, dayOf } from '../scripts/nhip.mjs';

const CLI = path.resolve(import.meta.dirname, '../scripts/nhip.mjs');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nhip-'));
const envOf = () => ({ COMPANY_DIR: tmp(), SKILLS_DIR: tmp(), CLAUDE_AGENTS_DIR: tmp() });
const NOW = new Date('2026-11-05T19:23:00Z');
const none = async () => { throw new Error('My Office không chạy'); };
const kho = () => ({ ok: true, text: 'dựng lại xong' });
const lockOf = (env) => path.join(env.COMPANY_DIR, 'ban-tin', 'nhip.json');
const owner = (env, o) => { fs.mkdirSync(path.dirname(lockOf(env)), { recursive: true }); fs.writeFileSync(lockOf(env), JSON.stringify(o)); };
const opts = (env, more = {}) => ({ env, now: NOW, fetchAccounts: none, buildKho: kho, ...more });

test('a beat writes the day\'s digest to a file, with the kho line', async () => {
  const env = envOf(), r = await beat(opts(env));
  assert.equal(r.ok, true);
  assert.equal(r.file, path.join(env.COMPANY_DIR, 'ban-tin', `${dayOf(NOW)}.md`));
  const md = fs.readFileSync(r.file, 'utf8');
  for (const h of ['# Bản tin', '## Chờ anh', '## Có thể kẹt', '## Nợ Codex review', '## Sổ đo', '## Nhịp đêm']) assert.ok(md.includes(h), h);
  assert.match(md, /## Nhịp đêm\n- Kho: dựng lại xong/);
  assert.equal(fs.statSync(r.file).mode & 0o777, 0o600);
  assert.equal(fs.statSync(path.dirname(r.file)).mode & 0o777, 0o700);
});

test('a second beat the same day does nothing, the kho included; --lai runs it again; the next day writes a new file', async () => {
  const env = envOf();
  let builds = 0;
  const count = () => { builds++; return { ok: true, text: `lần ${builds}` }; };
  const first = await beat(opts(env, { buildKho: count }));
  const again = await beat(opts(env, { buildKho: count }));
  assert.equal(again.skipped, 'đã có bản tin hôm nay');
  assert.equal(builds, 1);
  assert.match(fs.readFileSync(first.file, 'utf8'), /lần 1/);
  await beat(opts(env, { buildKho: count, force: true }));
  assert.match(fs.readFileSync(first.file, 'utf8'), /lần 2/);
  const next = await beat(opts(env, { buildKho: count, now: new Date(NOW.getTime() + 24 * 3600_000) }));
  assert.notEqual(next.file, first.file);
  assert.equal(fs.readdirSync(path.dirname(first.file)).filter((n) => n.endsWith('.md')).length, 2);
});

test('the lock: a beat started while another runs stands aside, and the lock is free afterwards', async () => {
  const env = envOf();
  let inner;
  const slow = () => { inner = beat(opts(env, { force: true })); return { ok: true, text: 'x' }; };
  await beat(opts(env, { buildKho: slow }));
  assert.equal((await inner).skipped, 'đang chạy');
  assert.equal((await beat(opts(env, { force: true }))).skipped, undefined);
});

test('the lock: a live owner holds it; a dead owner or a very old one does not', async () => {
  const env = envOf(), at = NOW.getTime() - 60_000;
  owner(env, { pid: process.pid, at });
  assert.equal((await beat(opts(env))).skipped, 'đang chạy');
  owner(env, { pid: 2 ** 22 + 1, at });   // (above Linux's pid limit: no such process)
  assert.equal((await beat(opts(env))).skipped, undefined);
  owner(env, { pid: process.pid, at: NOW.getTime() - 4 * 3600_000 });
  assert.equal((await beat(opts(env, { force: true }))).skipped, undefined);
});

test('a kho that fails is written in the digest, the beat says not ok, and the digest is still there', async () => {
  const env = envOf(), r = await beat(opts(env, { buildKho: () => ({ ok: false, text: 'LỖI: hết đĩa' }) }));
  assert.equal(r.ok, false);
  assert.match(fs.readFileSync(r.file, 'utf8'), /## Nhịp đêm\n- Kho: LỖI: hết đĩa/);
});

test('a day whose kho failed is tried again without --lai, and is done once it works', async () => {
  const env = envOf();
  await beat(opts(env, { buildKho: () => ({ ok: false, text: 'LỖI: hết đĩa' }) }));
  const r = await beat(opts(env));
  assert.equal(r.skipped, undefined);
  assert.doesNotMatch(fs.readFileSync(r.file, 'utf8'), /LỖI/);
  assert.equal((await beat(opts(env))).skipped, 'đã có bản tin hôm nay');
});

test('a digest that throws leaves no file and frees the lock, so the next beat tries again', async () => {
  const env = envOf();
  await assert.rejects(beat(opts(env, { makeDigest: async () => { throw new Error('hỏng'); } })), /hỏng/);
  assert.deepEqual(fs.readdirSync(path.join(env.COMPANY_DIR, 'ban-tin')).filter((n) => n.endsWith('.md')), []);
  assert.equal((await beat(opts(env))).ok, true);
});

test('buildKho really builds into the company folder, and names the failure of a build that cannot run', () => {
  const env = { ...process.env, COMPANY_DIR: tmp(), KHO_DIR: tmp(), KHO_PROJECTS_DIR: tmp(), SKILLS_DIR: tmp(), CLAUDE_PROJECTS_DIR: tmp() };
  const good = buildKho({ env });
  assert.equal(good.ok, true, good.text);
  assert.match(good.text, /dựng lại xong/);
  assert.ok(fs.existsSync(path.join(env.COMPANY_DIR, 'kho', 'kho.db')));
  const bad = buildKho({ env: { ...env, COMPANY_DIR: path.join(env.COMPANY_DIR, 'kho', 'kho.db') } });
  assert.equal(bad.ok, false);
  assert.match(bad.text, /LỖI/);
  assert.match(bad.text, /chưa có bản cũ/);
});

test('a kho build stopped by the time limit leaves no half-built file', () => {
  const env = { ...process.env, COMPANY_DIR: tmp() };
  fs.mkdirSync(path.join(env.COMPANY_DIR, 'kho'));
  const spawn = () => {
    fs.writeFileSync(path.join(env.COMPANY_DIR, 'kho', 'kho.db.tmp-77'), 'nửa chừng');
    return { pid: 77, status: null, error: Object.assign(new Error('spawnSync node ETIMEDOUT'), { code: 'ETIMEDOUT' }), stdout: '', stderr: '' };
  };
  assert.match(buildKho({ env, spawn }).text, /ETIMEDOUT/);
  assert.deepEqual(fs.readdirSync(path.join(env.COMPANY_DIR, 'kho')), []);
});

test('the round calls no model and reaches nothing but My Office on this machine', () => {
  const src = ['nhip.mjs', 'digest.mjs'].map((f) => fs.readFileSync(path.resolve(import.meta.dirname, '../scripts', f), 'utf8')).join('\n');
  assert.doesNotMatch(src, /anthropic|telegram|openai|node:https|child_process.*claude/i);
  assert.doesNotMatch(src, /'claude'|"claude"|'codex'|"codex"/);
  assert.deepEqual([...src.matchAll(/https?:\/\/[^\s'"`]+/g)].map((m) => m[0]), ['http://127.0.0.1:4310/api/live']);
});

test('CLI: prints JSON, and a second run the same day stands aside', async () => {
  const dir = tmp(), bin = tmp();
  const env = { ...process.env, COMPANY_DIR: dir, KHO_DIR: tmp(), KHO_PROJECTS_DIR: tmp(), SKILLS_DIR: bin, CLAUDE_PROJECTS_DIR: tmp(), CLAUDE_AGENTS_DIR: tmp() };
  const run = () => promisify(execFile)('node', [CLI], { env });
  const a = JSON.parse((await run()).stdout);
  assert.equal(a.ok, true);
  assert.ok(fs.existsSync(a.file));
  assert.equal(JSON.parse((await run()).stdout).skipped, 'đã có bản tin hôm nay');
  assert.equal(spawnSync('node', [CLI, '--la'], { env }).status, 1);
});
