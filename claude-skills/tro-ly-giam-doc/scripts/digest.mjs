#!/usr/bin/env node
// Bản tin buổi sáng: what got done in the last 24 h, what is in progress, what waits for the user (tickets, department
// proposals, departments that keep being sent back), what may be stuck, owed Codex reviews and the ledgers over the
// company's repos, and how much room the Claude / Codex accounts have left (from My Office when it runs). Node stdlib only.
import { fileURLToPath } from 'node:url';
import { listTickets, stale, openIssues } from './tickets.mjs';
import { listRepos, skillsDir, trialState, autoMode } from './departments.mjs';
import { listProposals } from './scaffold.mjs';
import { dueForImprovement } from './improve.mjs';
import { listPending } from '../../codex-review/scripts/quota.mjs';
import { readLedger, summarize, verdict } from '../../phong-ky-su/scripts/ledger.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { companyDir } from './store.mjs';

const DAY = 24 * 3600_000;
const hhmm = (ms) => new Date(ms).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
// (one line each: a ticket's text must not be able to open a heading of its own)
const list = (xs) => (xs.length ? xs.map((x) => `- ${String(x).replace(/\s+/g, ' ').trim()}`).join('\n') : '- (không có)');

/** My Office's limits message ({ label, windows, others, codex }) -> one line per account. */
export function accountLines(limits) {
  const line = (kind, a) => {
    const wins = (a.windows || []).filter((w) => Number.isFinite(w?.pct)).map((w) => `${w.label || w.key || ''} ${w.pct}%`.trim());
    const until = a.until && a.until > Date.now() - DAY ? ` · hết lượt tới ${hhmm(a.until)}` : '';
    return `${kind} ${a.label || a.email || a.name || 'chính'}: ${wins.join(', ') || 'chưa có số'}${until}`;
  };
  return [
    ...(limits?.noClaude ? [] : [line('Claude', limits || {})]),
    ...(limits?.others || []).map((a) => line('Claude', a)),
    ...(limits?.codex?.accounts || []).map((a) => line('Codex', a)),
  ];
}

/** The newest limits in My Office's messages -> accountLines' input, or undefined. A `snap` carries them too, and the
    Codex accounts sit apart from the limits, in its `ai`. */
export function limitsFrom(msgs) {
  const newest = [...msgs].reverse(), limits = newest.find((m) => ['snap', 'limits'].includes(m?.k) && m.limits)?.limits;
  const codex = newest.find((m) => m?.ai?.codex)?.ai.codex.list;
  return codex?.length ? { ...(limits ?? { noClaude: true }), codex: { accounts: codex } } : limits;
}

/** Reads the limits from a running My Office (GET /api/live answers with its snapshot first). */
async function fromMyOffice() {
  const res = await fetch('http://127.0.0.1:4310/api/live', { signal: AbortSignal.timeout(10_000) });
  const msgs = (await res.json())?.msgs || [];
  const l = limitsFrom(msgs);
  if (!l) throw new Error('không có số liệu tài khoản');
  return accountLines(l);
}

/** One line for each repo with a ledger (Phòng Kỹ sư's measure of the `nhanh` level), and one naming those without. */
function ledgerLines(repos) {
  const lines = [], empty = [];
  for (const r of repos.filter((x) => fs.existsSync(path.join(x, '.git')))) {   // (reading a ledger makes its folder: only in a real repo)
    const name = path.basename(r);
    try {
      const all = readLedger(r), s = summarize(all), v = verdict(s);
      if (all.length) lines.push(`${name}: ${all.length} việc (day-du ${s['day-du'].count}, nhanh ${s.nhanh.count}), kết luận ${v.verdict}: ${[v.reason, ...v.warnings].join('; ')}`);
      else empty.push(name);
    } catch (e) { lines.push(`${name}: ${e.message}`); }
  }
  return [...lines, ...(empty.length ? [`Chưa có dòng nào: ${empty.join(', ')}`] : [])];
}

