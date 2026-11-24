#!/usr/bin/env node
// Phiếu việc: one JSON file per work item the user hands the Trợ lý giám đốc, in <companyDir>/tickets/. A ticket moves
// through fixed statuses, may wait on others ("after"), and keeps its notes, result and history. Node stdlib only.
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { companyDir, safeId, readJson, writeJson, edit, newId } from './store.mjs';
import { loadDepartments, autoMode, addTicketRepo, allowedRepo } from './departments.mjs';
import { readLedger } from '../../phong-ky-su/scripts/ledger.mjs';
import { hasLesson } from '../../phong-ky-su/scripts/progress.mjs';

/** The Trợ lý giám đốc itself, for work it does without a department (a one-off read, a summary). */
export const SELF = 'tro-ly-giam-doc';
const ENGINEERING = 'phong-ky-su';
const findDepartment = (name, env) => (name === SELF ? { name: SELF, status: 'active' } : loadDepartments({ env }).departments.find((d) => d.name === name));

export const STATUSES = ['mới', 'đã giao', 'đang làm', 'chờ anh', 'chờ đối tác', 'chờ anh nhận', 'xong', 'huỷ'];
const NEXT = {
  'mới': ['đã giao', 'chờ anh', 'huỷ'],
  'đã giao': ['đang làm', 'chờ anh', 'huỷ'],
  'đang làm': ['chờ anh', 'chờ đối tác', 'chờ anh nhận', 'xong', 'huỷ'],
  'chờ anh': ['mới', 'đã giao', 'đang làm', 'huỷ'],
  'chờ đối tác': ['đang làm', 'huỷ'],
  'chờ anh nhận': ['xong', 'đang làm'],
  'xong': [],
  'huỷ': [],
};

const dir = (env) => path.join(companyDir({ env }), 'tickets');
const fileOf = (id, env) => path.join(dir(env), `${safeId(id)}.json`);

/** Changes an existing ticket under its lock; fn mutates it. Stamps updatedAt. */
function change(id, env, now, fn) {
  const f = fileOf(id, env);
  if (!fs.existsSync(f)) throw new Error(`Không có phiếu ${id}`);
  return edit(f, (t) => { if (!t) throw new Error(`Phiếu ${id} hỏng`); fn(t); t.updatedAt = now.toISOString(); return t; });
}

export function createTicket({ title, request, department = null, repo = null, parent = null, after = [] }, { env = process.env, now = new Date() } = {}) {
  if (parent) safeId(parent);
  after.forEach(safeId);
  const at = now.toISOString();
  const t = { id: newId('P', now), title: String(title ?? ''), request: String(request ?? ''), department, repo: repo ? path.resolve(String(repo)) : null, status: 'mới',
    parent, after, createdAt: at, updatedAt: at, analysis: null, issues: [], notes: [], result: null, history: [] };
  writeJson(fileOf(t.id, env), t);
  return t;
}

export const getTicket = (id, { env = process.env } = {}) => readJson(fileOf(id, env));

/** -> { tickets (oldest first), warnings } — a file that isn't a ticket is skipped with a warning naming it. */
export function listTickets({ env = process.env, status } = {}) {
  const tickets = [], warnings = [];
  let names = [];
  try { names = fs.readdirSync(dir(env)).filter((n) => n.endsWith('.json')); } catch { /* none yet */ }
  for (const n of names.sort()) {
    const t = readJson(path.join(dir(env), n));
    const whole = t && typeof t.id === 'string' && typeof t.title === 'string' && STATUSES.includes(t.status)
      && ['notes', 'history', 'after'].every((k) => Array.isArray(t[k]));
    if (!whole) { warnings.push(`Bỏ qua phiếu hỏng: ${n}`); continue; }
    if (!status || t.status === status) tickets.push(t);
  }
  return { tickets, warnings };
}

const noLesson = (x) => String(x ?? '').normalize('NFC').trim().toLowerCase() === 'không có';
/** Phòng Kỹ sư closes a ticket only with its ledger line and a lesson (or "không có"): throws what is missing. */
function refuseGaps(t, lesson, env) {
  const gaps = !t.repo ? ['chưa có repo: thêm "repo" vào file kết quả']
    : !allowedRepo(t.repo, { env }) ? [`${t.repo} không phải repo git trong thư mục dự án hoặc thư mục skill`]
      : [!readLedger(t.repo).some((e) => e.id === t.id) && `chưa có dòng sổ đo: ledger.mjs start ${t.repo} ${t.id} <mức>`,
        !noLesson(lesson) && !hasLesson(t.repo, t.id) && `chưa có bài học: progress.mjs lesson với task chứa ${t.id}, hoặc thêm "lesson": "không có" vào file kết quả`].filter(Boolean);
  if (gaps.length) throw new Error(`Phiếu ${t.id} chưa đủ để ghi kết quả: ${gaps.join('; ')}`);
}

