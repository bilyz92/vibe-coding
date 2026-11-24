#!/usr/bin/env node
// Vòng cải tiến: gathers what real work says should change — the same problem raised again and again by a department's
// Lead, results anh sent back, lessons that carry a proposal, tickets that got stuck — into candidates the Trợ lý giám
// đốc turns into fixes (a missing role itself; rule, skill or model changes as one diff for anh to approve). Runs after
// 5 finished tickets or 7 days. Node stdlib only.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listTickets, stale } from './tickets.mjs';
import { listRepos, skillsDir, overlap } from './departments.mjs';
import { companyDir, readJson, writeJson } from './store.mjs';

const DAY = 24 * 3600_000, EVERY_DONE = 5, EVERY_DAYS = 7;
const stateFile = (env) => path.join(companyDir({ env }), 'improve.json');

/** Problems in one department whose words mostly match -> groups of 2 or more. */
function repeated(issues) {
  const groups = [];
  for (const x of issues) {
    const g = groups.find((y) => y.department === x.department && overlap(y.items[0].problem, x.problem) >= 0.6);
    if (g) g.items.push(x); else groups.push({ department: x.department, items: [x] });
  }
  return groups.filter((g) => g.items.length >= 2);
}

/** "- <time> · <task> · <lesson> → đề xuất: <proposal>" lines of a repo's "## Bài học". */
function lessons(repo) {
  let text = '';
  try { text = fs.readFileSync(path.join(repo, 'PROGRESS.md'), 'utf8'); } catch { return []; }
  const part = (text.split('\n## Bài học\n')[1] ?? '').split('\n## ')[0];
  return part.split('\n').filter((l) => l.startsWith('- ') && l.includes(' → đề xuất: ')).map((l) => l.slice(2));
}

/** -> { candidates: [{ kind, department, text, evidence }], markdown } over the last `days` days. */
export function improvementReport({ env = process.env, now = new Date(), days = 30 } = {}) {
  const recent = listTickets({ env }).tickets.filter((t) => now - new Date(t.updatedAt) <= days * DAY);
  const candidates = [];
  const issues = recent.flatMap((t) => (t.issues ?? []).map((i) => ({ ...i, ticket: t.id, department: t.department })));
  for (const g of repeated(issues))
    candidates.push({ kind: 'van-de-lap-lai', department: g.department, text: `Vấn đề lặp lại ${g.items.length} lần: ${g.items[0].problem}`, evidence: [...new Set(g.items.map((i) => i.ticket))] });
  const backs = new Map();
  for (const t of recent) {
    const n = t.history.filter((h) => h.from === 'chờ anh nhận' && h.to === 'đang làm').length;
    if (n) { const b = backs.get(t.department) ?? { n: 0, ids: [] }; b.n += n; b.ids.push(t.id); backs.set(t.department, b); }
  }
  for (const [department, b] of backs) candidates.push({ kind: 'anh-tra-lai', department, text: `Anh trả lại kết quả ${b.n} lần`, evidence: b.ids });
  for (const t of stale({ env, now })) candidates.push({ kind: 'ket', department: t.department, text: `Phiếu kẹt: ${t.title}`, evidence: [t.id] });
  for (const repo of new Set([...listRepos({ env }), skillsDir({ env })]))
    for (const l of lessons(repo)) candidates.push({ kind: 'bai-hoc', department: null, text: l, evidence: [repo] });
  const markdown = ['## Đề xuất cải tiến', '',
    ...(candidates.length ? candidates.map((c) => `- [${c.kind}]${c.department ? ` ${c.department}` : ''}: ${c.text} (${c.evidence.join(', ')})`) : ['- (không có)']), ''].join('\n');
  return { candidates, markdown };
}

/** -> { due, reason }: after EVERY_DONE tickets finished since the last loop, or EVERY_DAYS days after it. */
export function dueForImprovement({ env = process.env, now = new Date() } = {}) {
  const last = readJson(stateFile(env))?.lastAt;
  const done = listTickets({ env, status: 'xong' }).tickets.filter((t) => !last || new Date(t.updatedAt) > new Date(last)).length;
  if (done >= EVERY_DONE) return { due: true, reason: `${done} phiếu xong từ lần cải tiến trước` };
  // (no loop yet: the clock starts at the company's first ticket)
  const since = last ?? listTickets({ env }).tickets.map((t) => t.createdAt).sort()[0];
  if (since && now - new Date(since) >= EVERY_DAYS * DAY) return { due: true, reason: `${EVERY_DAYS} ngày ${last ? 'từ lần cải tiến trước' : 'từ phiếu đầu tiên'}` };
  return { due: false, reason: '' };
}

export const markImproved = ({ env = process.env, now = new Date() } = {}) => writeJson(stateFile(env), { lastAt: now.toISOString() });

// CLI: report | due | done — report prints the markdown; due/done print JSON.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const op = process.argv[2];
  if (op === 'report') process.stdout.write(improvementReport().markdown);
  else if (op === 'due') console.log(JSON.stringify(dueForImprovement()));
  else if (op === 'done') { markImproved(); console.log('{"ok":true}'); }
  else { console.error('Dùng: improve.mjs report | due | done'); process.exit(1); }
}
