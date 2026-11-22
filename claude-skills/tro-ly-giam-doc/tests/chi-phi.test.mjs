import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import * as C from '../scripts/chi-phi.mjs';

const FIX = path.resolve(import.meta.dirname, 'fixtures/chi-phi');
const SCRIPT = path.resolve(import.meta.dirname, '../scripts/chi-phi.mjs');
const ROOTS = [path.join(FIX, 'projects'), path.join(FIX, 'tasks')];
const FROM = C.dayStart('2026-11-01'), TO = C.dayEnd('2026-11-07');

const role = (agent, kind) => ({ agent, title: `Vai ${agent}`, kind, model: 'sonnet' });
const dept = (name, budgetUsd, roles, extra = {}) => ({ name, title: `Phòng ${name}`, handles: 'x', skill: name, status: 'active',
  allowedTools: 'all', budgetUsd, external: 'không', roles, ...extra });
function env() {
  const skills = fs.mkdtempSync(path.join(os.tmpdir(), 'chi-phi-'));
  const put = (d) => { fs.mkdirSync(path.join(skills, d.name)); fs.writeFileSync(path.join(skills, d.name, 'department.json'), JSON.stringify(d)); };
  put(dept('phong-ky-su', 5, [role('planner', 'lead'), role('coding', 'lam'), role('tester', 'kiem'), role('thu-ky', 'thu-ky')]));
  put(dept('phong-video', 3, [role('video-lead', 'lead'), role('video-dung', 'lam'), role('video-kiem-duyet', 'kiem'), role('video-thu-ky', 'thu-ky')],
    { tokenTuan: 7000000 }));
  const config = path.join(skills, 'chi-phi.json');
  fs.writeFileSync(config, JSON.stringify({ tokenTuan: { 'phong-ky-su': 5000000, 'phong-video': 1 } }));
  return { SKILLS_DIR: skills, CHI_PHI_CONFIG: config, CHI_PHI_ROOTS: ROOTS.join(path.delimiter), COMPANY_DIR: skills };
}

test('price: per-family API prices, cache write 1.25× and cache read 0.1× of input; unknown models have no price', () => {
  const u = { in: 1e6, out: 1e6, cacheWrite: 1e6, cacheRead: 1e6 };
  assert.equal(C.price('claude-opus-5-5', u), 4 + 20 + 5 + 0.4);
  assert.equal(C.price('claude-sonnet-5-5', u), 2 + 10 + 2.5 + 0.2);
  assert.ok(Math.abs(C.price('claude-haiku-5-5', u) - (0.1 + 0.5 + 0.125 + 0.01)) < 1e-12);
  assert.equal(C.price('gpt-x', u), null);
});

test('collect: one record per message id across overlapping files; skips other windows, synthetic and broken lines', async () => {
  const recs = await C.collect({ roots: ROOTS, from: FROM, to: TO });
  assert.deepEqual(recs.map((r) => r.id).sort(), ['c1', 'e1', 'm1', 't1', 'w1']);
  const by = Object.fromEntries(recs.map((r) => [r.id, r]));
  assert.equal(by.m1.agent, C.MAIN);
  assert.equal(by.c1.agent, 'coding');
  assert.equal(by.t1.agent, 'thu-ky', 'agent type read from meta.json when the entry has no attributionAgent');
  assert.deepEqual(by.c1.usage, { in: 1000000, out: 100000, cacheWrite: 1000000, cacheRead: 1000000 });
});