/** Moves t (already read under its lock) to `to`, or throws: only the allowed moves; work starts ("đã giao", "đang
    làm") only once the ticket is analysed and anh answered its questions; a department on probation ends in "chờ anh
    nhận", never straight in "xong". */
function move(t, to, { by, note, env, now }) {
  if (!(NEXT[t.status] || []).includes(to)) throw new Error(`Không chuyển được phiếu ${t.id}: ${t.status} → ${to}`);
  if ((to === 'đã giao' || to === 'đang làm') && t.status !== 'đã giao') {
    if (!t.analysis) throw new Error(`Phiếu ${t.id} chưa có phân tích: phân tích trước khi giao`);
    if (needsConfirmation(t)) throw new Error(`Phiếu ${t.id} còn câu hỏi chờ anh xác nhận`);
    const waiting = t.after.filter((a) => readJson(fileOf(a, env))?.status !== 'xong');
    if (waiting.length) throw new Error(`Phiếu ${t.id} còn chờ phiếu: ${waiting.join(', ')}`);
  }
  if ((to === 'xong' || to === 'chờ anh nhận') && !String(t.result?.summary ?? '').trim())
    throw new Error(`Phiếu ${t.id} chưa có kết quả: ghi kết quả (tickets.mjs result) trước khi xong`);
  if ((to === 'xong' || to === 'chờ anh nhận') && t.department === ENGINEERING) refuseGaps(t, t.result.lesson, env);   // (a result written before the ticket came here)
  let auto = false;
  const working = ['đã giao', 'đang làm', 'chờ anh nhận', 'xong'];
  const dept = working.includes(to) ? findDepartment(t.department, env) : null;
  if (working.includes(to) && !dept)
    throw new Error(`Phiếu ${t.id}: ${t.department ? `không có phòng ${t.department} trong sổ phòng ban` : 'chưa giao phòng nào'}`);
  if (to === 'xong' && t.status !== 'chờ anh nhận') {
    if (dept.status === 'probation') {
      if (!autoMode({ env })) throw new Error(`Phiếu ${t.id}: phòng ${t.department} đang thử việc, kết quả phải qua "chờ anh nhận"`);
      auto = true;   // (Auto on: finished without anh; not counted towards leaving probation)
    }
  }
  t.history.push({ at: now.toISOString(), from: t.status, to, by: by ?? null, ...(auto && { auto: true }) });
  if (note) t.notes.push({ at: now.toISOString(), by: by ?? null, text: String(note) });
  t.status = to;
}

export function setStatus(id, to, { by, note, env = process.env, now = new Date() } = {}) {
  safeId(id);
  return change(id, env, now, (t) => move(t, to, { by, note, env, now }));
}

export function addNote(id, { by, text }, { env = process.env, now = new Date() } = {}) {
  safeId(id);
  return change(id, env, now, (t) => { t.notes.push({ at: now.toISOString(), by: by ?? null, text: String(text ?? '') }); });
}

export function setResult(id, { summary, links = [], repo, lesson }, { env = process.env, now = new Date() } = {}) {
  safeId(id);
  if (!String(summary ?? '').trim()) throw new Error('result: thiếu summary');
  if (!Array.isArray(links) || !links.every((l) => typeof l === 'string')) throw new Error('result: links phải là danh sách chuỗi');
  const t = change(id, env, now, (x) => {
    if (repo && !x.repo) x.repo = path.resolve(String(repo));
    if (x.department === ENGINEERING) refuseGaps(x, lesson, env);
    x.result = { summary: String(summary ?? ''), links: links.map(String), ...(noLesson(lesson) && { lesson: 'không có' }) };
  });
  if (repo) addTicketRepo(t.repo, { env });
  return t;
}

const strings = (x) => (Array.isArray(x) ? x.map((v) => String(v).trim()).filter(Boolean) : []);
/** The analysis made before any work starts: what anh really wants, what is delivered, when it counts as done, what
    was assumed, the risks, which departments, and what anh must confirm. */
export function setAnalysis(id, a, { env = process.env, now = new Date() } = {}) {
  safeId(id);
  const goal = String(a?.goal ?? '').trim(), deliverables = strings(a?.deliverables), criteria = strings(a?.criteria);
  const missing = [!goal && 'goal', !deliverables.length && 'deliverables', !criteria.length && 'criteria'].filter(Boolean);
  if (missing.length) throw new Error(`Phân tích thiếu: ${missing.join(', ')}`);
  const analysis = { goal, deliverables, criteria, assumptions: strings(a.assumptions), risks: strings(a.risks),
    departments: strings(a.departments), questions: strings(a.questions) };
  return change(id, env, now, (t) => { t.analysis = analysis; });
}
/** Open questions for anh in the analysis -> the ticket waits for anh's confirmation. */
export const needsConfirmation = (t) => (t?.analysis?.questions?.length ?? 0) > 0;

