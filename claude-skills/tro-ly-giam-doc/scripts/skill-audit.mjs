#!/usr/bin/env node
// Reads a downloaded skill folder before anything in it is installed or run, and lists what a person must look at:
// reads of sign-in files, secrets sent out, hidden instructions to the AI, links pointing out of the folder (blocking),
// and every network use (info), also when split by quotes, variables, base64 or a backslash newline, and decoded text
// piped to a shell (blocking). It never runs anything from the folder. Also the registry of outside skills that were
// taken in (<companyDir>/third-party.json). Node stdlib only.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { companyDir, edit, readJson } from './store.mjs';
import { skillsDir } from './departments.mjs';

// (paths and commands, not words: "keychain charms" or "a cookies banner" in a design note is not a read of one)
const SENSITIVE = new RegExp([
  String.raw`\.ssh\b`, 'id_rsa', 'id_ed25519', String.raw`\.aws\b`, String.raw`\.claude(?!\/skills)\b`, String.raw`\.claude\/skills\/\S*\.\.`,
  String.raw`\.codex\b`, String.raw`\.9router`, String.raw`\.?credentials\.json`, String.raw`\/credentials\b`, String.raw`\/Cookies\b`, String.raw`cookies\.sqlite`,
  'Keychains/', String.raw`\.keychain(-db)?\b`, 'security find-(generic|internet)-password', 'Login Data',
  String.raw`\.config\/gh\b`, String.raw`\.git-credentials`, String.raw`\.netrc\b`, String.raw`\.npmrc\b`, String.raw`\.pypirc\b`, String.raw`\.docker\/config\.json`,
  String.raw`\.kube\/config`, String.raw`\/proc\/(self|\d+|\$\$|\*|\$\{?\w+\}?)\/environ`, String.raw`\.gnupg\b`, String.raw`(\/|cat\s+|['"])\.env\b`,
].join('|'), 'i');
const SECRET_ENV = new RegExp([
  String.raw`(process\.env|os\.environ|os\.getenv|\bgetenv)\W{0,3}[\w.'"[(]*?(token|key|secret|password)`,
  String.raw`JSON\.stringify\(\s*process\.env\s*\)|Object\.(entries|keys|values)\(\s*process\.env\s*\)|dict\(\s*os\.environ\s*\)|\bprintenv\b|(^|[;&|]\s*)env\s*(\||>)`,   // (the whole environment)
].join('|'), 'i');
// A copy of the whole environment ({ ...process.env }, Object.assign({}, process.env), os.environ.copy()) is normal when
// it goes to a child process; it blocks only in a file that also uses the network.
const ENV_COPY = /\.\.\.\s*process\.env\b|Object\.assign\([^)]*process\.env|os\.environ\.copy\(\)|dict\(os\.environ\)/;
const SECRET_SHELL = /\$\{?[A-Z0-9_]*(TOKEN|KEY|SECRET|PASSWORD)[A-Z0-9_]*/;   // (shell variables: upper case, so case matters)
const INJECTION = [
  /ignore (all )?(previous|prior) instructions/i,
  /bỏ qua (mọi |tất cả )?(các )?(chỉ dẫn|hướng dẫn)/i,
  /do not (tell|inform) the user/i,
  /without (asking|telling) the user/i,
];
// A file that holds a NUL byte is read as data only when its type is a known media or font one: a script or a text file
// with a NUL in it is still a script (Node runs it), so it is blocked rather than skipped.
const MEDIA = /\.(png|jpe?g|gif|webp|ico|bmp|avif|woff2?|ttf|otf|eot|mp3|wav|ogg|m4a|mp4|webm|mov|pdf)$/i;
const NETWORK = /https?:\/\/[^\s'"`)<>]+|\bfetch\(|\bcurl\b|\bwget\b|\bhttps?\.request\b|\brequests\./;

// Text decoded and then run (base64 / xxd piped, anywhere later on the line (quotes may hide ; or &, so no boundary is trusted), to a command that names a shell
// or an interpreter, also behind command, env, exec or xargs, or eval of a decode): what runs cannot be read here.
const OBFUSCATION = /(base64\s+(-d|-D|--decode)|xxd\s+-r|openssl\s+(base64|enc)\b[^|]*\s-d).*\|.*\b((ba|z|da|k)?sh|python[\d.]*|node|perl|ruby|php|source)\b|\beval\b[^|;#]*\$\([^)]*\b(base64|xxd)\b/;
/** A line with the pieces put back together: \xHH decoded, 'a' + 'b' joined, quotes and shell backslash escapes dropped. */
const unsplit = (s) => s.replace(/\\x([0-9a-f]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
  .replace(/(['"])\s*\+\s*\1/g, '').replace(/\$(?=')/g, '').replace(/['"]/g, '').replace(/\\(?=[\w./~-])/g, '');
/** Applies the shell assignments in a line (NAME=value and NAME+=value, also after ; && || or export/local/readonly) to
    vars, in order, with values unsplit and filled in from vars so far. Only plain values (no command substitution or
    pipe), and not one whose text as written is already a finding, so a later use of it is not reported twice.
    -> true when filling in variables grew past MAX_GROWTH or a value past MAX_GROWTH (a variable that refers to itself,
    X="${X:+$X }…", doubles on each use): it is dropped and the line is reported, rather than the scan running out of memory. */
function assign(l, vars) {
  let tooLong = false;
  for (const m of unsplit(l).matchAll(/(?:^|[;&|]\s*|\b(?:export|local|readonly)\s+)\s*([A-Za-z_]\w*)(\+?=)([^\s;&|]*)/g)) {
    const e = expand(m[3], vars), v = (m[2] === '+=' ? vars.get(m[1]) ?? '' : '') + e.value;
    if (e.over || (v.length > MAX_GROWTH && v.length > m[3].length)) { vars.delete(m[1]); tooLong = true; continue; }
    if (/^[^()`<>]*$/.test(v) && ![SENSITIVE, SECRET_ENV, SECRET_SHELL].some((re) => re.test(m[3]))) vars.set(m[1], v);
    else vars.delete(m[1]);
  }
  return tooLong;
}
const MAX_GROWTH = 65536;   // (most text that filling in variables may add to a line, and longest value kept)
/** s with the variables filled in, three rounds deep -> { value, over }: built piece by piece, it stops (over: true,
    value cut there) once it is MAX_GROWTH longer than s, so no single round can build a string too long to hold. */
function expand(s, vars) {
  const limit = s.length + MAX_GROWTH;
  for (let k = 0; k < 3; k++) {
    let out = '', last = 0;
    for (const m of s.matchAll(/\$\{?([A-Za-z_]\w*)\}?/g)) {
      out += s.slice(last, m.index) + (vars.get(m[1]) ?? m[0]); last = m.index + m[0].length;
      if (out.length > limit) return { value: out.slice(0, limit), over: true };
    }
    s = out + s.slice(last);
    if (s.length > limit) return { value: s.slice(0, limit), over: true };
  }
  return { value: s, over: false };
}
/** Every way the line is checked: as written, put back together, with the variables set so far filled in, and any base64
    word in it that decodes to readable text. -> { t, over } (over: filling in the variables passed MAX_GROWTH). */
function readings(l, vars) {
  const t = [l, unsplit(l)], e = expand(t[1], vars);
  t.push(e.value);
  for (const w of t.join(' ').match(/[A-Za-z0-9+/]{16,}={0,2}/g) ?? []) {
    const d = Buffer.from(w, 'base64').toString('latin1');
    if (d.length >= 8 && /^[\x20-\x7e\t\n\r]+$/.test(d)) t.push(d, unsplit(d));
  }
  return { t, over: e.over };
}

function walk(root, rel = '', out = []) {
  for (const e of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.name === '.git' && e.isDirectory()) continue;
    if (e.isDirectory()) walk(root, r, out); else out.push({ rel: r, link: e.isSymbolicLink(), odd: !e.isFile() && !e.isSymbolicLink() });
  }
  return out;
}

const inside = (root, p) => p === root || p.startsWith(root + path.sep);

/** -> { ok, blocking, info, files }: ok exactly when nothing blocks. Finding = { file, line, kind, text }. A file over
    maxFileBytes is not read: it blocks as 'too-large' (only listed when it is media). */
export function auditSkill(dir, { maxFileBytes = 5 * 1024 * 1024 } = {}) {
  const root = fs.realpathSync(dir), blocking = [], info = [];
  const files = walk(root);
  for (const { rel, link, odd } of files) {
    const abs = path.join(root, rel);
    if (odd) { blocking.push({ file: rel, line: 0, kind: 'not-a-file', text: 'không phải file thường (FIFO, socket, thiết bị)' }); continue; }
    if (link) {
      const target = path.resolve(path.dirname(abs), fs.readlinkSync(abs));
      let real = target; try { real = fs.realpathSync(target); } catch { /* dangling: judge where it points */ }
      if (!inside(root, real)) blocking.push({ file: rel, line: 0, kind: 'symlink-out', text: `→ ${real}` });
      continue;
    }
    const size = fs.statSync(abs).size;
    if (size > maxFileBytes) {
      (MEDIA.test(rel) ? info : blocking).push({ file: rel, line: 0, kind: 'too-large', text: `${size} byte, quá ${maxFileBytes}: không đọc để kiểm` });
      continue;
    }
    const buf = fs.readFileSync(abs);
    if (buf.subarray(0, 8192).includes(0)) {
      (MEDIA.test(rel) ? info : blocking).push({ file: rel, line: 0, kind: 'binary', text: `${buf.length} byte${MEDIA.test(rel) ? '' : ', không phải ảnh/âm thanh/font: không đọc được để kiểm'}` });
      continue;
    }
    const found = [], lines = buf.toString('utf8').split('\n'), vars = new Map();
    for (let i = 0; i < lines.length; i++) {
      const start = i;
      let l = lines[i];
      // a backslash newline joins lines, and so does a line ending in | && || (not a Markdown table row, which starts with |)
      while (i + 1 < lines.length && (/\\\r?$/.test(l) || (/(\||&&)\s*\r?$/.test(l) && !/^\s*\|/.test(l))))
        l = l.replace(/\\\r?$/, '') + lines[++i];
      const at = { file: rel, line: start + 1, text: l.trim().slice(0, 200) };
      if (assign(l, vars)) found.push({ ...at, kind: 'expand-limit' });   // (before the check: D=.s; D+=sh; cat ~/$D on one line)
      const { t, over } = readings(l, vars), any = (re) => t.some((x) => re.test(x));
      if (over && !found.some((f) => f.line === at.line && f.kind === 'expand-limit')) found.push({ ...at, kind: 'expand-limit' });
      if (any(SENSITIVE)) found.push({ ...at, kind: 'sensitive-path' });
      if (any(SECRET_ENV) || any(SECRET_SHELL)) found.push({ ...at, kind: 'secret-env' });
      else if (any(ENV_COPY)) found.push({ ...at, kind: 'env-copy' });
      if (INJECTION.some(any)) found.push({ ...at, kind: 'injection' });
      if (any(OBFUSCATION)) found.push({ ...at, kind: 'obfuscation' });
      if (any(NETWORK)) found.push({ ...at, kind: 'network' });
    }
    const sendsSecrets = found.some((f) => f.kind === 'secret-env' || f.kind === 'env-copy');   // (secrets and the network in one file)
    const net = found.some((f) => f.kind === 'network');
    for (const f of found) {
      const block = f.kind === 'network' ? sendsSecrets : f.kind === 'env-copy' ? net : true;
      (block ? blocking : info).push(f);
    }
  }
  return { ok: blocking.length === 0, blocking, info, files: files.length };
}

const registry = (env) => path.join(companyDir({ env }), 'third-party.json');
/** Remembers an outside skill: where it came from, which audited commit, and how it came in (one entry per name).
 *  mode: 'adapted' (our rewrite of the audited content, the default), 'learned' (a new skill written from its ideas) or
 *  'installed' (the audited folder copied as is; then required: edited = the lines changed, removed = the files left out,
 *  tree = git tree hash of the exact folder both checks passed on, which must equal origin/master:<name> in the skills repo (SKILLS_DIR).
 *  The record never picks the repo or the ref: only the second argument can, and the CLI line in tao-phong.md does not pass one. */
export function recordThirdParty({ name, source, commit, auditedAt, findings, mode = 'adapted', edited, removed, tree }, { env = process.env, ref = 'origin/master' } = {}) {
  if (!['adapted', 'learned', 'installed'].includes(mode)) throw new Error(`mode phải là "adapted", "learned" hoặc "installed": ${JSON.stringify(mode)}`);
  if (mode === 'installed' && !(Array.isArray(edited) && Array.isArray(removed))) throw new Error('mode "installed" phải ghi edited và removed (mảng, rỗng nếu không có)');
  if (mode === 'installed') {
    if (!/^[0-9a-f]{40}$/.test(tree ?? '')) throw new Error('mode "installed" phải ghi tree: hash cây thư mục đã qua hai lớp kiểm');
    const actual = spawnSync('git', ['-C', skillsDir({ env }), 'rev-parse', `${ref}:${name}`], { encoding: 'utf8' }).stdout?.trim();
    if (actual !== tree) throw new Error(`tree của ${name} không khớp ${ref}: đã kiểm ${tree}, thực tế ${actual || 'không có'}`);
  }
  const entry = { name, source, commit, auditedAt, findings, mode, ...(mode === 'installed' ? { edited, removed, tree } : {}) };
  edit(registry(env), (r) => ({ skills: [...(r?.skills ?? []).filter((s) => s.name !== name), entry] }));
}
export const listThirdParty = ({ env = process.env } = {}) => readJson(registry(env))?.skills ?? [];

// CLI: skill-audit.mjs <dir> -> the audit as JSON (exit 0 even when blocked: read "ok").
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2];
  if (!dir || !fs.existsSync(dir)) { console.error('Dùng: skill-audit.mjs <thư mục skill>'); process.exit(1); }
  console.log(JSON.stringify(auditSkill(dir), null, 2));
}