test('tuan: departments → roles with turns, tokens and equivalent USD; unmapped agents go to Phòng Kỹ sư or Khác', async () => {
  const r = await C.tuan({ env: env(), from: FROM, to: TO });
  const ky = r.departments.find((d) => d.name === 'phong-ky-su');
  assert.equal(ky.turns, 3);
  assert.equal(ky.tokens, 2100000 + 2000000 + 1000000);
  assert.ok(Math.abs(ky.usd - (5.7 + 0.2 + 0.5)) < 1e-9);
  assert.equal(ky.tokenTuan, 5000000, 'from chi-phi.json');
  assert.deepEqual(ky.roles.map((x) => x.agent).sort(), ['Explore', 'coding', 'thu-ky']);
  assert.equal(ky.roles.find((x) => x.agent === 'coding').title, 'Vai coding');
  assert.equal(r.departments.find((d) => d.name === 'phong-video').tokenTuan, 7000000, 'department.json wins over chi-phi.json');
  assert.equal(ky.tokenUocLuong, true, 'a budget from chi-phi.json is an estimate');
  assert.equal(r.departments.find((d) => d.name === 'phong-video').tokenUocLuong, false);
  assert.ok(Math.abs(r.departments.find((d) => d.name === C.MAIN_DEPT).usd - 0.024) < 1e-9);
  assert.equal(r.departments.find((d) => d.name === 'khac').roles[0].agent, 'web-fetch');
  const md = C.renderTuan(r);
  assert.match(md, /^# Chi phí AI theo phòng ban/m);
  assert.match(md, /không phải hoá đơn/);
  assert.match(md, /Phòng phong-ky-su/);
  assert.match(md, /5\.100\.000/);
  assert.match(md, /5\.000\.000 \[ƯỚC LƯỢNG\]/);
});

test('canhBao: roles and departments over budgetUsd, token budget at 80 % / 100 %, idle departments', async () => {
  const r = await C.canhBao({ env: env(), now: TO });
  assert.deepEqual(r.overBudget.map((x) => `${x.department}/${x.agent ?? '*'}`).sort(), ['phong-ky-su/*', 'phong-ky-su/coding']);
  assert.deepEqual(r.tokenBudget.map((x) => [x.department, x.level]), [['phong-ky-su', 100]]);
  assert.deepEqual(r.idle.map((x) => x.name), ['phong-video']);
  const md = C.renderCanhBao(r);
  assert.match(md, /phong-video/);
  assert.match(md, /102 %/);
  assert.match(md, /5\.000\.000 token \[ƯỚC LƯỢNG\] = 102 %/);
});

test('CLI: tuan prints markdown, --json prints JSON, a bad date fails', () => {
  const run = (...a) => spawnSync(process.execPath, [SCRIPT, ...a], { env: { ...process.env, ...env() }, encoding: 'utf8' });
  const md = run('tuan', '--tu', '2026-11-01', '--den', '2026-11-07');
  assert.equal(md.status, 0, md.stderr);
  assert.match(md.stdout, /# Chi phí AI theo phòng ban/);
  const js = run('tuan', '--tu', '2026-11-01', '--den', '2026-11-07', '--json');
  assert.equal(JSON.parse(js.stdout).departments.find((d) => d.name === 'phong-ky-su').turns, 3);
  const cb = run('canh-bao', '--den', '2026-11-07', '--json');
  assert.equal(cb.status, 0, cb.stderr);
  assert.equal(JSON.parse(cb.stdout).idle[0].name, 'phong-video');
  assert.notEqual(run('tuan', '--tu', '2026-13-40').status, 0);
  assert.notEqual(run('la').status, 0);
});

test('the shipped chi-phi.json is an estimate with a weekly token budget for every department and the main session', () => {
  const cfg = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../chi-phi.json'), 'utf8'));
  assert.match(cfg._ghiChu, /\[ƯỚC LƯỢNG\]/);
  for (const n of [C.MAIN_DEPT, C.OTHER_DEPT, 'phong-ky-su', 'phong-marketing', 'phong-video'])
    assert.ok(cfg.tokenTuan[n] > 0, n);
});

test('a token budget that is not a positive number is ignored', async () => {
  const e = env();
  fs.writeFileSync(e.CHI_PHI_CONFIG, JSON.stringify({ tokenTuan: { 'phong-ky-su': 'nhiều', [C.MAIN_DEPT]: -1 } }));
  const r = await C.tuan({ env: e, from: FROM, to: TO });
  assert.equal(r.departments.find((d) => d.name === 'phong-ky-su').tokenTuan, null);
  assert.equal(r.departments.find((d) => d.name === C.MAIN_DEPT).tokenTuan, null);
});
