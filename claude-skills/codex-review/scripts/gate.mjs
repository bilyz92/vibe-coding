// The commit gate: a commit Claude makes must carry changes /codex-impl-review approved. On APPROVE the runner stamps
// a hash of the working tree's changes (stampApproval); commit-gate.mjs (a PreToolUse hook) lets `git commit` through
// when the changes still match a stamp, are docs only, or a review is owed for this branch because Codex is out of quota
// (quota.mjs: PROGRESS.md). Node stdlib + git only.
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { listPending } from './quota.mjs';

const EXCLUDE = [':(exclude)PROGRESS.md', ':(exclude).codex-review'];
const DOCS = /\.(md|mdx|txt|rst|adoc)$/i;
const run = (dir, args) => execFileSync('git', args, { cwd: dir, encoding: 'buffer', maxBuffer: 256 << 20, stdio: ['ignore', 'pipe', 'ignore'] });
const text = (dir, args) => run(dir, args).toString('utf8');

const root = (dir) => text(dir, ['rev-parse', '--show-toplevel']).trim();
const untracked = (dir) => text(dir, ['ls-files', '--others', '--exclude-standard', '-z', '--', '.', ...EXCLUDE]).split('\0').filter(Boolean).sort();
const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';   // (git's empty tree: what a repo with no commit yet is compared to)
const base = (dir) => { try { run(dir, ['rev-parse', '--verify', 'HEAD']); return 'HEAD'; } catch { return EMPTY_TREE; } };

/** What the changes are now: tracked diff vs HEAD + untracked files' contents (PROGRESS.md and .codex-review left out). */
export function changeHash(dir) {
  const r = root(dir), h = crypto.createHash('sha256');
  h.update(run(r, ['diff', base(r), '--binary', '--', '.', ...EXCLUDE]));
  for (const f of untracked(r)) { h.update(`\0${f}\0`); h.update(text(r, ['hash-object', '--', f])); }
  return h.digest('hex');
}

const changedFiles = (r) => [...text(r, ['diff', base(r), '--name-only', '-z', '--', '.', ...EXCLUDE]).split('\0').filter(Boolean), ...untracked(r)];
const stampDir = (r) => path.join(r, '.codex-review', 'approved');

/** Remembers the changes Codex approved (their hash, taken when the APPROVE came: the runner keeps it) as reviewed —
    only while the changes still are those: -> whether it stamped. */
export function stampApproval(dir, approvedHash) {
  const r = root(dir), now = changeHash(r);
  if (approvedHash && approvedHash !== now) return false;
  const d = stampDir(r);
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, now), `${new Date().toISOString()}\n`);
  return true;
}
// files staged in a version other than the one in the working tree (what the review saw): the commit would carry that
const stagedElsewhere = (r) => {
  const staged = new Set(text(r, ['diff', '--cached', '--name-only', '-z', '--', '.', ...EXCLUDE]).split('\0').filter(Boolean));
  return text(r, ['diff', '--name-only', '-z', '--', '.', ...EXCLUDE]).split('\0').filter((f) => f && staged.has(f));
};

/** May Claude commit here now? -> { decision: 'allow' | 'deny', reason?, warning? }
    opts.onlyPaths: a `git commit -- <paths>` (commitPathsOnly): git then takes those paths from the working tree,
    whatever else is staged stays out, so the staged-versus-working-tree check has nothing to guard. */
export function decideCommit(dir, { onlyPaths = false } = {}) {
  let r; try { r = root(dir); } catch { return { decision: 'allow' }; }   // (not a git repo: not ours to judge)
  // (finishing a merge — in a worktree too, where .git is a file: git says where its own folder is)
  let gitDir = path.join(r, '.git'); try { gitDir = path.resolve(r, text(r, ['rev-parse', '--git-dir']).trim()); } catch { /* as is */ }
  if (fs.existsSync(path.join(gitDir, 'MERGE_HEAD'))) return { decision: 'allow' };
  // first: what the commit would carry (the index) must be what the working tree shows — before any shortcut below
  const differs = onlyPaths ? [] : stagedElsewhere(r);
  if (differs.length) return { decision: 'deny', reason: `Bản đã stage của ${differs.slice(0, 3).join(', ')} khác bản trong thư mục làm việc (bản Codex đã xem): \`git add\` lại rồi commit.` };
  const files = changedFiles(r);
  if (!files.length) return { decision: 'allow' };
  if (files.every((f) => DOCS.test(f))) return { decision: 'allow' };
  if (fs.existsSync(path.join(stampDir(r), changeHash(r)))) return { decision: 'allow' };
  let branch = ''; try { branch = text(r, ['branch', '--show-current']).trim(); } catch { /* detached */ }
  const owed = listPending(r).find((x) => !x.done && x.skill === 'codex-impl-review' && x.branch === branch);
  if (owed) return { decision: 'allow', warning: `Commit chưa qua Codex (Codex hết quota) — đã ghi nợ ${owed.id} trong PROGRESS.md. Trước khi merge: review dự phòng bằng reviewer Claude độc lập + CI xanh; Codex review lại phần đã merge khi có quota.` };
  return { decision: 'deny', reason: 'Thay đổi này chưa được /codex-impl-review APPROVE (hoặc đã sửa thêm sau khi APPROVE). Chạy /codex-impl-review rồi commit. Codex hết quota → ghi nợ bằng `node "$RUNNER" pending add …` (protocol.md § Codex out of quota) rồi commit lại.' };
}

