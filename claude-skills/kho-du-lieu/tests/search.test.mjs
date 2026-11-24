// kho search (AC-16 … AC-20).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { makeEnv, kho, them, ticket, write, git } from './helpers.mjs';

const titles = (r) => r.out.results.map((x) => x.tieuDe).sort();

test('AC-16: a hit gives title, path and an excerpt; no hit says so and exits 0', () => {
  const e = makeEnv();
  them(e, { tieuDe: 'Bán hàng không giữ kho', noiDung: `${'Mở đầu dài. '.repeat(30)}Mô hình dropshipping hợp người mới. ${'Phần cuối. '.repeat(30)}` });
  kho(e, ['build']);
  const r = kho(e, ['search', 'dropshipping']);
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.out.results.length, 1);
  const [x] = r.out.results;
  assert.equal(x.tieuDe, 'Bán hàng không giữ kho');
  assert.match(x.duongDan, /ban-hang-khong-giu-kho\.md$/);
  assert.ok(x.trich.includes('dropshipping') && x.trich.length < 300, x.trich);
  const none = kho(e, ['search', 'khongcotu']);
  assert.equal(none.code, 0);
  assert.deepEqual(none.out.results, []);
  assert.equal(none.out.message, 'không có kết quả');
});

test('AC-17: --loai, --the and --tu-ngay filter, and together they all apply', () => {
  const e = makeEnv();
  them(e, { tieuDe: 'A', loai: 'thi-truong', the: 'x,y', ngay: '2026-10-01', noiDung: 'chung' });
  them(e, { tieuDe: 'B', loai: 'thi-truong', the: 'y', ngay: '2026-11-01', noiDung: 'chung' });
  them(e, { tieuDe: 'C', loai: 'ke-hoach', the: 'x', ngay: '2026-11-02', noiDung: 'chung' });
  kho(e, ['build']);
  assert.deepEqual(titles(kho(e, ['search', 'chung'])), ['A', 'B', 'C']);
  assert.deepEqual(titles(kho(e, ['search', 'chung', '--loai', 'thi-truong'])), ['A', 'B']);
  assert.deepEqual(titles(kho(e, ['search', 'chung', '--the', 'x'])), ['A', 'C']);
  assert.deepEqual(titles(kho(e, ['search', 'chung', '--tu-ngay', '2026-11-01'])), ['B', 'C']);
  assert.deepEqual(titles(kho(e, ['search', 'chung', '--loai', 'thi-truong', '--the', 'y', '--tu-ngay', '2026-10-15'])), ['B']);
  assert.deepEqual(titles(kho(e, ['search', 'chung', '--loai', 'ke-hoach', '--the', 'y'])), []);
  assert.notEqual(kho(e, ['search', 'chung', '--tu-ngay', 'hôm qua']).code, 0);
});

test('AC-18: a replaced document is hidden unless --ca-cu, and then it says what replaced it', () => {
  const e = makeEnv();
  const b = them(e, { tieuDe: 'Kế hoạch mới', noiDung: 'kehoach' });
  const bName = b.out.file.split('/').pop();
  them(e, { tieuDe: 'Kế hoạch cũ', noiDung: 'kehoach', 'trang-thai': `thay-bang:${bName}` });
  kho(e, ['build']);
  assert.deepEqual(titles(kho(e, ['search', 'kehoach'])), ['Kế hoạch mới']);
  const all = kho(e, ['search', 'kehoach', '--ca-cu']).out.results;
  assert.equal(all.length, 2);
  assert.equal(all.find((x) => x.tieuDe === 'Kế hoạch cũ').nhan, `thay bằng ${bName}`);
  assert.equal(all.find((x) => x.tieuDe === 'Kế hoạch mới').nhan, undefined);
});

test('AC-19: FTS5 syntax in the query is plain text, never an error', () => {
  const e = makeEnv();
  them(e, { tieuDe: 'Ghi chú', noiDung: 'giá AND chi phí (dự kiến) - "ước tính" * NEAR' });
  kho(e, ['build']);
  for (const q of ['"', '*', '-', 'AND', '(', 'chi" OR "x', 'NEAR(', 'phí -giá', 'title:x', '^', '""', ')(*-"']) {
    const r = kho(e, ['search', q]);
    assert.equal(r.code, 0, `${q}: ${r.stderr}`);
    assert.ok(Array.isArray(r.out.results), q);
  }
  assert.equal(kho(e, ['search', '(dự kiến)']).out.results.length, 1);
});

test('AC-20: with or without Vietnamese marks, the same results', () => {
  const e = makeEnv();
  them(e, { tieuDe: 'Thị trường Đà Nẵng', noiDung: 'Nghiên cứu thị trường đồ gốm.' });
  them(e, { tieuDe: 'Khác', noiDung: 'không liên quan' });
  kho(e, ['build']);
  const a = kho(e, ['search', 'thị trường']).out.results, b = kho(e, ['search', 'thi truong']).out.results;
  assert.equal(a.length, 1);
  assert.deepEqual(a, b);
  assert.deepEqual(kho(e, ['search', 'da nang']).out.results.map((x) => x.tieuDe), ['Thị trường Đà Nẵng']);
  assert.deepEqual(kho(e, ['search', 'ĐỒ GỐM']).out.results.map((x) => x.tieuDe), ['Thị trường Đà Nẵng']);
});

test('results come grouped: knowledge, docs, lessons, other groups, commits last', () => {
  const e = makeEnv();
  them(e, { tieuDe: 'Ghi chép', noiDung: `${'Phần mở đầu dài về việc khác. '.repeat(40)}zrankword xuất hiện một lần.` });
  ticket(e, 'P-20261101-100000-rnk', { title: 'zrankword' });
  const repo = path.join(e.KHO_PROJECTS_DIR, 'repo-r');
  write(path.join(repo, 'PROGRESS.md'), `## Bài học\n- ${'bài học dài '.repeat(30)} zrankword\n`);
  write(path.join(repo, 'docs', 'd.md'), `# Docs\n\n${'đoạn văn dài '.repeat(60)} zrankword\n`);
  git(repo, 'init', '-q');
  for (let i = 0; i < 25; i++) git(repo, 'commit', '-q', '--allow-empty', '-m', `zrankword ${i}`);
  kho(e, ['build']);
  const r = kho(e, ['search', 'zrankword']);
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.out.results.length, 20);
  assert.deepEqual(r.out.results.slice(0, 5).map((x) => x.nhom), ['tài liệu', 'docs', 'bài học', 'phiếu', 'commit']);
  assert.ok(r.out.results.slice(4).every((x) => x.nhom === 'commit'));
});
