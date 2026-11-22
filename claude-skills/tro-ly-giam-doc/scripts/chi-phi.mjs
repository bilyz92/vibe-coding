#!/usr/bin/env node
// Chi phí AI theo phòng ban: đọc transcript Claude Code (JSONL dưới ~/.claude/projects, kèm file output của subagent),
// đếm token từng lượt trả lời, quy về phòng ban / vai theo department.json, rồi tính chi phí quy đổi theo giá API.
//   node chi-phi.mjs tuan [--tu YYYY-MM-DD --den YYYY-MM-DD] [--json]
//   node chi-phi.mjs canh-bao [--den YYYY-MM-DD] [--json]
// Node stdlib only.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { loadDepartments, skillsDir } from './departments.mjs';
import { readJson } from './store.mjs';

// Giá API, USD cho 1 triệu token. Đội nội bộ chạy bằng gói thuê bao (subscription), nên đây là "chi phí quy đổi" để so
// sánh giữa các phòng, không phải hoá đơn. Ghi cache = 1,25 × giá vào; đọc cache = 0,1 × giá vào.
export const PRICES = { opus: { in: 4, out: 20 }, sonnet: { in: 2, out: 10 }, haiku: { in: 0.1, out: 0.5 } };
const CACHE_WRITE = 1.25, CACHE_READ = 0.1;

export const MAIN = '(phiên chính)';            // lượt không có attributionAgent ngoài subagent: Trợ lý giám đốc
export const MAIN_DEPT = 'tro-ly-giam-doc', OTHER_DEPT = 'khac';
// Agent dựng sẵn của Claude Code, không thuộc department.json nào.
const BUILTIN_DEPT = { 'general-purpose': 'phong-ky-su', Explore: 'phong-ky-su', Plan: 'phong-ky-su', claude: 'phong-ky-su' };
const PSEUDO = { [MAIN_DEPT]: 'Trợ lý giám đốc', [OTHER_DEPT]: 'Khác' };
const DAY = 86400000, WARN_AT = 80;

/** Tokens tính hạn mức tuần: vào + ghi cache + ra (đọc cache rẻ 10 lần và lặp lại mỗi lượt, nên không tính). */
export const budgetTokens = (u) => u.in + u.cacheWrite + u.out;

/** model id -> USD for one turn's usage, or null when the model family has no price. */
export function price(model, u) {
  const fam = Object.keys(PRICES).find((f) => String(model).includes(f));
  if (!fam) return null;
  const p = PRICES[fam];
  return (u.in * p.in + u.cacheWrite * p.in * CACHE_WRITE + u.cacheRead * p.in * CACHE_READ + u.out * p.out) / 1e6;
}

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
function localDay(s) {
  const m = DATE.exec(s ?? '');
  const d = m && new Date(+m[1], m[2] - 1, +m[3]);
  if (!d || d.getMonth() !== m[2] - 1 || d.getDate() !== +m[3]) throw new Error(`Ngày không hợp lệ (cần YYYY-MM-DD): ${s}`);
  return d;
}
export const dayStart = (s) => localDay(s).getTime();
export const dayEnd = (s) => localDay(s).getTime() + DAY - 1;

// ~/.claude/projects, plus only the tasks/ folders of /tmp/claude-<uid>/<project>/ (the rest of /tmp holds scratchpads
// and worktrees, whose *.jsonl are not transcripts).
export const defaultRoots = () => {
  const tmp = path.join('/tmp', `claude-${os.userInfo().uid}`);
  let tasks = [];
  try { tasks = fs.readdirSync(tmp).map((n) => path.join(tmp, n, 'tasks')).filter((d) => fs.existsSync(d)); } catch { /* none */ }
  return [path.join(os.homedir(), '.claude', 'projects'), ...tasks];
};

/** Every *.jsonl, and every *.output under a tasks/ folder, below the roots, modified at or after `since`; links resolved, each real file once. */
function transcriptFiles(roots, since) {
  const seen = new Set(), out = [];
  const walk = (dir, depth) => {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (depth < 6) walk(p, depth + 1); continue; }
      if (!(e.name.endsWith('.jsonl') || (e.name.endsWith('.output') && path.basename(dir) === 'tasks'))) continue;
      let real, st;
      try { real = fs.realpathSync(p); st = fs.statSync(real); } catch { continue; }
      if (!st.isFile() || st.mtimeMs < since || seen.has(real)) continue;
      seen.add(real); out.push(real);
    }
  };
  for (const r of roots) walk(r, 0);
  return out;
}