/** A shell command -> its simple commands, each a list of words { text, dyn }: split on ; & | and newlines outside
    quotes, quotes and backslashes taken off, here-document bodies skipped (text, not commands). dyn: the word holds
    $ or ` outside single quotes (its value is only known when the shell runs it). */
export function simpleCommands(cmd) {
  const out = [], heredocs = [];
  let words = [], w = null, pipe = 0;   // (pipe: which pipeline a simple command is in — those joined by a single |)
  const word = () => (w ||= { text: '', dyn: false });
  const push = () => { if (w) { words.push(w); w = null; } };
  const end = (next = true) => { push(); if (words.length) { words.pipe = pipe; out.push(words); } words = []; if (next) pipe++; };
  for (let i = 0; i < cmd.length; i++) {
    const ch = cmd[i];
    if (ch === "'") { const j = cmd.indexOf("'", i + 1), e = j < 0 ? cmd.length : j; word().text += cmd.slice(i + 1, e); i = e; continue; }
    if (ch === '"') {
      let j = i + 1;
      for (; j < cmd.length && cmd[j] !== '"'; j++) {
        if (cmd[j] === '\\' && j + 1 < cmd.length) { word().text += cmd[++j]; continue; }
        if (cmd[j] === '$' || cmd[j] === '`') word().dyn = true;
        word().text += cmd[j];
      }
      word(); i = j; continue;
    }
    if (ch === '\\') { word().text += cmd[i + 1] ?? ''; i++; continue; }
    if ((ch === '$' && cmd[i + 1] === '(') || ch === '`') {   // $(…) / `…`: kept whole in the word, separators and all
      let j = i + 1, depth = 0;
      if (ch === '`') { while (j < cmd.length && cmd[j] !== '`') j += cmd[j] === '\\' ? 2 : 1; }
      else for (; j < cmd.length; j++) { if (cmd[j] === '(') depth++; else if (cmd[j] === ')' && --depth === 0) break; }
      const e = Math.min(j, cmd.length - 1);
      word().dyn = true; w.bare = true; w.text += cmd.slice(i, e + 1); i = e; continue;
    }
    if (ch === '<' && cmd[i + 1] === '<' && cmd[i + 2] !== '<') {   // a here-document: its body is skipped at the line's end
      const m = /^<<(-?)\s*(['"]?)([\w.-]+)\2/.exec(cmd.slice(i));
      if (m) { heredocs.push({ tag: m[3], strip: !!m[1] }); push(); i += m[0].length - 1; continue; }
    }
    if (ch === '\n') {
      end();
      for (const h of heredocs.splice(0)) {   // (the lines up to its closing tag)
        let j = i + 1;
        while (j <= cmd.length) {
          const nl = cmd.indexOf('\n', j), line = cmd.slice(j, nl < 0 ? cmd.length : nl);
          j = nl < 0 ? cmd.length + 1 : nl + 1;
          if ((h.strip ? line.replace(/^\t+/, '') : line) === h.tag) break;
        }
        i = j - 1;
      }
      continue;
    }
    if (/\s/.test(ch)) { push(); continue; }
    if (ch === '|' && cmd[i + 1] !== '|') { end(false); continue; }   // (a pipe: the next command reads this one's output)
    if (';&|'.includes(ch)) { end(); if ((ch === '|' || ch === '&') && cmd[i + 1] === ch) i++; continue; }
    if ('(){}'.includes(ch) && !w) { end(); continue; }   // (a subshell or group: its commands count like the others)
    if (ch === '$' || ch === '`') { word().dyn = true; w.bare = true; }   // (bare: expanded outside quotes — may split or vanish)
    word().text += ch;
  }
  end();
  return out;
}

const WRAPPERS = new Set(['env', 'command', 'builtin', 'exec', 'time', 'nice', 'nohup', 'sudo', 'if', 'then', 'else', 'elif', 'do', 'while', 'until', '!']);
const SHELLS = new Set(['sh', 'bash', 'zsh', 'dash', 'ksh']);

/** The repo a shell command commits in (its own `cd` / `git -C` taken into account), null when it doesn't commit, or
    '?' when it may commit but where can't be told (a variable in the path, eval, sh -c, $(…)): the hook then blocks it. */
export function commitTarget(command, cwd) { return commitRequest(command, cwd).dir; }

// options of git commit that take a value as the next word (anything else that isn't an option is a path)
const COMMIT_VALUED = new Set(['-m', '-F', '-C', '-c', '-t', '--message', '--file', '--reuse-message', '--reedit-message', '--template',
  '--author', '--date', '--cleanup', '--trailer', '--fixup', '--squash', '--pathspec-from-file']);
/** Paths named after `git commit` (and no --include): git takes just those from the working tree. */
// (these keep or pick from the index as well: the paths named aren't all the commit carries)
const WITH_INDEX = new Set(['-i', '--include', '-p', '--patch', '--interactive', '--pathspec-from-file']);
function pathsOnly(args) {
  if (args.some((x) => WITH_INDEX.has(x.text) || x.text.startsWith('--pathspec-from-file='))) return false;
  let named = false;
  for (let k = 0; k < args.length; k++) {
    const x = args[k];
    if (x.dyn) return false;   // (a $word could turn out an option, or nothing: no proof of a path)
    if (x.text === '--') return k + 1 < args.length && args.slice(k + 1).every((y) => !y.dyn);
    if (COMMIT_VALUED.has(x.text)) {   // (its value: an unquoted $word may vanish, and a path would become the value)
      if (args[k + 1]?.bare) return false;
      k++; continue;
    }
    if (!x.text.startsWith('-')) named = true;
  }
  return named;
}

/** commitTarget's answer, and whether that commit names its paths -> { dir, onlyPaths }. */
export function commitRequest(command, cwd) {
  const found = (dir, onlyPaths = false) => ({ dir, onlyPaths });
  let dir = cwd, result = null;
  const cmds = simpleCommands(String(command || '')), vars = new Map();
  const home = (t) => t.replace(/^~(?=$|\/)/, os.homedir());   // (cd ~/x: the home folder)
  const COMMIT = /\bcommit\b/;
  // (does any command of this pipeline — what feeds an xargs — mention a commit?)
  const pipeCommits = (p) => cmds.some((c) => c.pipe === p && c.some((x) => COMMIT.test(x.text)));
  for (const all of cmds) {
    // a commit inside $(…) or `…`: run where and when can't be told
    if (all.some((x) => x.dyn && /(?:\$\(|`)[\s\S]*\bgit\b[\s\S]*\bcommit\b/.test(x.text))) return found('?');
    let i = 0;
    for (;;) {   // VAR=value, and the wrappers with their options (env -i X=1, nice -n 5, if, !, …)
      const t = all[i]?.text;
      if (t === undefined) break;
      const a = /^([A-Za-z_]\w*)=([\s\S]*)$/.exec(t);
      if (a) { vars.set(a[1], a[2]); i++; continue; }   // (remembered: an eval "$X" later runs what X holds)
      if (i > 0 && WRAPPERS.has(all[i - 1].text) && /^-/.test(t)) { i++; continue; }
      if (WRAPPERS.has(t)) { i++; if (t === 'nice' && all[i]?.text === '-n') i += 2; continue; }
      break;
    }
    const words = all.slice(i), first = words[0]?.text;
    if (!first) continue;
    if (['export', 'declare', 'typeset', 'readonly', 'local'].includes(first)) {   // (assignments by a builtin count too)
      for (const x of words.slice(1)) { const a = /^([A-Za-z_]\w*)=([\s\S]*)$/.exec(x.text); if (a) vars.set(a[1], a[2]); }
      continue;
    }
    if (first === 'cd') { const to = words[1]; dir = !to ? os.homedir() : to.dyn || dir === '?' ? '?' : path.resolve(dir, home(to.text)); continue; }
    const handsOn = first === 'eval' || first === 'xargs' || (SHELLS.has(first) && words.some((x) => x.text === '-c'));
    // (a command run by another one — from its own words, from a variable, or, for xargs, from what its pipeline feeds
    // it: with a commit there, where it would run can't be told)
    if (handsOn) {
      const own = words.some((x) => /\bgit\b/.test(x.text)) && words.some((x) => COMMIT.test(x.text));
      const fed = first === 'xargs' && pipeCommits(all.pipe);
      // what it runs from a variable or $(…): known only when every variable was set in this command, to no commit
      const dyns = words.filter((x) => x.dyn), refs = dyns.flatMap((x) => [...x.text.matchAll(/\$\{?([A-Za-z_]\w*)/g)].map((m) => m[1]));
      const unresolved = dyns.some((x) => /\$\(|`/.test(x.text)) || refs.some((v) => !vars.has(v));
      const viaVar = dyns.length > 0 && first !== 'xargs' && (unresolved || pipeCommits(all.pipe) || refs.some((v) => COMMIT.test(vars.get(v))));
      if (own || fed || viaVar) return found('?');
    }
    if (first !== 'git') continue;
    let j = 1, at = null;
    while (words[j] && /^-/.test(words[j].text)) {
      const o = words[j].text;
      if (o === '-C') { at = words[j + 1]; j += 2; } else if (o === '-c' || o === '--git-dir' || o === '--work-tree' || o === '--namespace') j += 2; else j += 1;
    }
    if (words[j]?.text !== 'commit') continue;
    // (a second commit in the same command: checked once, before either runs — so not let through on that check)
    if (result) return found('?');
    const only = pathsOnly(words.slice(j + 1)), to = at && !at.dyn ? home(at.text) : null;
    result = !at ? found(dir, dir !== '?' && only)
      : at.dyn ? found('?')
        : path.isAbsolute(to) ? found(to, only) : dir === '?' ? found('?') : found(path.resolve(dir, to), only);
    if (result.dir === '?') return result;
  }
  return result || found(null);
}
