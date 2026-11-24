// kho them: adding one knowledge document (AC-1 … AC-5), and importing an existing file (AC-24, AC-25).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { makeEnv, kho, them, write, mdFiles, sha, today } from './helpers.mjs';

const frontmatter = (text) => text.match(/^---\n([\s\S]*?)\n---\n/)?.[1] ?? '';

test('AC-1: them writes a .md with the full frontmatter, hieu-luc and today by default', () => {
  const e = makeEnv();
  const r = kho(e, ['them', '--loai', 'thi-truong', '--tieu-de', 'Thị trường dropshipping', '--nguon', 'https://a.example,https://b.example',
    '--the', 'ban-hang,dropshipping', '--noi-dung', 'Nội dung chính.\n']);
  assert.equal(r.code, 0, r.stderr);
  const files = mdFiles(e.KHO_DIR);
  assert.deepEqual(files, [`${today()}-thi-truong-dropshipping.md`]);
  assert.equal(r.out.file, path.join(e.KHO_DIR, files[0]));
  const text = fs.readFileSync(r.out.file, 'utf8'), fm = frontmatter(text);
  for (const k of ['loai: thi-truong', 'tieu-de: "Thị trường dropshipping"', `ngay: ${today()}`, 'phieu: ""', 'trang-thai: hieu-luc',
    'nguon:\n  - "https://a.example"\n  - "https://b.example"', 'the:\n  - "ban-hang"\n  - "dropshipping"'])
    assert.ok(fm.includes(k), `${k}\n---\n${fm}`);
  assert.ok(text.endsWith('---\nNội dung chính.\n'));
});

test('AC-1: --nguon may also be repeated; --ngay and --phieu are kept', () => {
  const e = makeEnv();
  const r = kho(e, ['them', '--loai', 'quyet-dinh', '--tieu-de', 'Chọn kênh', '--nguon', 'x', '--nguon', 'y', '--ngay', '2026-10-01', '--phieu', 'P-20261103-025000-wfp', '--noi-dung', 'b']);
  assert.equal(r.code, 0, r.stderr);
  const fm = frontmatter(fs.readFileSync(r.out.file, 'utf8'));
  assert.ok(fm.includes('nguon:\n  - "x"\n  - "y"'), fm);
  assert.ok(fm.includes('ngay: 2026-10-01') && fm.includes('phieu: "P-20261103-025000-wfp"'), fm);
  assert.equal(path.basename(r.out.file), '2026-10-01-chon-kenh.md');
});

for (const [missing, args] of [
  ['loai', ['--tieu-de', 'T', '--nguon', 'n']],
  ['tieu-de', ['--loai', 'ke-hoach', '--nguon', 'n']],
  ['nguon', ['--loai', 'ke-hoach', '--tieu-de', 'T']],
]) {
  test(`AC-2: without --${missing} it refuses in Vietnamese and writes nothing`, () => {
    const e = makeEnv();
    const r = kho(e, ['them', ...args, '--noi-dung', 'x']);
    assert.notEqual(r.code, 0);
    assert.match(r.stderr, new RegExp(`Thiếu .*${missing}`));
    assert.deepEqual(mdFiles(e.KHO_DIR), []);
  });
}

test('AC-3: loai or trang-thai outside the lists is refused', () => {
  const e = makeEnv();
  for (const extra of [{ loai: 'linh-tinh' }, { 'trang-thai': 'het-han' }, { 'trang-thai': 'thay-bang:' }, { 'trang-thai': 'thay-bang:../x.md' }]) {
    const r = them(e, { tieuDe: 'T', ...extra });
    assert.notEqual(r.code, 0, JSON.stringify(extra));
    assert.match(r.stderr, /không hợp lệ/);
  }
  assert.deepEqual(mdFiles(e.KHO_DIR), []);
  for (const t of ['cu', 'thay-bang:2026-11-03-b.md', 'hieu-luc']) assert.equal(them(e, { tieuDe: `T ${t}`, 'trang-thai': t }).code, 0, t);
});

