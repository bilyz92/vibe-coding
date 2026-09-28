# Auto-upgrade — backlog (việc hoãn, đọc ở bước 1 mỗi vòng)

## [PENDING] Consolidate discipline-skills sau khi dùng Superpowers

**Ghi:** 2026-07-02. **Trigger:** sau khi đã dùng Superpowers thật ≥3 task.

**Bối cảnh:** đang có 3 nguồn kỷ luật CHỒNG NHAU (TDD/plan/verify/review):
- Skill tự viết: `dev-workflow`, `codex-pair-dev`
- Plugin `superpowers` (test-driven-development, writing-plans, verification-before-completion, subagent-driven-development...)
- (chưa cài) `addyosmani/agent-skills`

**Việc cần đề xuất (KHÔNG tự xoá — báo report cho user duyệt):**
1. Đánh giá Superpowers có phủ đủ `dev-workflow` không → nếu có, đề xuất GỠ `dev-workflow` (giữ `codex-pair-dev` vì phần Codex là độc quyền).
2. Cherry-pick 2-3 skill lấp gap từ addyosmani: `documentation-and-adrs` (ADR), `deprecation-and-migration` (hợp Prisma), có thể `incremental-implementation`. KHÔNG cài cả 24.
3. Kết quả: 1 bộ discipline chính (nhiều khả năng Superpowers) + Codex review + vài skill bù gap. "Ít mà tinh".

**Nguyên tắc:** gỡ/gộp skill là destructive → luôn đề xuất qua report + chờ user OK, rồi mới thực hiện (có commit riêng để rollback).
