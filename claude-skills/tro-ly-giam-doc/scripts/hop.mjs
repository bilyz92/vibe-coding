#!/usr/bin/env node
// Họp giao ban: dựng chương trình họp từ phiếu việc, không gọi model, không gửi gì ra ngoài.
//   node hop.mjs giao-ban [--ngay YYYY-MM-DD]   hằng ngày 06:30: mỗi phòng hôm qua xong gì, đang làm gì, vướng gì, chờ phòng nào
//   node hop.mjs tuan [--ngay YYYY-MM-DD]       thứ Hai 08:00: như trên trong 7 ngày, thêm chi phí AI và báo cáo mới của các ban
// Ghi <companyDir>/hop/<ngày>-<loại>-chuong-trinh.md và in đường dẫn (JSON). Trợ lý giám đốc đọc file đó rồi họp theo
// references/hop-giao-ban.md; biên bản là <companyDir>/hop/<ngày>.md (giao ban) hay <ngày>-tuan.md. Node stdlib only.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { companyDir } from './store.mjs';
import { listTickets, getTicket, SELF } from './tickets.mjs';
import { loadDepartments } from './departments.mjs';

const H = 3600_000;
const pad = (n) => String(n).padStart(2, '0');
const dayOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;   // (như nhip.mjs, ngày theo giờ máy)
const line = (t) => `${t.id} ${t.title}`;
/** Lúc phiếu sang "xong" lần cuối (theo lịch sử, không theo lần sửa cuối). */
const doneAt = (t) => new Date([...t.history].reverse().find((h) => h.to === 'xong')?.at ?? t.updatedAt);

/** Báo cáo mới nhất trong một thư mục (chỉ file đặt tên theo ngày, vd 2026-11-09.md; bỏ hồ sơ <agent>.md), hoặc null. */
function newest(dir) {
  try {
    const f = fs.readdirSync(dir).filter((n) => /^\d{4}-\d{2}-\d{2}.*\.md$/.test(n)).sort().pop();
    return f ? path.join(dir, f) : null;
  } catch { return null; }
}

/** Chương trình họp -> markdown. kind: 'giao-ban' (24 giờ) hoặc 'tuan' (7 ngày). */
export function agenda(kind, { env = process.env, now = new Date(), chiPhi = null } = {}) {
  if (!['giao-ban', 'tuan'].includes(kind)) throw new Error('kind: giao-ban | tuan');
  const since = now - (kind === 'tuan' ? 7 * 24 : 24) * H;
  const { tickets } = listTickets({ env });
  const { departments, warnings } = loadDepartments({ env });
  const depts = [...departments.map((d) => ({ name: d.name, title: d.title })), { name: SELF, title: 'Trợ lý giám đốc' }];
  const known = new Set(depts.map((d) => d.name));
  for (const name of new Set(tickets.map((t) => t.department).filter((n) => n && !known.has(n)))) depts.push({ name, title: `Phòng không đọc được department.json` });
  const out = [`# Chương trình ${kind === 'tuan' ? 'họp tuần' : 'giao ban'} ${dayOf(now)}`, ''];
  for (const d of depts) {
    const mine = tickets.filter((t) => t.department === d.name);
    const xong = mine.filter((t) => t.status === 'xong' && doneAt(t) >= since);
    const lam = mine.filter((t) => ['đã giao', 'đang làm'].includes(t.status));
    const vuong = [
      ...mine.filter((t) => ['chờ anh', 'chờ đối tác'].includes(t.status) && !(t.issues ?? []).some((i) => i.open)).map((t) => `${line(t)} (${t.status})`),
      ...mine.filter((t) => t.status === 'đang làm' && now - new Date(t.updatedAt) > 24 * H).map((t) => `${line(t)} (không cập nhật quá 24 giờ)`),
      ...mine.flatMap((t) => (t.issues ?? []).filter((i) => i.open).map((i) => `${line(t)} (${t.status}): ${i.problem} (cần ${i.need})`)),
    ];
    const nhan = mine.filter((t) => t.status === 'chờ anh nhận');
    const cho = mine.filter((t) => t.status !== 'xong' && t.status !== 'huỷ').flatMap((t) => t.after
      .map((a) => getTicket(a, { env })).filter((a) => a && a.status !== 'xong')
      .map((a) => `${line(t)} chờ ${line(a)} (${a.department ?? 'chưa giao'})`));
    if (!xong.length && !lam.length && !vuong.length && !cho.length && !nhan.length) continue;
    out.push(`## ${d.title} (${d.name})`, '');
    const list = (h, xs) => out.push(`- ${h}: ${xs.length ? '' : 'không'}`, ...xs.map((x) => `  - ${x}`));
    list(kind === 'tuan' ? 'Tuần qua xong' : 'Hôm qua xong', xong.map(line));
    list('Đang làm', lam.map(line));
    list('Vướng', vuong);
    list('Chờ phòng khác', cho);
    if (nhan.length) list('Chờ anh nhận (thử việc, không phải vướng)', nhan.map(line));
    out.push('');
  }
  if (out.length === 2) out.push('Không phòng nào có việc trong kỳ.', '');
  if (warnings.length) out.push('## Cảnh báo sổ phòng ban', '', ...warnings.map((w) => `- ${w}`), '');
  if (kind === 'tuan') {
    const home = env.HOME || os.homedir(), c = companyDir({ env });
    out.push('## Báo cáo các ban', '');
    for (const [ten, dir] of [['Ban Cố vấn', path.join(home, 'company', 'co-van')], ['Phòng An ninh', path.join(c, 'an-ninh')],
      ['Phòng Nhân sự', path.join(c, 'nhan-su')], ['Bản tin học hỏi', path.join(home, 'company', 'nghien-cuu', 'hoc-hoi')]])
      out.push(`- ${ten}: ${newest(dir) ?? 'chưa có'}`);
    out.push('', '## Chi phí AI tuần', '', chiPhi ?? 'chưa có số liệu', '');
  }
  return out.join('\n');
}

/** Chi phí AI tuần qua (văn bản của chi-phi.mjs tuan), hoặc null khi không chạy được. */
function chiPhiTuan(env) {
  const r = spawnSync(process.execPath, [path.join(import.meta.dirname, 'chi-phi.mjs'), 'tuan'], { env, encoding: 'utf8', timeout: 10 * 60_000, maxBuffer: 16 * 1024 * 1024 });
  return r.status === 0 && r.stdout.trim() ? r.stdout.trim() : null;
}

export function writeAgenda(kind, { env = process.env, now = new Date(), chiPhi } = {}) {
  const dir = path.join(companyDir({ env }), 'hop');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${dayOf(now)}-${kind}-chuong-trinh.md`);
  fs.writeFileSync(file, agenda(kind, { env, now, chiPhi: chiPhi === undefined && kind === 'tuan' ? chiPhiTuan(env) : chiPhi }));
  return { file, bienBan: path.join(dir, `${dayOf(now)}${kind === 'tuan' ? '-tuan' : ''}.md`) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [kind, ...rest] = process.argv.slice(2);
  const i = rest.indexOf('--ngay');
  try {
    const now = i >= 0 ? new Date(`${rest[i + 1]}T06:00:00`) : new Date();
    if (Number.isNaN(+now)) throw new Error('--ngay YYYY-MM-DD');
    console.log(JSON.stringify(writeAgenda(kind, { now })));
  } catch (e) { console.error(e.message); process.exit(1); }
}
