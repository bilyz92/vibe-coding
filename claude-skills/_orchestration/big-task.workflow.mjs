export const meta = {
  name: 'big-task',
  description: 'Task lớn → planner phân rã → fan-out coding song song theo làn phụ thuộc → verify từng mảnh → tổng hợp',
  phases: [
    { title: 'Phân rã', detail: 'agent planner chia task thành mảnh độc lập (disjoint file)' },
    { title: 'Thực thi', detail: 'mỗi mảnh 1 agent coding, chạy song song theo làn phụ thuộc' },
    { title: 'Verify', detail: 'review đối kháng từng mảnh' },
  ],
}

// args = chuỗi mô tả task lớn (bắt buộc). Chạy:
//   Workflow({ scriptPath: '~/.claude/skills/_orchestration/big-task.workflow.mjs', args: 'mô tả task...' })
const TASK = typeof args === 'string' ? args : (args && args.task) || ''
if (!TASK) { log('Thiếu args: cần chuỗi mô tả task lớn.'); return { error: 'no task' } }

const DECOMP_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          files: { type: 'array', items: { type: 'string' } },
          acceptance: { type: 'string' },
          dependsOn: { type: 'array', items: { type: 'string' } },
          risk: { type: 'string' },
        },
        required: ['id', 'title', 'files', 'acceptance', 'dependsOn'],
      },
    },
    note: { type: 'string' },
  },
  required: ['items'],
}

const RESULT_SCHEMA = {
  type: 'object',
  properties: {
    itemId: { type: 'string' },
    summary: { type: 'string' },
    filesChanged: { type: 'array', items: { type: 'string' } },
    evidence: { type: 'string' }, // output test/typecheck
    done: { type: 'boolean' },
  },
  required: ['summary', 'done'],
}

const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    ok: { type: 'boolean' },
    issues: { type: 'array', items: { type: 'string' } },
  },
  required: ['ok'],
}

// ---- Phase 1: Phân rã ----
phase('Phân rã')
const decomp = await agent(
  `Phân rã task lớn sau thành các mảnh việc ĐỘC LẬP (tập file disjoint để chạy song song). ` +
  `Ghi rõ dependsOn cho phần nền dùng chung. TASK:\n\n${TASK}`,
  { agentType: 'planner', phase: 'Phân rã', schema: DECOMP_SCHEMA },
)
const items = (decomp && decomp.items) || []
if (!items.length) { log('Planner không chia được mảnh nào.'); return { decomp } }
log(`Phân rã thành ${items.length} mảnh.`)

// ---- Phase 2+3: chạy theo LÀN phụ thuộc, mỗi mảnh code → verify ----
async function runItem(it) {
  const impl = await agent(
    `Thực thi MẢNH VIỆC này theo kỷ luật coding (TDD, impact-sweep trong phạm vi mảnh, verify bằng bằng chứng). ` +
    `Chỉ sửa các file: ${JSON.stringify(it.files || [])}. ` +
    `Tiêu chí nghiệm thu: ${it.acceptance}. ` +
    `Bối cảnh task tổng: ${TASK}\n\nMẢNH: ${JSON.stringify(it)}`,
    { agentType: 'coding', phase: 'Thực thi', label: `code:${it.id}`, schema: RESULT_SCHEMA },
  )
  const verdict = await agent(
    `Review đối kháng mảnh "${it.title}". Chỉ thấy: tiêu chí nghiệm thu + tóm tắt thay đổi + bằng chứng. ` +
    `Có đạt acceptance không? Có sót call-site / thiếu test / chạm file ngoài phạm vi (${JSON.stringify(it.files || [])}) không? ` +
    `Mặc định ok=false nếu thiếu bằng chứng.\n\nACCEPTANCE: ${it.acceptance}\nKẾT QUẢ: ${JSON.stringify(impl)}`,
    { phase: 'Verify', label: `verify:${it.id}`, schema: VERDICT_SCHEMA },
  )
  return { item: it, impl, verdict }
}

const done = new Set()
const results = []
let remaining = items.slice()
let guard = 0
while (remaining.length && guard++ <= items.length + 1) {
  const ready = remaining.filter((it) => (it.dependsOn || []).every((d) => done.has(d)))
  if (!ready.length) {
    log(`⚠️ Còn ${remaining.length} mảnh có phụ thuộc không giải được (vòng lặp?). Dừng an toàn.`)
    break
  }
  log(`Làn: chạy song song ${ready.length} mảnh [${ready.map((r) => r.id).join(', ')}]`)
  const waveRes = (await parallel(ready.map((it) => () => runItem(it)))).filter(Boolean)
  waveRes.forEach((r) => { done.add(r.item.id); results.push(r) })
  remaining = remaining.filter((it) => !ready.some((r) => r.id === it.id))
}

// ---- Tổng hợp ----
const ok = results.filter((r) => r.verdict && r.verdict.ok)
const failed = results.filter((r) => !r.verdict || !r.verdict.ok)
const skipped = remaining
log(`Xong: ${ok.length} đạt / ${failed.length} cần sửa / ${skipped.length} chưa chạy.`)

return {
  task: TASK,
  totalItems: items.length,
  passed: ok.map((r) => ({ id: r.item.id, title: r.item.title, files: r.impl?.filesChanged, evidence: r.impl?.evidence })),
  needsFix: failed.map((r) => ({ id: r.item.id, title: r.item.title, issues: r.verdict?.issues || ['thiếu bằng chứng'] })),
  notRun: skipped.map((it) => ({ id: it.id, title: it.title, dependsOn: it.dependsOn })),
  note: 'Các agent coding sửa trên cùng working tree (planner đảm bảo disjoint file). Chạy full test + review Codex ở phiên chính trước khi commit.',
}
