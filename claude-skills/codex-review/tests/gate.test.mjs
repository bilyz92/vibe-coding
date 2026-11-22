// node --test ~/.claude/skills/codex-review/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { changeHash, stampApproval, decideCommit, commitTarget, commitRequest } from '../scripts/gate.mjs';
import { addPending, markDone, listPending } from '../scripts/quota.mjs';

const GATE = path.resolve(import.meta.dirname, '../scripts/commit-gate.mjs');
const git = (dir, ...a) => execFileSync('git', a, { cwd: dir, encoding: 'utf8' });
function repo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-gate-'));
  git(dir, 'init', '-q'); git(dir, 'symbolic-ref', 'HEAD', 'refs/heads/feat/x'); git(dir, 'config', 'user.email', 't@t'); git(dir, 'config', 'user.name', 't');
  fs.writeFileSync(path.join(dir, 'app.js'), 'export const a = 1;\n'); fs.writeFileSync(path.join(dir, 'README.md'), '# r\n');
  git(dir, 'add', '-A'); git(dir, 'commit', '-qm', 'init');
  return dir;
}

test('the hash follows the code, not PROGRESS.md or the review logs', () => {
  const dir = repo();
  fs.writeFileSync(path.join(dir, 'app.js'), 'export const a = 2;\n');
  fs.writeFileSync(path.join(dir, 'new.js'), 'x\n');   // (untracked files count)
  const h = changeHash(dir);
  fs.writeFileSync(path.join(dir, 'PROGRESS.md'), '# p\n'); fs.mkdirSync(path.join(dir, '.codex-review'), { recursive: true }); fs.writeFileSync(path.join(dir, '.codex-review', 'x.log'), 'l');
  assert.equal(changeHash(dir), h);
  fs.writeFileSync(path.join(dir, 'new.js'), 'y\n');
  assert.notEqual(changeHash(dir), h);
});

test('a commit of approved changes passes, one changed since is blocked', () => {
  const dir = repo();
  fs.writeFileSync(path.join(dir, 'app.js'), 'export const a = 2;\n');
  assert.equal(decideCommit(dir).decision, 'deny');
  stampApproval(dir);
  assert.equal(decideCommit(dir).decision, 'allow');
  fs.writeFileSync(path.join(dir, 'app.js'), 'export const a = 3;\n');
  const d = decideCommit(dir);
  assert.equal(d.decision, 'deny');
  assert.match(d.reason, /codex-impl-review/);
});

test('docs-only changes and nothing to commit pass', () => {
  const dir = repo();
  assert.equal(decideCommit(dir).decision, 'allow');   // (nothing changed)
  fs.writeFileSync(path.join(dir, 'README.md'), '# r2\n'); fs.writeFileSync(path.join(dir, 'notes.txt'), 'n\n');
  assert.equal(decideCommit(dir).decision, 'allow');
});

test('with Codex out of quota, a review owed for this branch lets the commit through with a warning', () => {
  const dir = repo();
  fs.writeFileSync(path.join(dir, 'app.js'), 'export const a = 2;\n');
  addPending(dir, { skill: 'codex-impl-review', scope: 'working-tree', branch: 'other/branch', reason: 'out of credits' });
  assert.equal(decideCommit(dir).decision, 'deny');   // (owed for another branch: not this one)
  const id = addPending(dir, { skill: 'codex-impl-review', scope: 'working-tree', branch: 'feat/x', reason: 'out of credits' });
  const d = decideCommit(dir);
  assert.equal(d.decision, 'allow');
  assert.match(d.warning, /Codex/);
  markDone(dir, id);
  assert.equal(listPending(dir).filter((x) => !x.done && x.branch === 'feat/x').length, 0);
  assert.equal(decideCommit(dir).decision, 'deny');   // (paid: back to needing an approval)
});

test('finds which repo a commit command is for', () => {
  assert.equal(commitTarget('git commit -m "x"', '/a'), '/a');
  assert.equal(commitTarget('cd /b && git commit -am "x"', '/a'), '/b');
  assert.equal(commitTarget('git -C /c commit -m x', '/a'), '/c');
  assert.equal(commitTarget('git status && git log', '/a'), null);
  assert.equal(commitTarget('echo "git commit"', '/a'), null);
  assert.equal(commitTarget('git commit-tree abc', '/a'), null);
});