const metaAgent = (file) => readJson(file.replace(/\.jsonl$/, '.meta.json'))?.agentType ?? null;
const num = (x) => (Number.isFinite(x) ? x : 0);

/** One transcript line -> a turn record, or null when it is not a priced assistant turn. */
export function toRecord(o, fileAgent) {
  const m = o?.message;
  if (o?.type !== 'assistant' || !m?.usage || !m.id || m.model === '<synthetic>') return null;
  const u = m.usage;
  return {
    id: m.id, requestId: o.requestId ?? null, ts: Date.parse(o.timestamp), model: m.model ?? o.requestedModel ?? '?',
    agent: o.attributionAgent ?? (o.isSidechain ? fileAgent ?? '(subagent)' : MAIN),
    sessionId: o.sessionId ?? '?', invocation: o.isSidechain ? `${o.sessionId}/${o.agentId}` : o.sessionId ?? '?',
    usage: { in: num(u.input_tokens), out: num(u.output_tokens), cacheWrite: num(u.cache_creation_input_tokens), cacheRead: num(u.cache_read_input_tokens) },
  };
}

/** -> the turns in [from, to], one per message id (a turn written as several lines, or in two files, counts once). */
export async function collect({ roots = defaultRoots(), from, to }) {
  const byId = new Map();
  for (const file of transcriptFiles(roots, from)) {
    const fileAgent = metaAgent(file);
    try {
      const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
      for await (const line of rl) {
        if (!line.includes('"assistant"') || !line.includes('"usage"')) continue;
        let r;
        try { r = toRecord(JSON.parse(line), fileAgent); } catch { continue; }
        if (!r || !(r.ts >= from && r.ts <= to)) continue;
        const key = r.id, prev = byId.get(key);
        // the same turn may be logged again with a fuller usage; keep the larger one
        if (!prev || budgetTokens(r.usage) + r.usage.cacheRead > budgetTokens(prev.usage) + prev.usage.cacheRead) byId.set(key, r);
      }
    } catch (e) { if (e.code !== 'ENOENT') throw e; }   // a live session's task output can vanish while we read
  }
  return [...byId.values()];
}

const tokens = (x) => (typeof x === 'number' && x > 0 ? x : null);

function loadConfig(env) {
  const file = env.CHI_PHI_CONFIG || path.join(skillsDir({ env }), 'tro-ly-giam-doc', 'chi-phi.json');
  return readJson(file) ?? {};
}

/** -> { name -> { title, budgetUsd, tokenTuan, roles: { agent -> title } } } and agent -> department name. */
function directory(env) {
  const { departments, warnings } = loadDepartments({ env });
  const cfg = loadConfig(env), depts = {}, agentDept = {};
  for (const d of departments) {
    const own = tokens(d.tokenTuan);
    depts[d.name] = { title: d.title, budgetUsd: d.budgetUsd, tokenTuan: own ?? tokens(cfg.tokenTuan?.[d.name]), tokenUocLuong: !own,
      roles: Object.fromEntries(d.roles.map((r) => [r.agent, r.title])), real: true };
    for (const r of d.roles) agentDept[r.agent] ??= d.name;
  }
  for (const [n, title] of Object.entries(PSEUDO)) depts[n] = { title, budgetUsd: null, tokenTuan: tokens(cfg.tokenTuan?.[n]), tokenUocLuong: true, roles: {}, real: false };
  depts[MAIN_DEPT].roles[MAIN] = 'Trợ lý giám đốc (phiên chính)';
  const deptOf = (agent) => (agent === MAIN ? MAIN_DEPT : agentDept[agent] ?? (depts[BUILTIN_DEPT[agent]] ? BUILTIN_DEPT[agent] : OTHER_DEPT));
  return { depts, deptOf, warnings };
}

const zero = () => ({ turns: 0, in: 0, out: 0, cacheWrite: 0, cacheRead: 0, tokens: 0, usd: 0, unpriced: 0, sessions: new Set() });
function add(acc, r, sessionKey) {
  acc.turns++;
  for (const k of ['in', 'out', 'cacheWrite', 'cacheRead']) acc[k] += r.usage[k];
  acc.tokens += budgetTokens(r.usage);
  const usd = price(r.model, r.usage);
  if (usd === null) acc.unpriced++; else acc.usd += usd;
  acc.sessions.add(sessionKey);
}
const finish = ({ sessions, ...a }) => ({ ...a, sessions: sessions.size, usdPerSession: sessions.size ? a.usd / sessions.size : 0 });

