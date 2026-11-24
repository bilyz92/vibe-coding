#!/usr/bin/env node
// Claude Code PreToolUse hook (Bash): a `git commit` Claude runs must carry changes /codex-impl-review approved
// (gate.mjs). Silent for anything else; a commit it can't follow or can't check is blocked, with what to do instead.
import { decideCommit, commitRequest } from './gate.mjs';

let raw = '';
for await (const c of process.stdin) raw += c;
const deny = (reason) => process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } }));
let p = null; try { p = JSON.parse(raw || '{}'); } catch { /* not a hook call: nothing to judge */ }
const { dir, onlyPaths } = p?.tool_name === 'Bash' ? commitRequest(p.tool_input?.command, p.cwd || process.cwd()) : { dir: null };
if (dir === '?') deny('Không xác định được lệnh này commit ở repo nào (biến trong đường dẫn, eval, sh -c…): chạy `git commit` thành lệnh riêng, với `cd <đường dẫn thật>` hoặc `git -C <đường dẫn thật>`.');
else if (dir) {
  try {
    const d = decideCommit(dir, { onlyPaths });
    if (d.decision === 'deny') deny(d.reason);
    else if (d.warning) process.stdout.write(JSON.stringify({ systemMessage: d.warning, hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: d.warning } }));
  } catch (e) { deny(`Không kiểm được thay đổi trước khi commit (${String(e.message || e).slice(0, 160)}): commit bị chặn cho an toàn.`); }   // (a commit it can't check: blocked, not waved through)
}
