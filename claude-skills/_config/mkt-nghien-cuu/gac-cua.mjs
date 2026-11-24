#!/usr/bin/env node
// Hook PreToolUse, PostToolUse của vai mkt-nghien-cuu. Sandbox của Claude Code chỉ bọc Bash và chỉ theo phiên, nên phần còn
// lại kiểm ở đây. Ba chế độ tách nguồn lạ khỏi dữ liệu công ty, để trang độc không có đường đọc rồi gửi dữ liệu đi:
//   offline (mặc định): có Bash và dữ liệu công ty, không có web, Chrome;
//   web: WebSearch, WebFetch, chỉ thấy thư mục web-tho, không Bash;
//   chrome: như web nhưng đọc trang anh ghi trong trang-cho-phep.txt, không WebFetch, WebSearch.
// Web không vào IP hay mạng nội bộ. Chrome kiểm URL trước khi mở và URL thật của tab sau mỗi lần đọc. Lỗi bất ngờ: agent
// chạy hook với `|| exit 2` nên vẫn chặn. Chỉ dùng node:*.
import dns from 'node:dns/promises';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

const HOME = os.homedir();
const MKT = path.join(HOME, 'company', 'marketing');
const SKILLS = path.resolve(import.meta.dirname, '..', '..');
const WEB = path.join(MKT, 'web-tho');   // (phiên web ghi, offline chỉ đọc: dữ liệu công ty không có đường quay lại đây)
const OFFLINE_VIET = [path.join(MKT, 'nghien-cuu'), path.join(MKT, 'quang-cao', 'ra')];
const OFFLINE_DOC = [...OFFLINE_VIET, path.join(MKT, 'SU-THAT-DA-XAC-NHAN.md'), path.join(MKT, 'quang-cao'), WEB,
  path.join(HOME, 'company', 'tri-thuc'), path.join(SKILLS, 'mkt-nghien-cuu-fb')];
const WEB_DOC = [WEB, path.join(SKILLS, 'mkt-nghien-cuu-fb')];
const TRANG = path.join(MKT, 'trang-cho-phep.txt');
const TAB = path.join(MKT, '.tab-da-kiem.json');   // (ngoài vùng ghi của vai: tab nào đã mở trang được phép, theo phiên)
const CHROME = 'mcp__claude-in-chrome__';
const CHUNG = ['Read', 'Write', 'Glob', 'Grep', 'ToolSearch'];
const DOC_TAB = ['get_page_text', 'read_page', 'find'].map((x) => CHROME + x);
const CHE_DO = {
  offline: { tools: [...CHUNG, 'Bash'], doc: OFFLINE_DOC, viet: OFFLINE_VIET },
  web: { tools: [...CHUNG, 'WebSearch', 'WebFetch'], doc: WEB_DOC, viet: [WEB] },
  chrome: { tools: [...CHUNG, ...DOC_TAB, ...['tabs_context_mcp', 'tabs_create_mcp', 'tabs_close_mcp', 'navigate'].map((x) => CHROME + x)], doc: WEB_DOC, viet: [WEB] },
};
const cheDo = () => CHE_DO[['web', 'chrome'].includes(process.env.MKT_NGHIEN_CUU_CHE_DO) ? process.env.MKT_NGHIEN_CUU_CHE_DO : 'offline'];
const NOI_BO = new net.BlockList();
for (const [a, n] of [['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24],
  ['192.168.0.0', 16], ['198.18.0.0', 15], ['224.0.0.0', 4], ['240.0.0.0', 4]]) NOI_BO.addSubnet(a, n, 'ipv4');
for (const [a, n] of [['::', 128], ['::1', 128], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8]]) NOI_BO.addSubnet(a, n, 'ipv6');

class Chan extends Error {}
const chan = (why) => { throw new Chan(why); };
const bao = (p, r) => p === r || p.startsWith(r + path.sep);

