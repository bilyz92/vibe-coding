// kho query and kho stats (AC-21 … AC-23).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { makeEnv, kho, them, seed, sha } from './helpers.mjs';

test('AC-21: query reads; anything that writes, or more than one statement, is refused and kho.db is unchanged', () => {
  const e = makeEnv();
  seed(e);
  kho(e, ['build']);
  const file = path.join(e.COMPANY_DIR, 'kho', 'kho.db'), before = sha(file);
  const ok = kho(e, ['query', 'SELECT count(*) AS n FROM tickets']);
  assert.equal(ok.code, 0, ok.stderr);
  assert.deepEqual(ok.out.rows, [{ n: 2 }]);
  assert.equal(kho(e, ['query', 'select title from tickets where title like \'%update;%\' or 1;']).code, 0);   // (words and ; inside a string, one trailing ;)
  assert.equal(kho(e, ['query', 'WITH t AS (SELECT 1 AS x) SELECT x FROM t']).code, 0);
  for (const q of ["INSERT INTO tickets(id) VALUES ('x')", "UPDATE tickets SET title = 'x'", 'DELETE FROM tickets', 'DROP TABLE tickets',
    `ATTACH DATABASE '${path.join(e.root, 'x.db')}' AS x`, 'PRAGMA user_version = 5', 'PRAGMA journal_mode = WAL', 'SELECT 1; DELETE FROM tickets',
    'SELECT 1;; ', 'WITH t AS (SELECT 1) DELETE FROM tickets', 'VACUUM', "SELECT 1 /* ; */; DROP TABLE x", 'CREATE TABLE z(a)', 'REPLACE INTO tickets(id) VALUES (1)', '']) {
    const r = kho(e, ['query', q]);
    assert.notEqual(r.code, 0, q);
    assert.ok(!/\n\s+at /.test(r.stderr), `stack trace for ${q}`);
  }
  assert.equal(sha(file), before);
  assert.ok(!fs.existsSync(path.join(e.root, 'x.db')));
  assert.equal(kho(e, ['query', 'SELECT count(*) AS n FROM tickets']).out.rows[0].n, 2);
});

test('AC-22: before any build, search, query and stats say to run kho build first', () => {
  const e = makeEnv();
  for (const args of [['search', 'x'], ['query', 'SELECT 1'], ['stats']]) {
    const r = kho(e, args);
    assert.notEqual(r.code, 0, args[0]);
    assert.match(r.stderr, /chạy `kho build` trước/);
    assert.ok(!/\n\s+at /.test(r.stderr), r.stderr);
  }
  assert.ok(!fs.existsSync(path.join(e.COMPANY_DIR, 'kho', 'kho.db')));
});

test('AC-23: stats counts each group, and the documents by loai and by trang-thai', () => {
  const e = makeEnv();
  them(e, { tieuDe: 'A', loai: 'thi-truong' });
  them(e, { tieuDe: 'B', loai: 'thi-truong', 'trang-thai': 'cu' });
  them(e, { tieuDe: 'C', loai: 'ke-hoach', 'trang-thai': 'thay-bang:x.md' });
  kho(e, ['build']);
  const s = kho(e, ['stats']);
  assert.equal(s.code, 0, s.stderr);
  assert.equal(s.out.nhom['tài liệu'], 3);
  assert.equal(s.out.nhom['phiếu'], 0);
  assert.deepEqual(s.out.theoLoai, { 'ke-hoach': 1, 'thi-truong': 2 });
  assert.deepEqual(s.out.theoTrangThai, { cu: 1, 'hieu-luc': 1, 'thay-bang:x.md': 1 });
});

test('an unknown command prints the usage and exits 1', () => {
  const r = kho(makeEnv(), ['xoa']);
  assert.equal(r.code, 1);
  assert.match(r.stderr, /Dùng: kho\.mjs/);
});
