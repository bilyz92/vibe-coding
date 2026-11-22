#!/usr/bin/env node
// Khuôn tạo phòng / tạo vai — the two levels the user agreed to:
//   level 1, addRole: a role missing from an existing department is created right away (never a duplicate, never more
//   tools than the department allows) and reported afterwards;
//   level 2, proposeDepartment -> applyProposal: a whole new department is only written down as a proposal (one message
//   for the user); it is built when the user says "ok <id>", from exactly the proposal they saw (its hash), on probation.
// Nothing here downloads or installs outside skills: SKILL.md does that, after skill-audit.mjs. Node stdlib only.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { companyDir, safeId, readJson, writeJson, edit, newId } from './store.mjs';
import { withLock } from '../../codex-review/scripts/progress-lock.mjs';
import { skillsDir, loadDepartments, validateDepartment, findSimilar, toolsAllowed, overlap, MODELS, KINDS, TOOL } from './departments.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES = path.join(HERE, '..', 'templates');
const NAME = /^[a-z0-9][a-z0-9-]{0,63}$/;
const ONE_ONLY = ['lead', 'thu-ky'];   // (a department has one Lead and one Thư ký)
/** Every scaffold write (roles, departments) runs under one company-wide lock: two creations never race on the same
    agent names or folder. */
const underScaffold = (env, fn) => { fs.mkdirSync(companyDir({ env }), { recursive: true }); return withLock(path.join(companyDir({ env }), 'scaffold.lock'), fn); };
export const agentsDir = ({ env = process.env } = {}) => env.CLAUDE_AGENTS_DIR || path.join(os.homedir(), '.claude', 'agents');

// (one pass over the template: a {{...}} inside a value put in is kept as written, never filled in turn)
const fill = (name, values) => fs.readFileSync(path.join(TEMPLATES, name), 'utf8')
  .replace(/\{\{(\w+)\}\}/g, (m, k) => (Object.hasOwn(values, k) ? String(values[k]) : m));
const oneLine = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