/** -> per department (sorted by USD) and per role: turns, tokens, equivalent USD, sessions. */
export function aggregate(records, { env = process.env } = {}) {
  const { depts, deptOf, warnings } = directory(env), acc = {};
  for (const r of records) {
    const dn = deptOf(r.agent);
    const d = (acc[dn] ??= { ...zero(), roles: {} });
    add(d, r, r.sessionId);                                   // one parent session ≈ one task for the department
    add((d.roles[r.agent] ??= zero()), r, r.invocation);      // one subagent run (or main session) for the role
  }
  const departments = Object.entries(depts).map(([name, info]) => {
    const a = acc[name] ?? { ...zero(), roles: {} };
    return {
      name, title: info.title, real: info.real, budgetUsd: info.budgetUsd, tokenTuan: info.tokenTuan, tokenUocLuong: !!(info.tokenTuan && info.tokenUocLuong), ...finish(a),
      roles: Object.entries(a.roles).map(([agent, x]) => ({ agent, title: info.roles[agent] ?? agent, ...finish(x) })).sort((p, q) => q.usd - p.usd),
    };
  }).sort((p, q) => q.usd - p.usd || p.name.localeCompare(q.name));
  return { departments, warnings };
}

const rootsOf = (env) => (env.CHI_PHI_ROOTS ? env.CHI_PHI_ROOTS.split(path.delimiter) : defaultRoots());

export async function tuan({ env = process.env, from, to, roots = rootsOf(env) } = {}) {
  to ??= Date.now(); from ??= to - 7 * DAY;
  return { from, to, ...aggregate(await collect({ roots, from, to }), { env }) };
}

/** Roles/departments whose average cost per run/session tops budgetUsd (30 days), token budget ≥ 80 % (7 days), idle departments (30 days). */
export async function canhBao({ env = process.env, now = Date.now(), roots = rootsOf(env) } = {}) {
  const records = await collect({ roots, from: now - 30 * DAY, to: now });   // read once; the week is a slice of the month
  const month = aggregate(records, { env });
  const week = aggregate(records.filter((r) => r.ts >= now - 7 * DAY), { env });
  const overBudget = [];
  for (const d of month.departments.filter((x) => x.budgetUsd)) {
    if (d.usdPerSession > d.budgetUsd) overBudget.push({ department: d.name, title: d.title, budgetUsd: d.budgetUsd, usdPerSession: d.usdPerSession, sessions: d.sessions });
    for (const r of d.roles) if (r.usdPerSession > d.budgetUsd)
      overBudget.push({ department: d.name, title: d.title, agent: r.agent, role: r.title, budgetUsd: d.budgetUsd, usdPerSession: r.usdPerSession, sessions: r.sessions });
  }
  const tokenBudget = week.departments.filter((d) => d.tokenTuan && d.tokens >= d.tokenTuan * WARN_AT / 100)
    .map((d) => ({ department: d.name, title: d.title, tokens: d.tokens, tokenTuan: d.tokenTuan, tokenUocLuong: d.tokenUocLuong, pct: Math.round(d.tokens / d.tokenTuan * 100),
      level: d.tokens >= d.tokenTuan ? 100 : WARN_AT }));
  const idle = month.departments.filter((d) => d.real && d.turns === 0).map((d) => ({ name: d.name, title: d.title }));
  return { now, overBudget, tokenBudget, idle, warnings: month.warnings };
}

const n0 = (x) => Math.round(x).toLocaleString('vi-VN');
const usd = (x) => `$${x.toFixed(2)}`;
const day = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const NOTE = '_Chi phí quy đổi theo giá API (Opus $4/$20, Sonnet $2/$10, Haiku $0,10/$0,50 mỗi triệu token vào/ra; ghi cache 1,25×, đọc cache 0,1× giá vào). '
  + 'Đội chạy bằng gói thuê bao: đây là số để so sánh giữa các phòng, không phải hoá đơn. '
  + 'Token hạn mức = vào + ghi cache + ra (không tính đọc cache)._';
const est = (d) => (d.tokenUocLuong ? ' [ƯỚC LƯỢNG]' : '');   // budget from chi-phi.json, not one the department set
const pctOf = (d) => (d.tokenTuan ? `${Math.round(d.tokens / d.tokenTuan * 100)} % của ${n0(d.tokenTuan)}${est(d)}` : '—');