test('the hook speaks Claude Code PreToolUse: silent for other commands, deny JSON for an unreviewed commit', () => {
  const dir = repo();
  fs.writeFileSync(path.join(dir, 'app.js'), 'export const a = 2;\n');
  const run = (payload) => execFileSync('node', [GATE], { input: JSON.stringify(payload), encoding: 'utf8' });
  assert.equal(run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'ls' }, cwd: dir }), '');
  assert.equal(run({ hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: 'x' }, cwd: dir }), '');
  const out = JSON.parse(run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'git commit -m "x"' }, cwd: dir }));
  assert.equal(out.hookSpecificOutput.permissionDecision, 'deny');
  stampApproval(dir);
  assert.equal(run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'git commit -m "x"' }, cwd: dir }), '');
  assert.equal(run({ nonsense: true }), '');   // (never breaks Claude Code on odd input)
});

test('staged content that differs from what was reviewed is blocked, a subset of reviewed files passes', () => {
  const dir = repo();
  fs.writeFileSync(path.join(dir, 'app.js'), 'export const a = 2;\n'); fs.writeFileSync(path.join(dir, 'b.js'), 'b\n');
  git(dir, 'add', 'app.js');                                   // (staged: version 2)
  fs.writeFileSync(path.join(dir, 'app.js'), 'export const a = 3;\n');   // (reviewed: version 3)
  stampApproval(dir);
  assert.equal(decideCommit(dir).decision, 'deny');            // (the commit would carry version 2, never reviewed)
  git(dir, 'add', 'app.js');
  assert.equal(decideCommit(dir).decision, 'allow');           // (only app.js staged, as reviewed: b.js left out is fine)
});

test('a commit that names its paths takes them from the working tree: what someone else staged stays out of it', () => {
  const dir = repo();
  fs.writeFileSync(path.join(dir, 'other.js'), 'theirs v1\n'); git(dir, 'add', 'other.js');
  fs.writeFileSync(path.join(dir, 'other.js'), 'theirs v2\n');           // (staged by someone else, edited since)
  fs.writeFileSync(path.join(dir, 'app.js'), 'export const a = 2;\n');   // (mine)
  stampApproval(dir);
  assert.equal(decideCommit(dir).decision, 'deny');                      // (a plain commit would carry their staged v1)
  assert.deepEqual(commitRequest('git commit -m "x" -- app.js', dir), { dir, onlyPaths: true });
  assert.deepEqual(commitRequest('git commit -q -F - app.js', dir), { dir, onlyPaths: true });
  assert.deepEqual(commitRequest('git commit -m x', dir), { dir, onlyPaths: false });
  assert.deepEqual(commitRequest('git commit -i -m x app.js', dir), { dir, onlyPaths: false });   // (--include: the index goes too)
  assert.deepEqual(commitRequest('git commit -p app.js', dir), { dir, onlyPaths: false });         // (--patch / --interactive pick from the index too)
  assert.deepEqual(commitRequest('git commit --interactive app.js', dir), { dir, onlyPaths: false });
  assert.deepEqual(commitRequest('git commit -m x $FILES', dir), { dir, onlyPaths: false });       // (a $word: maybe an option, maybe nothing)
  assert.deepEqual(commitRequest('git commit -m x -- $FILES', dir), { dir, onlyPaths: false });
  assert.deepEqual(commitRequest('git commit -m "$MSG" app.js', dir), { dir, onlyPaths: true });   // (a quoted $ in a message is fine)
  assert.deepEqual(commitRequest('git commit -m $MSG app.js', dir), { dir, onlyPaths: false });    // (unquoted and empty: app.js becomes the message)
  assert.deepEqual(commitRequest('git commit -m $A"$B" app.js', dir), { dir, onlyPaths: false });  // (partly quoted: $A may still split)
  assert.deepEqual(commitRequest('git commit -m a -- app.js; git commit -m b', dir), { dir: '?', onlyPaths: false });   // (two commits: blocked)
  assert.equal(decideCommit(dir, { onlyPaths: true }).decision, 'allow');
  const run = (command) => execFileSync('node', [GATE], { input: JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command }, cwd: dir }), encoding: 'utf8' });
  assert.equal(run('git commit -m "x" -- app.js'), '');
  assert.match(run('git commit -m "x"'), /deny/);
});

test('a repo with no commit yet is judged the same way', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-gate-'));
  git(dir, 'init', '-q'); git(dir, 'config', 'user.email', 't@t'); git(dir, 'config', 'user.name', 't');
  fs.writeFileSync(path.join(dir, 'app.js'), 'a\n'); git(dir, 'add', 'app.js');
  fs.writeFileSync(path.join(dir, 'app.js'), 'b\n');
  assert.equal(decideCommit(dir).decision, 'deny');            // (staged a, reviewed b)
  git(dir, 'add', 'app.js');
  assert.equal(decideCommit(dir).decision, 'deny');            // (code never approved)
  stampApproval(dir);
  assert.equal(decideCommit(dir).decision, 'allow');
});

