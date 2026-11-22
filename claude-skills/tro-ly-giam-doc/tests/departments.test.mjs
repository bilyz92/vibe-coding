import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as D from '../scripts/departments.mjs';

const REAL = path.resolve(import.meta.dirname, '../../phong-ky-su/department.json');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'cty-'));
const real = () => JSON.parse(fs.readFileSync(REAL, 'utf8'));
const env = () => ({ COMPANY_DIR: tmp(), SKILLS_DIR: tmp() });

test('the real phong-ky-su/department.json is valid and pins its roles and models', () => {
  const d = real();
  assert.deepEqual(D.validateDepartment(d), []);
  assert.equal(d.name, 'phong-ky-su');
  assert.equal(d.status, 'active');
  assert.equal(d.allowedTools, 'all');
  assert.equal(d.budgetUsd, 20);
  assert.deepEqual(Object.fromEntries(d.roles.map((r) => [r.agent, r.model])),
    { ba: 'sonnet', planner: 'opus', coding: 'opus', tester: 'sonnet', 'release-ops': 'sonnet', 'thu-ky': 'haiku', 'truc-production': 'sonnet' });
  assert.deepEqual(Object.fromEntries(d.roles.map((r) => [r.agent, r.kind])),
    { ba: 'lam', planner: 'lead', coding: 'lam', tester: 'kiem', 'release-ops': 'lam', 'thu-ky': 'thu-ky', 'truc-production': 'kiem' });
});

test('validateDepartment names what is wrong', () => {
  const p = (f) => { const d = real(); f(d); return D.validateDepartment(d).join(' | '); };
  assert.match(p((d) => { delete d.handles; }), /handles/);
  assert.match(p((d) => { d.status = 'lạ'; }), /status/);
  assert.match(p((d) => { d.roles[0].model = 'gpt'; }), /model/);
  assert.match(p((d) => { d.roles = d.roles.filter((r) => r.kind !== 'kiem'); }), /kiem/);
  assert.match(p((d) => { d.allowedTools = 'Bash'; }), /allowedTools/);
  assert.match(p((d) => { d.name = '../x'; }), /name/);
});

test('findSimilar: same name, or handles sharing ≥ 60 % of words; null when unrelated', () => {
  const ds = [real()];
  assert.equal(D.findSimilar(ds, { name: 'phong-ky-su', handles: 'khác hẳn' })?.name, 'phong-ky-su');
  assert.equal(D.findSimilar(ds, { name: 'phong-code', handles: 'việc code: sửa lỗi, tính năng, refactor trong repo git' })?.name, 'phong-ky-su');
  assert.equal(D.findSimilar(ds, { name: 'phong-video', handles: 'làm video giới thiệu sản phẩm, dựng, lồng tiếng' }), null);
});

test('toolsAllowed: "all" allows anything, a list names what is extra', () => {
  assert.deepEqual(D.toolsAllowed({ allowedTools: 'all' }, ['Bash', 'Write']), { ok: true, extra: [] });
  assert.deepEqual(D.toolsAllowed({ allowedTools: ['Read', 'Write'] }, ['Read', 'Bash']), { ok: false, extra: ['Bash'] });
});

test('recordOutcome: 3 accepted graduates; 2 rejections in a row flag; an accept resets the run', () => {
  const e = env();
  D.recordOutcome('phong-video', true, { env: e });
  D.recordOutcome('phong-video', true, { env: e });
  assert.equal(D.trialState('phong-video', { env: e }).readyToGraduate, false);
  assert.equal(D.recordOutcome('phong-video', true, { env: e }).readyToGraduate, true);
  const f = env();
  D.recordOutcome('phong-x', true, { env: f });
  D.recordOutcome('phong-x', false, { env: f });
  assert.equal(D.recordOutcome('phong-x', false, { env: f }).flagged, true);
  const s = D.recordOutcome('phong-x', true, { env: f });
  assert.equal(s.rejectedInRow, 0);
  assert.equal(s.flagged, false);
  assert.equal(s.accepted, 2);
});

test('addRepo is idempotent and stores absolute paths', () => {
  const e = env();
  D.addRepo('/tmp/a', { env: e });
  D.addRepo('/tmp/a/', { env: e });
  D.addRepo('relative/b', { env: e });
  const r = D.listRepos({ env: e });
  assert.equal(r.length, 2);
  assert.ok(r.every((x) => path.isAbsolute(x)));
});

test('loadDepartments reads */department.json and skips an invalid one with a warning', () => {
  const e = env();
  fs.mkdirSync(path.join(e.SKILLS_DIR, 'phong-ky-su'));
  fs.copyFileSync(REAL, path.join(e.SKILLS_DIR, 'phong-ky-su', 'department.json'));
  fs.mkdirSync(path.join(e.SKILLS_DIR, 'phong-hong'));
  fs.writeFileSync(path.join(e.SKILLS_DIR, 'phong-hong', 'department.json'), '{"name":"phong-hong"}');
  fs.mkdirSync(path.join(e.SKILLS_DIR, 'khac'));
  const { departments, warnings } = D.loadDepartments({ env: e });
  assert.deepEqual(departments.map((d) => d.name), ['phong-ky-su']);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /phong-hong/);
});

test('review fix: skill must be the department name, agents unique, tool names plain', () => {
  const p = (f) => { const d = real(); f(d); return D.validateDepartment(d).join(' | '); };
  assert.match(p((d) => { d.skill = '../escaped'; }), /skill/);
  assert.match(p((d) => { d.skill = 'khac'; }), /skill/);
  assert.match(p((d) => { d.roles[1].agent = d.roles[0].agent; }), /trùng/);
  assert.match(p((d) => { d.allowedTools = ['Read\nmodel: opus']; }), /allowedTools/);
});

test('review fix: a department.json in a folder of another name is skipped', () => {
  const e = env();
  fs.mkdirSync(path.join(e.SKILLS_DIR, 'thu-muc-khac'));
  fs.copyFileSync(REAL, path.join(e.SKILLS_DIR, 'thu-muc-khac', 'department.json'));
  const { departments, warnings } = D.loadDepartments({ env: e });
  assert.equal(departments.length, 0);
  assert.match(warnings[0], /thu-muc-khac/);
});

test('Auto mode is off by default and can be switched on and off', () => {
  const e = env();
  assert.equal(D.autoMode({ env: e }), false);
  D.setAutoMode(true, { env: e });
  assert.equal(D.autoMode({ env: e }), true);
  D.setAutoMode(false, { env: e });
  assert.equal(D.autoMode({ env: e }), false);
});
