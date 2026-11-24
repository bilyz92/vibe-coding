<!-- codex-auto-review-start -->

## Codex Review — Auto-review Guidance

When the user is working on code changes, **proactively suggest** the appropriate codex-review skill based on context:

| Context | Suggested Skill | Trigger | Note |
|---------|----------------|---------|------|
| Uncommitted changes (staged/unstaged) | `/codex-impl-review` | Before committing | Auto-run, don't ask |
| Feature branch with commits | `/codex-pr-review` | Before creating/merging PR | |
| Plan/design document created or modified | `/codex-plan-review` | After writing plan | |
| Auth, SQL, crypto, secrets, user input code | `/codex-security-review` | When security-sensitive code detected | Requires `-full` |
| Large codebase (50+ files) needing review | `/codex-codebase-review` | On request for full review | Requires `-full` |
| Recent commits before push | `/codex-commit-review` | After committing, before push | |
| Technical question or architecture debate | `/codex-think-about` | On design discussions | |

**Rules:**
- **Exception — `/codex-impl-review`: run it automatically, without asking**, on every code change before committing: fix valid findings, dispute invalid ones, loop to APPROVE, then commit
- All other review skills: ask the user before running — never auto-run without confirmation
- Phrase those as a suggestion: "Would you like me to run `/codex-pr-review` before merging?"
- Only suggest when context clearly matches — do not over-suggest

<!-- codex-auto-review-end -->

## Auto-merge MR/PR — mọi dự án

User không muốn tự bấm merge. Sau khi `/codex-impl-review` APPROVE + `/codex-commit-review` CONSENSUS, push và tạo MR/PR thì **bật auto-merge luôn**:
- GitLab: `glab mr merge <id> --auto-merge -y`. **Cảnh báo:** lệnh này KHÔNG đảm bảo chờ pipeline — 2026-10-31 nó merge ngay khi pipeline MR còn `pending` (project tắt "Pipelines must succeed"). Nên đợi pipeline MR xanh rồi mới chạy, trừ khi project đã bật tùy chọn đó.
- GitHub: `gh pr merge <n> --auto --merge` (cần repo bật "Allow auto-merge").
- Ngoại lệ: khi thứ tự merge quan trọng (vd MR release mà một MR khác phải deploy trước) thì chờ tới lúc an toàn mới bật, và nói rõ lý do.
- Nếu lệnh merge bị chặn (permission/classifier) → báo user và gửi link MR/PR để họ bấm.

## Tự chủ — mọi dự án

Rút từ lịch sử chat tháng 10/2026: user phải gõ "tiếp tục" ~730 lần, hỏi "xong hết chưa / còn task nào" ~250 lần, nhắc "bạn tự làm đi" ~45 lần.
- **Plan đã duyệt → chạy hết**, không hỏi "tiếp tục không?". Chỉ dừng khi: cần quyết định nghiệp vụ, thao tác phá huỷ / không đảo ngược được, hoặc cần secret mà chưa có.
- **Có quyền thì tự chạy** (ssh, CLI, test, push, deploy, terraform plan…), không đưa lệnh bắt user chạy hộ. Thao tác ra ngoài / không đảo ngược vẫn theo quy tắc xác nhận như cũ.
- **Kiểm hiện trạng trước khi kết luận** "chưa có / cần làm": grep code, đọc production/DB/log trước.
- **Cuối mỗi chặng**: bảng ngắn Xong / Đang làm / Chờ anh / Chờ đối tác (ghi cả vào `PROGRESS.md` của repo nếu có).
- **Trả lời tiếng Việt, ngắn, dễ hiểu**; thuật ngữ thì giải thích một dòng.
- Codex hết quota: theo mục "Codex out of quota" trong `references/protocol.md` của các skill `/codex-*` (ghi nợ vào `PROGRESS.md`, làm việc khác, tự chạy lại khi có quota).

<!-- karpathy-guidelines-start -->

## Karpathy Guidelines — Coding Behavior

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

<!-- karpathy-guidelines-end -->

## DESIGN.md — Design system cho UI

Khi build/sửa giao diện: tìm `DESIGN.md` (format google-labs-code/design.md) ở root/thư mục app TRƯỚC khi code. Có → đọc trọn, bám token (màu/font/radius/spacing) + prose/Do's-Don'ts, không chế giá trị ngoài file. Sửa `DESIGN.md` → `npx -y @google/design.md lint DESIGN.md` + `diff` với bản cũ. Chưa có → chỉ đề xuất tạo, không tự tạo. Chi tiết: mục UI của agent `coding`.

## Tài liệu — tạo file trên máy, mọi dự án

Tài liệu luôn tạo thành file trên máy theo skill `local-docs` (mặc định `docs/<ten-tai-lieu>.md`), kể cả khi user chỉ nói "tạo docs" hay "làm file mới". Chỉ dùng Claude Docs hoặc artifact khi user nói rõ.
