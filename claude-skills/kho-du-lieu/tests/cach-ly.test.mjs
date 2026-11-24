// Isolation and the skill's text: only node:* modules (AC-28), the real data untouched by the whole suite (AC-29), the
// SKILL.md files (AC-26, AC-27).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { KHO, makeEnv } from './helpers.mjs';

const ROOT = path.resolve(import.meta.dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/** Every file under dir -> one hash (paths, sizes, contents); 'missing' when there is no dir. */
function hashTree(dir) {
  if (!fs.existsSync(dir)) return 'missing';
  const h = crypto.createHash('sha256');
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const p = path.join(d, e.name);
      h.update(`${path.relative(dir, p)}\0`);
      if (e.isDirectory()) walk(p); else if (e.isFile()) h.update(fs.readFileSync(p));
    }
  };
  walk(dir);
  return h.digest('hex');
}

test('AC-28: kho.mjs imports node:* modules only', () => {
  const src = fs.readFileSync(KHO, 'utf8');
  const specs = [...src.matchAll(/\bfrom\s+['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]|\brequire\(\s*['"]([^'"]+)['"]/g)].map((m) => m[1] ?? m[2] ?? m[3]);
  assert.ok(specs.length > 0);
  assert.deepEqual(specs.filter((s) => !s.startsWith('node:')), []);
  assert.ok(!fs.existsSync(path.join(ROOT, 'kho-du-lieu', 'node_modules')));
  assert.equal(spawnSync(process.execPath, ['--check', KHO]).status, 0);
});

test('AC-29: the whole suite, run with every path in a temp folder, leaves the real company and knowledge folders as they were', () => {
  const home = os.homedir();
  // (~/.claude/company itself is live: other sessions change tickets while this runs. kho writes there only under kho/,
  // so that is hashed whole, and the top level is compared by name: anything kho created would show up.)
  const watched = [path.join(home, '.claude', 'company', 'kho'), path.join(home, 'company', 'tri-thuc')];
  const top = () => (fs.existsSync(path.join(home, '.claude', 'company')) ? fs.readdirSync(path.join(home, '.claude', 'company')).sort() : []);
  const before = [...watched.map(hashTree), top()];
  const { root, ...vars } = makeEnv();
  const others = fs.readdirSync(import.meta.dirname).filter((n) => n.endsWith('.test.mjs') && n !== path.basename(import.meta.filename)).map((n) => path.join(import.meta.dirname, n));
  const r = spawnSync(process.execPath, ['--test', ...others], { env: { ...process.env, ...vars }, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout.slice(-3000));
  assert.deepEqual([...watched.map(hashTree), top()], before);
});

test('AC-27: kho-du-lieu/SKILL.md has name, description, the five commands and every flag', () => {
  const s = read('kho-du-lieu/SKILL.md');
  assert.match(s, /^---\nname: kho-du-lieu\ndescription: [^\n]+\n---\n/);
  for (const c of ['them', 'build', 'search', 'query', 'stats']) assert.ok(s.includes(`kho.mjs ${c}`), c);
  for (const f of ['--loai', '--tieu-de', '--nguon', '--the', '--ngay', '--phieu', '--trang-thai', '--noi-dung', '--tu-file', '--tu-ngay', '--ca-cu'])
    assert.ok(s.includes(f), f);
  for (const v of ['COMPANY_DIR', 'KHO_DIR', 'KHO_PROJECTS_DIR', 'CLAUDE_PROJECTS_DIR', 'experimental']) assert.ok(s.includes(v), v);
  const flags = new Set([...fs.readFileSync(KHO, 'utf8').matchAll(/'([a-z-]+)': \{ type:/g)].map((m) => `--${m[1]}`));
  for (const f of flags) assert.ok(s.includes(f), `SKILL.md misses ${f}`);
});

test('AC-26: the Trợ lý searches the store before research and adds finished work; Marketing points to kho-du-lieu', () => {
  const tl = read('tro-ly-giam-doc/SKILL.md'), mk = read('phong-marketing/SKILL.md');
  assert.ok(tl.includes('kho.mjs search'));
  assert.ok(tl.includes('kho.mjs them'));
  assert.match(tl, /trước khi nghiên cứu/);
  assert.match(tl, /nghiên cứu, kế hoạch, chiến lược, quyết định/);
  assert.ok(mk.includes('kho-du-lieu'));
  assert.ok(mk.includes('kho.mjs search') && mk.includes('kho.mjs them'));
});