test('staged code with the working tree back as it was is blocked too, alone or beside a docs change', () => {
  const dir = repo();
  fs.writeFileSync(path.join(dir, 'app.js'), 'export const a = 2;\n'); git(dir, 'add', 'app.js');
  fs.writeFileSync(path.join(dir, 'app.js'), 'export const a = 1;\n');   // (working tree = HEAD: "nothing changed")
  assert.equal(decideCommit(dir).decision, 'deny');
  fs.writeFileSync(path.join(dir, 'README.md'), '# r2\n');                // (and "docs only")
  assert.equal(decideCommit(dir).decision, 'deny');
});

test('a commit command it cannot follow is blocked rather than let through', () => {
  assert.equal(commitTarget('env FOO=1 git commit -m x', '/a'), '/a');
  assert.equal(commitTarget('GIT_AUTHOR_NAME=x git commit -m x', '/a'), '/a');
  assert.equal(commitTarget('(cd /b && git commit -m x)', '/a'), '/b');
  assert.equal(commitTarget('eval "git commit -m x"', '/a'), '?');
  assert.equal(commitTarget('cd "$X" && git commit -m x', '/a'), '?');
  assert.equal(commitTarget(`bash -c 'cd /elsewhere && git commit -m x'`, '/a'), '?');   // (its && is inside the quotes)
  assert.equal(commitTarget('if true; then git commit -m x; fi', '/a'), '/a');
  assert.equal(commitTarget('nice -n 5 git commit -m x', '/a'), '/a');
  assert.equal(commitTarget('env -i HOME=/h git -C /c commit -m x', '/a'), '/c');
  assert.equal(commitTarget('! git commit -m x', '/a'), '/a');
  assert.equal(commitTarget('out=$(git commit -m x)', '/a'), '?');
  assert.equal(commitTarget('echo $(cd /x && git commit -m y)', '/a'), '?');   // (separators inside $(…) stay inside)
  assert.equal(commitTarget('echo `git commit -m y`', '/a'), '?');
  assert.equal(commitTarget(`printf 'git commit -m x' | xargs -I{} sh -c '{}'`, '/a'), '?');   // (from the pipe)
  assert.equal(commitTarget('echo commit | xargs git', '/a'), '?');
  assert.equal(commitTarget('C="git commit -m x"; eval "$C"', '/a'), '?');
  assert.equal(commitTarget('ls | xargs rm', '/a'), null);
  assert.equal(commitTarget(`echo 'the commit message'; ls | xargs rm`, '/a'), null);   // (the word in another command: not fed to xargs)
  assert.equal(commitTarget(`printf '%s' "commit" ; X=ls; eval "$X"`, '/a'), null);
  assert.equal(commitTarget('export C="git commit -m x"; eval "$C"', '/a'), '?');   // (set by a builtin)
  assert.equal(commitTarget('eval "$FROM_OUTSIDE"', '/a'), '?');                     // (a value it can't know)
  assert.equal(commitTarget('bash -c "$(cat run.sh)"', '/a'), '?');
  assert.equal(commitTarget('cd ~ && git commit -m x', '/a'), os.homedir());
  // quoted text and here-document bodies are not commands
  assert.equal(commitTarget(`printf '%s' "first eval, then git commit" | node x.js`, '/a'), null);
  assert.equal(commitTarget(`node x.js <<'EOF'\neval git commit\nEOF\nls`, '/a'), null);
  assert.equal(commitTarget(`cd /r && git commit -q -F - <<'EOF'\nsh -c git commit\nEOF`, '/a'), '/r');
  // (the words in some text — a prompt for a reviewer, a message — are not a commit)
  assert.equal(commitTarget(`printf '%s' "a git commit inside eval / sh -c / xargs returns ?" | node runner.js resume x`, '/a'), null);
  const dir = repo(); fs.writeFileSync(path.join(dir, 'app.js'), 'export const a = 9;\n');
  const out = JSON.parse(execFileSync('node', [GATE], { input: JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'eval "git commit -m x"' }, cwd: dir }), encoding: 'utf8' }));
  assert.equal(out.hookSpecificOutput.permissionDecision, 'deny');
});

test('a stamp is for the diff Codex approved: a stamp of a hash that no longer matches lets nothing through', () => {
  const dir = repo();
  fs.writeFileSync(path.join(dir, 'app.js'), 'export const a = 2;\n');
  const h = changeHash(dir);
  fs.writeFileSync(path.join(dir, 'app.js'), 'export const a = 3;\n');
  assert.equal(stampApproval(dir, h), false);                  // (changed since the approval: no stamp)
  assert.equal(decideCommit(dir).decision, 'deny');
  assert.equal(stampApproval(dir, changeHash(dir)), true);
  assert.equal(decideCommit(dir).decision, 'allow');
});