/** Gives the ticket to a department and moves it to "đã giao", in one write: nothing changes when the move is refused. */
export function assign(id, department, { env = process.env, now = new Date() } = {}) {
  safeId(id);
  if (!findDepartment(department, env)) throw new Error(`Không có phòng ${department} trong sổ phòng ban`);
  const t = change(id, env, now, (x) => { x.department = department; move(x, 'đã giao', { by: SELF, env, now }); });   // (a refusal throws before the write)
  if (t.repo) addTicketRepo(t.repo, { env });
  return t;
}

/** A department's Lead raises a problem it cannot solve inside the department (stuck, short of a role or a tool, over
    budget, unclear request): need "trợ lý" (the Trợ lý giám đốc decides) or "anh" (only anh can). It stays open until
    resolveIssue. */
export function escalate(id, { by, problem, need }, { env = process.env, now = new Date() } = {}) {
  safeId(id);
  const text = String(problem ?? '').trim();
  if (!text) throw new Error('escalate: thiếu problem');
  if (!['trợ lý', 'anh'].includes(need)) throw new Error('escalate: need là "trợ lý" hoặc "anh"');
  return change(id, env, now, (t) => {
    t.issues = [...(t.issues ?? []), { at: now.toISOString(), by: by ?? null, problem: text, need, open: true }];
    t.notes.push({ at: now.toISOString(), by: by ?? null, text: `Báo vấn đề (${need}): ${text}` });
  });
}

export function resolveIssue(id, index, { by, how }, { env = process.env, now = new Date() } = {}) {
  safeId(id);
  return change(id, env, now, (t) => {
    const i = t.issues?.[index];
    if (!i) throw new Error(`Phiếu ${id} không có vấn đề số ${index}`);
    Object.assign(i, { open: false, resolvedAt: now.toISOString(), resolvedBy: by ?? null, how: String(how ?? '') });
  });
}

/** Every open problem the departments raised -> [{ ticket, index, issue }], oldest first. */
export function openIssues({ env = process.env } = {}) {
  return listTickets({ env }).tickets.flatMap((t) => (t.issues ?? []).map((issue, index) => ({ ticket: t, index, issue })).filter((x) => x.issue.open));
}

/** A ticket may start once every ticket it waits on is "xong" (a cancelled one blocks it: the user decides). */
export function canStart(id, { env = process.env } = {}) {
  const t = getTicket(id, { env });
  if (!t) throw new Error(`Không có phiếu ${id}`);
  const waitingOn = t.after.filter((a) => getTicket(a, { env })?.status !== 'xong');
  return { ok: waitingOn.length === 0, waitingOn };
}

/** Tickets "đang làm" with no update for `hours`. */
export function stale({ env = process.env, now = new Date(), hours = 24 } = {}) {
  return listTickets({ env, status: 'đang làm' }).tickets.filter((t) => now - new Date(t.updatedAt) > hours * 3600_000);
}

// CLI: create --json F | analysis ID --json F | escalate ID --by B --json F | resolve ID N --by B --json F | issues | show ID | list [--status S] | status ID TO --by B [--note N] | note ID --by B --json F
//      | result ID --json F | assign ID DEPT | can-start ID | stale — JSON on stdout; errors on stderr with exit 1.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [op, ...rest] = process.argv.slice(2);
  const { values: v, positionals: p } = parseArgs({ args: rest, allowPositionals: true, strict: false,
    options: { json: { type: 'string' }, status: { type: 'string' }, by: { type: 'string' }, note: { type: 'string' } } });
  const j = () => JSON.parse(fs.readFileSync(v.json, 'utf8'));
  try {
    const out = {
      create: () => createTicket(j()),
      show: () => getTicket(p[0]),
      list: () => listTickets({ status: v.status }),
      status: () => setStatus(p[0], p[1], { by: v.by, note: v.note }),
      note: () => addNote(p[0], { by: v.by, text: j().text }),
      result: () => setResult(p[0], j()),
      analysis: () => setAnalysis(p[0], j()),
      escalate: () => escalate(p[0], { by: v.by, ...j() }),
      resolve: () => resolveIssue(p[0], Number(p[1]), { by: v.by, how: j().how }),
      issues: () => openIssues().map(({ ticket, index, issue }) => ({ ticket: ticket.id, title: ticket.title, department: ticket.department, index, ...issue })),
      assign: () => assign(p[0], p[1]),
      stale: () => stale(),
      'can-start': () => canStart(p[0]),
    }[op];
    if (!out) throw new Error('Dùng: tickets.mjs create|analysis|escalate|resolve|issues|show|list|status|note|result|assign|stale …');
    console.log(JSON.stringify(out(), null, 2));
  } catch (e) { console.error(e.message); process.exit(1); }
}