/** -> the digest as Markdown. fetchAccounts() -> lines, or throws (then "chưa đo được"). */
export async function digest({ env = process.env, now = new Date(), fetchAccounts = fromMyOffice } = {}) {
  const { tickets, warnings } = listTickets({ env });
  const show = (t) => `${t.title} (${t.id}${t.department ? `, ${t.department}` : ''})`;
  const done = tickets.filter((t) => t.status === 'xong' && now - new Date(t.updatedAt) <= DAY)
    .map((t) => `${show(t)}${t.result ? `: ${t.result.summary}${t.result.links?.length ? ` ${t.result.links.join(' ')}` : ''}` : ''}`);
  const doing = tickets.filter((t) => ['đã giao', 'đang làm', 'chờ đối tác'].includes(t.status)).map((t) => `${show(t)} · ${t.status}`);
  let flagged = [];
  try {
    flagged = fs.readdirSync(path.join(companyDir({ env }), 'departments')).filter((n) => n.endsWith('.json'))
      .map((n) => n.slice(0, -5)).filter((n) => trialState(n, { env }).flagged);
  } catch { /* none */ }
  const waiting = [
    ...tickets.filter((t) => ['chờ anh', 'chờ anh nhận'].includes(t.status)).map((t) => `${show(t)} · ${t.status}${t.notes.at(-1) ? `: ${t.notes.at(-1).text}` : ''}`),
    ...listProposals({ env, status: 'chờ anh' }).map((p) => `Đề xuất lập ${p.spec.title} (${p.id}): trả lời "ok ${p.id}" hoặc góp ý`),
    ...flagged.map((n) => `${n} bị trả lại 2 lần liên tiếp: cần xem lại phòng`),
  ];
  const due = dueForImprovement({ env, now });
  if (due.due) waiting.push(`Đến lúc chạy vòng cải tiến (${due.reason}): gõ "cải tiến"`);
  const repos = [...new Set([...listRepos({ env }), skillsDir({ env })])];
  const owed = repos.flatMap((r) => listPending(r).filter((p) => !p.done).map((p) => `${path.basename(r)}: ${p.skill} · ${p.scope} (${p.id})`));
  let accounts;
  try { accounts = await fetchAccounts(); } catch { accounts = ['chưa đo được (My Office không chạy hoặc chưa có số)']; }
  return [
    `# Bản tin ${now.toLocaleDateString('vi-VN')}`, '', `Chế độ Auto: ${autoMode({ env }) ? 'bật' : 'tắt'}`, '',
    '## Hôm qua xong', list(done), '',
    '## Đang làm', list(doing), '',
    '## Chờ anh', list(waiting), '',
    '## Phòng báo vấn đề', list(openIssues({ env }).map(({ ticket, issue }) => `${show(ticket)} · ${issue.by ?? '?'} cần ${issue.need}: ${issue.problem}`)), '',
    '## Tự quyết (Auto)', list(tickets.filter((t) => now - new Date(t.updatedAt) <= DAY).flatMap((t) => [
      ...(t.analysis?.assumptions ?? []).filter((a) => a.startsWith('Tự quyết (Auto)')).map((a) => `${show(t)}: ${a.replace(/^Tự quyết \(Auto\):\s*/, '')}`),
      ...t.history.filter((h) => h.auto).map(() => `${show(t)}: xong khi phòng còn thử việc, chưa qua anh nhận`),
    ])), '',
    '## Có thể kẹt', list(stale({ env, now }).map((t) => `${show(t)}: chưa cập nhật từ ${hhmm(Date.parse(t.updatedAt))}`)), '',
    '## Nợ Codex review', list(owed), '',
    '## Sổ đo', list(ledgerLines(repos)), '',
    '## Tài khoản', list(accounts),
    ...(warnings.length ? ['', '## Cảnh báo', list(warnings)] : []), '',
  ].join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) digest().then((md) => process.stdout.write(md));