test('AC-4: the same file name again is refused and the old content stays', () => {
  const e = makeEnv();
  const a = them(e, { tieuDe: 'Kế hoạch Q4', noiDung: 'bản đầu' });
  const before = fs.readFileSync(a.out.file, 'utf8');
  const b = them(e, { tieuDe: 'Kế hoạch Q4', noiDung: 'bản sau' });
  assert.notEqual(b.code, 0);
  assert.match(b.stderr, /đã có/);
  assert.equal(fs.readFileSync(a.out.file, 'utf8'), before);
});

test('AC-5: the knowledge folder becomes a git repo and the document is committed', () => {
  const e = makeEnv();
  const r = them(e, { tieuDe: 'Chiến lược', loai: 'chien-luoc' });
  assert.equal(r.code, 0, r.stderr);
  assert.ok(fs.existsSync(path.join(e.KHO_DIR, '.git')));
  const log = spawnSync('git', ['-C', e.KHO_DIR, 'log', '--name-only', '--format=%s'], { encoding: 'utf8' }).stdout;
  assert.match(log, /Chiến lược/);
  assert.ok(log.includes(path.basename(r.out.file)));
  them(e, { tieuDe: 'Chiến lược 2', loai: 'chien-luoc' });
  assert.equal(spawnSync('git', ['-C', e.KHO_DIR, 'rev-list', '--count', 'HEAD'], { encoding: 'utf8' }).stdout.trim(), '2');
});

/** Three source files like the ones anh asked to import, outside the knowledge folder. */
function sources(e) {
  const files = {
    'nghien-cuu-thi-truong-kiem-tien.md': '# Nghiên cứu thị trường: kiếm tiền\n\nPhiếu: `P-1` · nội dung.\n',
    'nghien-cuu-thi-truong-dropshipping.md': 'Phiếu `P-2`\n\n# Nghiên cứu thị trường: dropshipping có hợp anh không?\n\n**Dropshipping:** bán hàng không giữ hàng.\n',
    'SU-THAT-DA-XAC-NHAN.md': '# Sự thật đã xác nhận\n\n- Một sự thật.\n',
  };
  return Object.entries(files).map(([n, t]) => { const f = path.join(e.root, 'nguon', n); write(f, t); return f; });
}

test('AC-24: them --tu-file keeps the body byte for byte, records the full source path, leaves the source alone', () => {
  const e = makeEnv();
  const src = sources(e), before = src.map(sha);
  for (const [i, f] of src.entries()) {
    const r = kho(e, ['them', '--tu-file', f, '--loai', i === 2 ? 'quyet-dinh' : 'nghien-cuu']);
    assert.equal(r.code, 0, r.stderr);
    const text = fs.readFileSync(r.out.file, 'utf8');
    assert.equal(text.slice(text.indexOf('\n---\n') + 5), fs.readFileSync(f, 'utf8'), 'body differs');
    const fm = frontmatter(text);
    assert.ok(fm.includes(`  - ${JSON.stringify(f)}`), fm);
    assert.match(fm, /^tieu-de: ".+"$/m);
  }
  assert.equal(mdFiles(e.KHO_DIR).length, 3);
  assert.deepEqual(src.map(sha), before);
  assert.ok(src.every((f) => fs.existsSync(f)));
  const drop = mdFiles(e.KHO_DIR).find((n) => n.includes('dropshipping'));
  assert.equal(drop, `${today()}-nghien-cuu-thi-truong-dropshipping-co-hop-anh-khong.md`);
});

test('them --tu-file refuses a file with a secret name or inside Claude\'s conversations', () => {
  const e = makeEnv();
  const secret = path.join(e.root, 'nguon', 'api-token.md'), chat = path.join(e.CLAUDE_PROJECTS_DIR, 'x', 'notes.md');
  write(secret, '# Khoá\nabc'); write(chat, '# Chat\nabc');
  for (const f of [secret, chat]) {
    const r = kho(e, ['them', '--tu-file', f, '--loai', 'nghien-cuu']);
    assert.notEqual(r.code, 0, f);
    assert.match(r.stderr, /Không nhập/);
  }
  assert.deepEqual(mdFiles(e.KHO_DIR), []);
});