/** Đường dẫn thật: đi theo link của phần đã tồn tại, phần chưa có giữ nguyên. */
function that(p, cwd) {
  const abs = path.resolve(cwd, p === '~' ? HOME : p.startsWith('~/') ? path.join(HOME, p.slice(2)) : p);
  const duoi = [];
  for (let x = abs; ; x = path.dirname(x)) {
    try { return path.join(fs.realpathSync(x), ...duoi); } catch (e) {
      // (chỉ "chưa tồn tại" mới đi lên thư mục cha; link treo và lỗi khác thì chặn)
      if (e.code !== 'ENOENT' || fs.lstatSync(x, { throwIfNoEntry: false })) chan(`không xác định được đường dẫn thật: ${abs}`);
    }
    if (x === path.dirname(x)) chan(`không xác định được đường dẫn thật: ${abs}`);
    duoi.unshift(path.basename(x));
  }
}
function trongVung(p, cwd, vung, viec) {
  const t = that(String(p), cwd);
  if (!vung.some((r) => bao(t, that(r, cwd)))) chan(`${viec} ngoài vùng cho phép: ${t}`);
}
const mauAnToan = (g) => { if (g && (/^[/~]/.test(g) || g.includes('..'))) chan(`mẫu tìm ra ngoài thư mục: ${g}`); };