export function renderTuan(r) {
  const active = r.departments.filter((d) => d.turns);
  const out = [`# Chi phí AI theo phòng ban (${day(r.from)} → ${day(r.to)})`, '', NOTE, '',
    '| Phòng | Lượt | Token hạn mức | Hạn mức tuần | USD quy đổi | Phiên | USD/phiên | Ngân sách/việc |', '|---|---:|---:|---:|---:|---:|---:|---:|'];
  for (const d of r.departments) out.push(`| ${d.title} | ${n0(d.turns)} | **${n0(d.tokens)}** | ${pctOf(d)} | ${usd(d.usd)} | ${d.sessions} | ${usd(d.usdPerSession)} | ${d.budgetUsd ? usd(d.budgetUsd) : '—'} |`);
  const t = active.reduce((a, d) => ({ turns: a.turns + d.turns, tokens: a.tokens + d.tokens, usd: a.usd + d.usd }), { turns: 0, tokens: 0, usd: 0 });
  out.push(`| **Tổng** | ${n0(t.turns)} | **${n0(t.tokens)}** | | ${usd(t.usd)} | | | |`);
  for (const d of active) {
    out.push('', `## ${d.title}`, '', '| Vai | Agent | Lượt | Vào | Ra | Ghi cache | Đọc cache | Token hạn mức | USD quy đổi | USD/lượt chạy |', '|---|---|---:|---:|---:|---:|---:|---:|---:|---:|');
    for (const x of d.roles) out.push(`| ${x.title} | ${x.agent} | ${n0(x.turns)} | ${n0(x.in)} | ${n0(x.out)} | ${n0(x.cacheWrite)} | ${n0(x.cacheRead)} | **${n0(x.tokens)}** | ${usd(x.usd)}${x.unpriced ? ` (+${x.unpriced} lượt chưa có giá)` : ''} | ${usd(x.usdPerSession)} |`);
  }
  if (r.warnings?.length) out.push('', '## Cảnh báo đọc phòng ban', ...r.warnings.map((w) => `- ${w}`));
  return `${out.join('\n')}\n`;
}

export function renderCanhBao(r) {
  const list = (xs) => (xs.length ? xs : ['- Không có']).join('\n');
  return `${[`# Cảnh báo chi phí AI (đến ${day(r.now)})`, '', NOTE, '',
    '## Vượt ngân sách mỗi việc (30 ngày)', '',
    list(r.overBudget.map((x) => `- ${x.title}${x.agent ? ` · ${x.role} (${x.agent})` : ' (cả phòng, tính theo phiên)'}: trung bình ${usd(x.usdPerSession)}/${x.agent ? 'lượt chạy' : 'phiên'} > ngân sách ${usd(x.budgetUsd)} (${x.sessions} ${x.agent ? 'lượt chạy' : 'phiên'})`)), '',
    '## Hạn mức token tuần (7 ngày)', '',
    list(r.tokenBudget.map((x) => `- ${x.title}: ${n0(x.tokens)} / ${n0(x.tokenTuan)} token${est(x)} = ${x.pct} % — ${x.level === 100 ? 'VƯỢT hạn mức' : 'đã quá 80 %'}`)), '',
    '## Phòng không hoạt động 30 ngày (cân nhắc gộp hoặc tạm dừng)', '',
    list(r.idle.map((x) => `- ${x.title} (${x.name})`)),
    ...(r.warnings?.length ? ['', '## Cảnh báo đọc phòng ban', ...r.warnings.map((w) => `- ${w}`)] : []),
  ].join('\n')}\n`;
}

function parseArgs(argv) {
  const o = { json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') o.json = true;
    else if (a === '--tu' || a === '--den') { if (!argv[i + 1]) throw new Error(`${a} cần ngày YYYY-MM-DD`); o[a.slice(2)] = argv[++i]; }
    else throw new Error(`Tham số lạ: ${a}`);
  }
  return o;
}

async function main([cmd, ...rest]) {
  const o = parseArgs(rest);
  if (cmd === 'tuan') {
    const to = o.den ? dayEnd(o.den) : Date.now();
    const from = o.tu ? dayStart(o.tu) : to - 7 * DAY;
    if (from > to) throw new Error('--tu phải trước --den');
    const r = await tuan({ from, to });
    return o.json ? `${JSON.stringify(r, null, 2)}\n` : renderTuan(r);
  }
  if (cmd === 'canh-bao') {
    if (o.tu) throw new Error('canh-bao chỉ nhận --den');
    const r = await canhBao({ now: o.den ? dayEnd(o.den) : Date.now() });
    return o.json ? `${JSON.stringify(r, null, 2)}\n` : renderCanhBao(r);
  }
  throw new Error('Dùng: chi-phi.mjs tuan [--tu YYYY-MM-DD --den YYYY-MM-DD] [--json] | canh-bao [--den YYYY-MM-DD] [--json]');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((s) => process.stdout.write(s), (e) => { console.error(e.message); process.exitCode = 1; });
}