test('a failed git commit leaves no file behind, and the same them works once git is fixed', () => {
  const e = makeEnv();
  fs.mkdirSync(e.KHO_DIR, { recursive: true });
  spawnSync('git', ['-C', e.KHO_DIR, 'init', '-q']);
  const hook = path.join(e.KHO_DIR, '.git', 'hooks', 'pre-commit');
  write(hook, '#!/bin/sh\nexit 1\n'); fs.chmodSync(hook, 0o755);
  const a = them(e, { tieuDe: 'Quyết định giá' });
  assert.notEqual(a.code, 0);
  assert.match(a.stderr, /commit/);
  assert.deepEqual(mdFiles(e.KHO_DIR), []);
  assert.equal(spawnSync('git', ['-C', e.KHO_DIR, 'diff', '--cached', '--name-only'], { encoding: 'utf8' }).stdout, '');
  fs.rmSync(hook);
  const b = them(e, { tieuDe: 'Quyết định giá' });
  assert.equal(b.code, 0, b.stderr);
  assert.equal(mdFiles(e.KHO_DIR).length, 1);
});

test('a knowledge repo that asks for signed commits still gets the document committed (signing is off for kho)', () => {
  const e = makeEnv();
  fs.mkdirSync(e.KHO_DIR, { recursive: true });
  for (const a of [['init', '-q'], ['config', 'commit.gpgsign', 'true'], ['config', 'gpg.program', 'false']]) spawnSync('git', ['-C', e.KHO_DIR, ...a]);
  const r = them(e, { tieuDe: 'Ký số' });
  assert.equal(r.code, 0, r.stderr);
  assert.equal(spawnSync('git', ['-C', e.KHO_DIR, 'rev-list', '--count', 'HEAD'], { encoding: 'utf8' }).stdout.trim(), '1');
});

test('a document over 2 MiB is refused by them --tu-file', () => {
  const e = makeEnv();
  const big = path.join(e.root, 'big.md');
  write(big, `# Lớn\n${'x'.repeat(2 * 1024 * 1024)}`);
  const r = kho(e, ['them', '--tu-file', big, '--loai', 'nghien-cuu']);
  assert.notEqual(r.code, 0);
  assert.match(r.stderr, /2 MiB/);
  assert.deepEqual(mdFiles(e.KHO_DIR), []);
});

test('AC-25: after import, build then search finds it; importing again adds nothing', () => {
  const e = makeEnv();
  const src = sources(e);
  for (const f of src) assert.equal(kho(e, ['them', '--tu-file', f, '--loai', 'nghien-cuu']).code, 0);
  const again = kho(e, ['them', '--tu-file', src[1], '--loai', 'nghien-cuu']);
  assert.equal(again.code, 0, again.stderr);
  assert.equal(again.out.daCo, true);
  assert.equal(mdFiles(e.KHO_DIR).length, 3);
  assert.equal(kho(e, ['build']).code, 0);
  const s = kho(e, ['search', 'dropshipping']);
  assert.equal(s.code, 0, s.stderr);
  const hit = s.out.results.find((x) => x.nhom === 'tài liệu');
  assert.ok(hit && hit.duongDan.startsWith(e.KHO_DIR) && hit.duongDan.includes('dropshipping'), JSON.stringify(s.out));
});

test('AC-24: the three real documents import into a temp knowledge folder (skipped when they are not on this machine)', (t) => {
  const real = ['/home/bilyz/project/my-office/docs/nghien-cuu-thi-truong-kiem-tien.md', '/home/bilyz/project/my-office/docs/nghien-cuu-thi-truong-dropshipping.md',
    path.join(process.env.HOME ?? '', 'company/marketing/SU-THAT-DA-XAC-NHAN.md')];
  if (!real.every((f) => fs.existsSync(f))) return t.skip('không có file gốc trên máy này');
  const e = makeEnv(), before = real.map(sha);
  for (const f of real) {
    const r = kho(e, ['them', '--tu-file', f, '--loai', 'nghien-cuu']);
    assert.equal(r.code, 0, r.stderr);
    const text = fs.readFileSync(r.out.file, 'utf8');
    assert.equal(text.slice(text.indexOf('\n---\n') + 5), fs.readFileSync(f, 'utf8'));
  }
  assert.deepEqual(real.map(sha), before);
});