function urlHttps(raw) {
  let u;
  try { u = new URL(String(raw)); } catch { chan(`URL không hợp lệ: ${raw}`); }
  if (u.protocol !== 'https:') chan(`chỉ nhận https: ${raw}`);
  if (u.username || u.password) chan(`URL có tài khoản: ${raw}`);
  return u;
}
async function webCongKhai(raw) {
  const h = urlHttps(raw).hostname.toLowerCase().replace(/\.$/, '');
  if (!h.includes('.') || h.startsWith('[') || /^\d+(\.\d+){3}$/.test(h) || /\.(local|localhost|internal|intranet|lan|home|corp)$/.test(h))
    chan(`không tải IP hay mạng nội bộ: ${h}`);
  let ips;
  try { ips = await dns.lookup(h, { all: true }); } catch { chan(`không phân giải được: ${h}`); }
  const xau = ips.find((ip) => NOI_BO.check(ip.address, ip.family === 6 ? 'ipv6' : 'ipv4'));
  if (xau) chan(`${h} trỏ vào mạng nội bộ: ${xau.address}`);
}
/** URL có nằm trong danh sách anh ghi không. */
function khopDanhSach(raw) {
  let u; try { u = urlHttps(raw); } catch { return false; }
  let dong = [];
  try { dong = fs.readFileSync(TRANG, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')); } catch { /* chưa có file: không trang nào được mở */ }
  return dong.some((l) => {
    let g; try { g = urlHttps(l); } catch { return false; }
    const goc = g.pathname.replace(/\/$/, '');
    return u.origin === g.origin && (u.pathname === goc || u.pathname.startsWith(`${goc}/`));
  });
}

// (tabs: đang ở trang được phép, đọc được; mo: phiên này đã mở, đóng được kể cả khi tab đã rời danh sách)
const trangThaiTab = (phien) => { try { const s = JSON.parse(fs.readFileSync(TAB, 'utf8')); if (s.phien === phien) return s; } catch { /* chưa có */ } return { tabs: [], mo: [] }; };
const tabDaKiem = (phien) => trangThaiTab(phien).tabs;
const luuTab = (phien, tabs, mo) => fs.writeFileSync(TAB, JSON.stringify({ phien, tabs: [...new Set(tabs)], mo: [...new Set(mo)] }));

async function kiem({ tool_name: tool, tool_input: i = {}, cwd = process.cwd(), session_id: phien }) {
  if (process.env.MKT_NGHIEN_CUU_SANDBOX !== '1') chan('vai này chỉ chạy trong phiên sandbox: anh mở bằng _config/mkt-nghien-cuu/phien.sh');
  if (fs.lstatSync(WEB, { throwIfNoEntry: false })?.isSymbolicLink()) chan(`${WEB} là symlink`);
  const { tools, doc, viet } = cheDo();
  if (!tools.includes(tool)) chan(`tool không dùng được ở chế độ này: ${tool}`);
  if (tool === 'Bash') { if (i.dangerouslyDisableSandbox) chan('không chạy ngoài sandbox'); return; }
  if (tool === 'Read') return trongVung(i.file_path, cwd, doc, 'đọc');
  if (tool === 'Write') return trongVung(i.file_path, cwd, viet, 'ghi');
  if (tool === 'Glob' || tool === 'Grep') {
    trongVung(i.path ?? cwd, cwd, doc, 'tìm');
    mauAnToan(tool === 'Glob' ? i.pattern : i.glob);
    return;
  }
  if (tool === 'WebFetch') return webCongKhai(i.url);
  if (tool === `${CHROME}navigate`) {
    if (!Number.isInteger(i.tabId)) chan('navigate phải ghi tabId của tab vừa tạo bằng tabs_create_mcp');
    await webCongKhai(i.url);
    if (!khopDanhSach(i.url)) chan(`trang chưa có trong ${TRANG}: ${i.url}. Anh thêm dòng vào file đó nếu cho phép`);
    return;
  }
  if (tool === `${CHROME}tabs_create_mcp` && i.url) chan('tabs_create_mcp không được mở URL, dùng navigate');
  if (DOC_TAB.includes(tool) && !tabDaKiem(phien).includes(i.tabId)) chan(`tab ${i.tabId} chưa mở trang được phép trong phiên này`);
  if (tool === `${CHROME}tabs_close_mcp` && !trangThaiTab(phien).mo.includes(i.tabId)) chan(`tab ${i.tabId} không do phiên này mở`);
}

/** URL thật của tab, lấy ở khối "Tab Context" do extension thêm (nội dung trang là khối khác, không giả được khối này). */
function urlCuaTab(ketQua, tabId) {
  const khoi = Array.isArray(ketQua) ? ketQua.map((k) => k?.text ?? '').filter((x) => x.startsWith('\n\nTab Context:')).at(-1) : null;
  return new RegExp(`^\\s*• tabId ${tabId}: .*\\("([^"\n]*)"\\)$`, 'm').exec(khoi ?? '')?.[1];
}

/** PostToolUse của Chrome: tab chỉ được đọc khi URL thật vẫn trong danh sách; rời danh sách thì bỏ tab và thay kết quả. */
async function sauChrome({ tool_name: tool, tool_input: i = {}, tool_response: ketQua, session_id: phien }) {
  const { tabs, mo } = trangThaiTab(phien), khac = tabs.filter((t) => t !== i.tabId);
  if (tool === `${CHROME}tabs_close_mcp`) return luuTab(phien, khac, mo.filter((t) => t !== i.tabId));
  const moi = tool === `${CHROME}navigate` ? [...mo, i.tabId] : mo;
  const url = urlCuaTab(ketQua, i.tabId);
  if (khopDanhSach(url) && await webCongKhai(url).then(() => true, () => false)) return luuTab(phien, tool === `${CHROME}navigate` ? [...tabs, i.tabId] : tabs, moi);
  luuTab(phien, khac, moi);
  console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolUse',
    updatedToolOutput: [{ type: 'text', text: 'Chặn: tab đã rời trang được phép, nội dung bị bỏ. Dừng và báo anh.' }] } }));
}

try {
  const vao = JSON.parse(fs.readFileSync(0, 'utf8'));
  if (vao.hook_event_name === 'PostToolUse') await sauChrome(vao); else await kiem(vao);
} catch (e) {
  console.error(e instanceof Chan ? `Chặn: ${e.message}` : `Chặn: lỗi kiểm: ${e.message}`);
  process.exit(2);
}
