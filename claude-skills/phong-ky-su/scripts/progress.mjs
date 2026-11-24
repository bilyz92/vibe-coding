#!/usr/bin/env node
// Phòng Kỹ sư phần mềm: the stage report and the lessons in a repo's PROGRESS.md. Each owns its own "## " section and
// leaves every other one (e.g. "## Chờ Codex review") as it is. Writes go through codex-review's editProgress (the
// same lock and atomic write as the owed reviews), so agents working side by side lose nothing. Node stdlib only.
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { editProgress } from '../../codex-review/scripts/progress-lock.mjs';

const REPORT = '## Báo cáo chặng', LESSONS = '## Bài học';
const stamp = (d) => d.toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
const oneLine = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const edit = editProgress;   // (the lock shared with codex-runner's owed reviews)

/** The lines of a "## " section (heading excluded), and where it sits; -1 when absent. */
function section(lines, heading) {
  const start = lines.indexOf(heading);
  if (start < 0) return { start: -1, end: -1 };
  let end = start + 1;
  while (end < lines.length && !/^## /.test(lines[end])) end++;
  return { start, end };
}

/** Replaces the "## Báo cáo chặng" section with this report. */
export function writeStageReport(repoDir, { task, done = [], doing = [], waitingUser = [], waitingPartner = [], at = new Date() }) {
  const list = (xs) => (xs.length ? xs.map((x) => `- ${oneLine(x)}`) : ['- (không có)']);
  const block = [REPORT, '', `Việc: ${oneLine(task)} · ${stamp(at)}`, '',
    '### Xong', '', ...list(done), '', '### Đang làm', '', ...list(doing), '',
    '### Chờ anh', '', ...list(waitingUser), '', '### Chờ đối tác', '', ...list(waitingPartner), ''];
  edit(repoDir, (text) => {
    const lines = text.replace(/\n*$/, '').split('\n'), { start, end } = section(lines, REPORT);
    if (start >= 0) lines.splice(start, end - start, ...block); else lines.push('', ...block);
    return lines.join('\n');
  });
}

/** Adds a lesson to "## Bài học", unless the same lesson is already there. */
export function addLesson(repoDir, { task, lesson, proposal, at = new Date() }) {
  const text = oneLine(lesson);
  if (!text) return;
  const line = `- ${stamp(at)} · ${oneLine(task)} · ${text}${proposal ? ` → đề xuất: ${oneLine(proposal)}` : ''}`;
  edit(repoDir, (doc) => {
    const lines = doc.replace(/\n*$/, '').split('\n');
    let { start, end } = section(lines, LESSONS);
    // (the same lesson: the whole text, not a longer one it begins — "bài học số 1" is not "bài học số 10")
    if (start >= 0 && lines.slice(start + 1, end).some((l) => l.endsWith(` · ${text}`) || l.includes(` · ${text} → đề xuất: `))) return doc;
    if (start < 0) { lines.push('', LESSONS, ''); start = lines.length - 2; end = lines.length; }
    while (end > start + 1 && lines[end - 1].trim() === '') end--;
    lines.splice(end, 0, line);
    return lines.join('\n');
  });
}

/** Whether "## Bài học" holds a line for this task: its id is in the line. */
export function hasLesson(repoDir, id) {
  let text = '';
  try { text = fs.readFileSync(path.join(repoDir, 'PROGRESS.md'), 'utf8'); } catch { return false; }
  const lines = text.split('\n'), { start, end } = section(lines, LESSONS);
  return start >= 0 && lines.slice(start + 1, end).some((l) => l.startsWith('- ') && l.includes(id));
}

// CLI: report <repoDir> --task T --done a --doing b --wait-user c --wait-partner d | lesson <repoDir> --task T --lesson L [--proposal P]
// or either one with --json <file> ({ task, done, doing, waitingUser, waitingPartner } | { task, lesson, proposal }):
// text written to a file never passes through the shell, so quotes, backticks and $ in it stay as they are.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [op, repoDir, ...rest] = process.argv.slice(2);
  const { values: v } = parseArgs({ args: rest, strict: false, options: {
    task: { type: 'string' }, done: { type: 'string', multiple: true }, doing: { type: 'string', multiple: true },
    'wait-user': { type: 'string', multiple: true }, 'wait-partner': { type: 'string', multiple: true },
    lesson: { type: 'string' }, proposal: { type: 'string' }, json: { type: 'string' } } });
  if (!repoDir || !fs.existsSync(repoDir)) { console.error('Cần thư mục repo có thật.'); process.exit(1); }
  const j = v.json ? JSON.parse(fs.readFileSync(v.json, 'utf8')) : null;
  if (j && op === 'report') writeStageReport(repoDir, { task: j.task, done: j.done || [], doing: j.doing || [], waitingUser: j.waitingUser || [], waitingPartner: j.waitingPartner || [] });
  else if (j && op === 'lesson') addLesson(repoDir, { task: j.task, lesson: j.lesson, proposal: j.proposal });
  else if (op === 'report') writeStageReport(repoDir, { task: v.task, done: v.done || [], doing: v.doing || [], waitingUser: v['wait-user'] || [], waitingPartner: v['wait-partner'] || [] });
  else if (op === 'lesson') addLesson(repoDir, { task: v.task, lesson: v.lesson, proposal: v.proposal });
  else { console.error('Dùng: progress.mjs report|lesson <repoDir> …'); process.exit(1); }
}