/** JSON with every object's keys sorted, so the same proposal always hashes the same. */
const stable = (v) => (Array.isArray(v) ? `[${v.map(stable).join(',')}]`
  : v && typeof v === 'object' ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}` : JSON.stringify(v));
export const hashSpec = (spec) => crypto.createHash('sha256').update(stable(spec)).digest('hex');

function roleProblems(r, department) {
  const p = [];
  if (!NAME.test(r?.agent ?? '')) p.push(`agent ${JSON.stringify(r?.agent)}: tên không hợp lệ`);
  if (!MODELS.includes(r?.model)) p.push(`${r?.agent}: model ${MODELS.join(' | ')}`);
  if (!KINDS.includes(r?.kind)) p.push(`${r?.agent}: kind ${KINDS.join(' | ')}`);
  if (!oneLine(r?.title) || !oneLine(r?.description)) p.push(`${r?.agent}: thiếu title hoặc description`);
  if (!Array.isArray(r?.tools) || !r.tools.length) p.push(`${r?.agent}: thiếu tools`);
  else if (!r.tools.every((t) => typeof t === 'string' && TOOL.test(t))) p.push(`${r.agent}: tên công cụ không hợp lệ`);
  else { const t = toolsAllowed(department, r.tools); if (!t.ok) p.push(`${r.agent}: công cụ phòng không cho phép: ${t.extra.join(', ')}`); }
  return p;
}

/** Where an agent named so is already installed (the repo's _agents/ or the installed agents) -> that path, or null. */
function agentFile(agent, env) {
  return [path.join(skillsDir({ env }), '_agents', `${agent}.md`), path.join(agentsDir({ env }), `${agent}.md`)].find((f) => fs.existsSync(f)) || null;
}
const agentDescription = (agent, env) => {
  const f = agentFile(agent, env);
  return f ? (/^description:\s*(.*)$/m.exec(fs.readFileSync(f, 'utf8'))?.[1] ?? '') : '';
};

// (frontmatter values are written as JSON strings: valid YAML double-quoted scalars, whatever ": " or quotes they hold)
function agentText(r, department) {
  const body = r.body?.trim() || `Bạn là ${oneLine(r.title)} của ${department.title}. ${oneLine(r.description)}.\n\n`
    + 'Làm đúng phần việc của mình, không làm thay vai khác.';
  return fill('agent.md', { name: r.agent, descriptionJson: JSON.stringify(oneLine(r.description)), tools: r.tools.join(', '), model: r.model,
    body, external: oneLine(department.external) });
}

/** Writes an agent into the repo's _agents/ and installs the same file -> the repo path written. */
function writeAgent(r, department, env, written = []) {
  const text = agentText(r, department);
  for (const d of [path.join(skillsDir({ env }), '_agents'), agentsDir({ env })]) {
    fs.mkdirSync(d, { recursive: true });
    const f = path.join(d, `${r.agent}.md`);
    fs.writeFileSync(f, text, { flag: 'wx' });   // (never over an agent someone else just wrote)
    written.push(f);
  }
  return `_agents/${r.agent}.md`;
}

/** Level 1: adds a missing role to an existing department -> { created: true, files } (paths in the skills repo, to
    commit) or { created: false, reason: 'trùng' | 'vượt quyền' | 'sai', existing?, detail? }. */
export function addRole(departmentName, role, { env = process.env } = {}) {
  return underScaffold(env, () => {
    const d = loadDepartments({ env }).departments.find((x) => x.name === departmentName);
    if (!d) throw new Error(`Không có phòng ${departmentName}`);
    if (agentFile(role?.agent ?? '', env)) return { created: false, reason: 'trùng', existing: role.agent };
    const same = d.roles.find((r) => r.kind === role?.kind
      && (ONE_ONLY.includes(r.kind) || overlap(role.description, `${r.title} ${agentDescription(r.agent, env)}`) >= 0.6));
    if (same) return { created: false, reason: 'trùng', existing: same.agent };
    const problems = roleProblems(role, d);
    if (problems.length) return { created: false, reason: problems.some((p) => p.includes('không cho phép')) ? 'vượt quyền' : 'sai', detail: problems.join('; ') };
    const file = path.join(skillsDir({ env }), d.skill, 'department.json');
    const next = { ...d, roles: [...d.roles, { agent: role.agent, title: role.title, kind: role.kind, model: role.model }] };
    if (validateDepartment(next).length) return { created: false, reason: 'sai', detail: validateDepartment(next).join('; ') };
    const written = [];
    try {
      const files = [writeAgent(role, d, env, written)];
      writeJson(file, next);   // (under the scaffold lock, so read-check-write of the manifest can't interleave)
      return { created: true, files: [...files, `${d.skill}/department.json`] };
    } catch (e) {
      for (const w of written.reverse()) fs.rmSync(w, { force: true });
      throw e;
    }
  });
}

const proposalFile = (id, env) => path.join(companyDir({ env }), 'proposals', `${safeId(id)}.json`);
const departmentOf = (spec) => ({ name: spec.name, title: spec.title, handles: spec.handles, skill: spec.skill, status: 'probation',
  allowedTools: spec.allowedTools, budgetUsd: spec.budgetUsd, external: spec.external,
  roles: (spec.roles ?? []).map(({ agent, title, kind, model }) => ({ agent, title, kind, model })) });

const DIRECT_INSTALL_LICENSES = ['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause'];

function sourceText(s) {
  if (s.source === 'local') return `${s.name} (có sẵn)`;
  if (s.source === 'marketplace') return `${s.name} (chợ plugin chính thức)`;
  if (s.source === 'github' || s.source === 'gitlab') return `${s.name} (${s.source === 'github' ? 'GitHub' : 'GitLab'} ${s.url} @${s.commit}, ${s.license === 'unclear' ? 'giấy phép chưa rõ (chỉ học ý tưởng, tự viết lại)' : `giấy phép ${s.license}`}, ${s.mode === 'installed' ? `cài thẳng cây ${s.tree.slice(0, 12)}, ` : ''}đã kiểm 2 lớp${s.audit.info?.length ? `, ${s.audit.info.length} chỗ gọi mạng` : ''})`;
  return `${s.name} (tự viết)`;
}

function summaryOf(id, spec, code) {
  const missing = (spec.machineTools ?? []).filter((t) => !t.present);
  return [
    `Đề xuất lập ${spec.title} (${id}): ${spec.roles.length} vai, ${spec.workflow.length} bước.`,
    `- Nhận việc: ${oneLine(spec.handles)}`,
    `- Vai: ${spec.roles.map((r) => `${r.title} – ${r.agent} (${r.model})`).join('; ')}`,
    `- Công cụ phòng: ${spec.allowedTools.join(', ')}`,
    `- Công cụ từng vai: ${spec.roles.map((r) => `${r.agent}: ${r.tools.join(', ')}`).join('; ')}`,
    ...spec.roles.filter((r) => r.body?.trim()).map((r) => `- Hướng dẫn riêng của ${r.agent}: ${oneLine(r.body)}`),
    `- Ngân sách mỗi việc: ${spec.budgetUsd} USD`,
    `- Các bước: ${spec.workflow.map((w, i) => `${i + 1}. ${oneLine(w)}`).join(' ')}`,
    `- Skill: ${(spec.skills ?? []).map(sourceText).join('; ') || 'không cần thêm'}`,
    `- Công cụ máy còn thiếu: ${missing.map((t) => `${t.name} (cài: ${t.install || 'anh tự cài'})`).join('; ') || 'không thiếu'}`,
    `- Chi phí: ${(spec.costs ?? []).map((c) => `${c.what} ${c.estimate}`).join('; ') || 'không có dịch vụ trả phí'}`,
    `- Việc ra bên ngoài luôn chờ anh duyệt. ${oneLine(spec.external)} Phòng thử việc: kết quả chờ anh nhận cho tới khi anh nhận 3 việc.`,
    `Anh trả lời "ok ${id} ${code}" để lập phòng.`,
  ].join('\n');
}

/** Every check of a proposed department (shape, workflow, tools, roles, each skill's source and both security layers)
    -> the problems found. Run when proposing and again when applying, so a proposal stored before a check existed is refused. */
function specProblems(spec) {
  const dept = departmentOf(spec), problems = validateDepartment(dept);
  if (!Array.isArray(spec.workflow) || !spec.workflow.length) problems.push('workflow: thiếu các bước');
  if (!Array.isArray(spec.allowedTools)) problems.push('allowedTools: phòng mới cần danh sách công cụ cụ thể, không được "all"');
  for (const r of spec.roles ?? []) problems.push(...roleProblems(r, dept));
  for (const s of spec.skills ?? []) {
    if (!NAME.test(String(s.name ?? ''))) problems.push(`skill ${JSON.stringify(s.name)}: tên không hợp lệ (chữ thường, số, gạch ngang)`);
    if (!['local', 'marketplace', 'github', 'gitlab', 'new'].includes(s.source)) problems.push(`skill ${s.name}: nguồn không rõ`);
    const outside = s.source === 'github' || s.source === 'gitlab';
    if (outside && !(s.url && s.commit && s.audit)) problems.push(`skill ${s.name}: thiếu url, commit hoặc kết quả kiểm`);
    if (s.audit && s.audit.ok !== true) problems.push(`skill ${s.name}: kiểm không đạt, không được đưa vào đề xuất`);
    if (outside && !(typeof s.license === 'string' && /^[A-Za-z0-9][A-Za-z0-9.+-]{0,63}$/.test(s.license)))
      problems.push(`skill ${s.name}: thiếu giấy phép (license.verdict của skill-intake, vd MIT hoặc unclear)`);
    const sr = s.securityReview;
    if (outside && !(sr?.tool === 'codex-security-review' && sr.verdict === 'pass' && sr.commit && sr.commit === s.commit))
      problems.push(`skill ${s.name}: thiếu lớp kiểm 2 (securityReview: tool codex-security-review, verdict pass, commit trùng ${s.commit})`);
    if (outside && s.mode === 'installed' && !(DIRECT_INSTALL_LICENSES.includes(s.license) && /^[0-9a-f]{40}$/.test(s.tree ?? '') && s.audit?.tree === s.tree && sr?.tree === s.tree))
      problems.push(`skill ${s.name}: cài thẳng cần giấy phép ${DIRECT_INSTALL_LICENSES.join(', ')} và tree, với audit.tree và securityReview.tree trùng tree`);
  }
  return problems;
}

/** Level 2, step 1: checks a new department and stores it as a proposal -> { id, hash, summary } (summary is the one
    message for the user). Nothing is written to the skills or agents folders. */
export function proposeDepartment(spec, { env = process.env, now = new Date() } = {}) {
  const dept = departmentOf(spec), problems = specProblems(spec);
  if (problems.length) throw new Error(`Đề xuất chưa hợp lệ: ${problems.join('; ')}`);
  return underScaffold(env, () => {   // (the duplicate checks and the write are one step)
    const pending = listProposals({ env, status: 'chờ anh' }).find((p) => p.spec.name === dept.name || p.spec.skill === dept.skill);
    if (pending) throw new Error(`Đã có đề xuất ${pending.id} cho ${dept.name} đang chờ anh`);
    const similar = findSimilar(loadDepartments({ env }).departments, dept);
    if (similar) throw new Error(`Đã có phòng gần giống: ${similar.name}`);
    const taken = spec.roles.map((r) => r.agent).filter((a) => agentFile(a, env));
    if (taken.length) throw new Error(`Đã có agent trùng tên: ${taken.join(', ')}`);
    const full = { ...spec, status: 'probation' }, id = newId('D', now), hash = hashSpec(full);
    writeJson(proposalFile(id, env), { id, status: 'chờ anh', hash, spec: full, createdAt: now.toISOString() });
    return { id, hash, summary: summaryOf(id, full, hash.slice(0, 8)) };
  });
}

export function listProposals({ env = process.env, status } = {}) {
  const dir = path.join(companyDir({ env }), 'proposals');
  let names = []; try { names = fs.readdirSync(dir).filter((n) => n.endsWith('.json')).sort(); } catch { /* none */ }
  return names.map((n) => readJson(path.join(dir, n)))
    .filter((p) => p && typeof p.id === 'string' && p.spec && typeof p.spec === 'object' && (!status || p.status === status));
}

export function rejectProposal(id, { env = process.env } = {}) {
  return edit(proposalFile(id, env), (p) => { if (!p) throw new Error(`Không có đề xuất ${id}`); return { ...p, status: 'từ chối' }; });
}

/** Level 2, step 2 (after anh's "ok <id> <code>"): builds the department exactly as proposed -> { files (in the
    skills repo, to commit), agentsInstalled }. code is the start of the hash shown to anh (8+ characters): it comes from
    anh's reply, never from the proposal file. Every check runs before the first write; a failure part-way removes what
    was written, so the proposal can be applied again. */
export function applyProposal(id, code, { env = process.env, now = new Date() } = {}) {
  const f = proposalFile(id, env);
  if (!/^[0-9a-f]{8,64}$/.test(String(code ?? ''))) throw new Error('Thiếu mã duyệt (8 ký tự trong tin đề xuất)');
  return underScaffold(env, () => withLock(`${f}.lock`, () => {
    const p = readJson(f);
    if (!p?.spec) throw new Error(`Không có đề xuất ${id}`);
    if (p.status !== 'chờ anh') throw new Error(`Đề xuất ${id} không còn chờ anh (${p.status})`);
    if (!p.hash?.startsWith(code) || hashSpec(p.spec) !== p.hash) throw new Error('Đề xuất đã đổi, cần gửi lại anh');
    const spec = p.spec, dept = departmentOf(spec), root = skillsDir({ env }), dir = path.join(root, spec.skill);
    const problems = specProblems(spec);
    if (problems.length) throw new Error(`Đề xuất chưa hợp lệ, cần soạn và gửi lại anh: ${problems.join('; ')}`);
    if (fs.existsSync(dir)) throw new Error(`Đã có thư mục ${spec.skill}`);
    const taken = spec.roles.map((r) => r.agent).filter((a) => agentFile(a, env));
    if (taken.length) throw new Error(`Đã có agent trùng tên: ${taken.join(', ')}`);

    const written = [];
    try {
      const testsDir = path.join(dir, 'tests');
      let mod = path.relative(testsDir, path.join(HERE, 'departments.mjs')).split(path.sep).join('/');
      if (!mod.startsWith('.')) mod = `./${mod}`;
      fs.mkdirSync(dir);   // (not recursive: fails if the folder appeared meanwhile, so it is ours to remove)
      written.push(dir);
      fs.mkdirSync(testsDir);
      fs.writeFileSync(path.join(dir, 'SKILL.md'), fill('department-skill.md', {
        name: spec.name, title: spec.title, handles: oneLine(spec.handles),
        descriptionJson: JSON.stringify(`${oneLine(spec.title)}: ${oneLine(spec.handles)}. Dùng khi Trợ lý giám đốc giao phiếu cho phòng này, hoặc anh "giao cho ${oneLine(spec.title)}".`), date: now.toISOString().slice(0, 10), id,
        rolesTable: spec.roles.map((r) => `| ${r.title} | \`${r.agent}\` | ${r.kind} | ${r.model} |`).join('\n'),
        workflow: spec.workflow.map((w, i) => `${i + 1}. ${oneLine(w)}`).join('\n'),
        external: oneLine(spec.external), budget: spec.budgetUsd,
        skills: (spec.skills ?? []).map((s) => `- ${sourceText(s)}`).join('\n') || '- (không cần thêm)',
      }));
      writeJson(path.join(dir, 'department.json'), dept);
      fs.writeFileSync(path.join(testsDir, 'department.test.mjs'), fill('department.test.mjs.tmpl', { name: spec.name, departmentsModule: mod }));
      const agents = spec.roles.map((r) => writeAgent(r, spec, env, written));
      writeJson(f, { ...p, status: 'đã duyệt', appliedAt: now.toISOString() });
      return {
        files: [`${spec.skill}/SKILL.md`, `${spec.skill}/department.json`, `${spec.skill}/tests/department.test.mjs`, ...agents],
        agentsInstalled: spec.roles.map((r) => path.join(agentsDir({ env }), `${r.agent}.md`)),
      };
    } catch (e) {
      for (const w of written.reverse()) fs.rmSync(w, { recursive: true, force: true });
      throw e;
    }
  }));
}

// CLI: add-role DEPT --json F | propose --json F | apply ID HASH | reject ID | proposals [--status S] — JSON on stdout.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [op, ...rest] = process.argv.slice(2);
  const flag = (n) => { const i = rest.indexOf(`--${n}`); return i >= 0 ? rest[i + 1] : undefined; };
  const j = () => JSON.parse(fs.readFileSync(flag('json'), 'utf8'));
  try {
    const out = {
      'add-role': () => addRole(rest[0], j()),
      propose: () => proposeDepartment(j()),
      apply: () => applyProposal(rest[0], rest[1]),
      reject: () => rejectProposal(rest[0]),
      proposals: () => listProposals({ status: flag('status') }),
    }[op];
    if (!out) throw new Error('Dùng: scaffold.mjs add-role DEPT --json F | propose --json F | apply ID HASH | reject ID | proposals [--status S]');
    console.log(JSON.stringify(out(), null, 2));
  } catch (e) { console.error(e.message); process.exit(1); }
}
