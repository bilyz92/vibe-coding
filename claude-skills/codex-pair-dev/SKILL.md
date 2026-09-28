---
name: codex-pair-dev
description: Vòng lặp pair-programming Claude ↔ Codex cho một task code từ đầu đến commit. Codex phân tích yêu cầu → Claude lên plan → Codex phản biện plan → Claude code → Claude test → Codex verify → Claude check lại → commit. Dùng khi muốn làm một task code có Codex review đối kháng ở cả khâu phân tích, plan và implementation, kèm bước test riêng trước khi commit.
---

# Codex Pair Dev — vòng lặp Claude ↔ Codex

Điều phối một task code đi qua đủ các chốt review đối kháng với Codex. Skill này KHÔNG tự gọi `codex` CLI — nó gọi các skill `codex-*` sẵn có (chúng quản lý session/runner). Bổ trợ cho [[dev-workflow]] (bản solo) và tuân theo kỷ luật verification trong CLAUDE.md project.

## When to Use

- Task code đủ quan trọng để cần Codex phản biện ở cả phân tích, plan và code.
- Muốn một quy trình có "second opinion" độc lập trước khi commit.

Task nhỏ/rõ ràng → dùng [[dev-workflow]] cho nhẹ. Chỉ cần review code đã viết → gọi thẳng `/codex-impl-review`.

## Prerequisites

- `codex` CLI cài sẵn (kiểm tra: `command -v codex`). Thiếu → báo user cài.
- Các skill có sẵn: `codex-think-about`, `codex-plan-review`, `codex-impl-review`.

## Process

1. **Nhận task** → verify: tóm tắt lại yêu cầu bằng 1–2 câu; nêu giả định; hỏi nếu mơ hồ.
2. **Codex phân tích yêu cầu** → invoke `/codex-think-about` với câu hỏi "yêu cầu này thực chất đòi gì, edge case/rủi ro nào?". Verify: có kết luận đồng thuận hoặc bất đồng được ghi rõ.
3. **Rà soát phạm vi ảnh hưởng** → grep toàn repo tìm MỌI nơi dùng logic/symbol sẽ đổi; liệt kê call-site + màn hình/route, phân biệt cái giống-tên-khác-nghĩa. Verify: danh sách đầy đủ nơi phải sửa đồng bộ, không sót; ghi vào plan để review cùng.
4. **Claude lên Plan** → dùng Plan agent, ghi ra `plan.md` (có headings: Goals, Steps, Impact/nơi phải đổi đồng bộ, Acceptance). Verify: plan có tiêu chí nghiệm thu kiểm chứng được.
5. **Codex check & phản biện plan** → invoke `/codex-plan-review` trên `plan.md`. Verify: chạy tới khi APPROVE hoặc stalemate; sửa các điểm Codex nêu hợp lý vào plan, phản biện điểm sai.
6. **Claude code** → implement surgical theo plan, sửa ĐỒNG BỘ mọi call-site ở bước 3; áp [[clean-code]] cho code mới (tên/hàm/trùng lặp/pattern đúng chỗ). Verify: lint + typecheck + build pass, có output.
7. **Test** → viết test bám theo Acceptance của plan: bug fix có test tái hiện (fail-trước/pass-sau); feature có test cho happy path + edge case. Chạy test liên quan + regression suite quanh vùng sửa. Verify: test pass, có output; test mới đã chứng minh fail được trước khi sửa.
8. **Codex verify** → invoke `/codex-impl-review` trên diff chưa commit. Verify: Codex đã review xong, findings được liệt kê.
9. **Claude check lại** → với mỗi finding: sửa nếu đúng, phản biện nếu sai; lặp tới consensus/stalemate. Verify: chạy lại test sau mỗi sửa.
10. **Commit** → khi được yêu cầu / đã đồng thuận. Verify: message theo Conventional Commits; nếu ở branch mặc định thì tạo branch trước; chỉ commit khi test xanh.

## Rationalizations — các cớ cần phản bác

| Cái cớ | Phản bác |
|--------|----------|
| "Bỏ bước 2, vào plan luôn" | Phân tích sai từ gốc thì plan và code sai theo; Codex bắt lỗi yêu cầu sớm rẻ hơn nhiều. |
| "Plan trong đầu là đủ, khỏi viết file" | `/codex-plan-review` cần file .md để phản biện; plan ngầm không kiểm chứng được. |
| "Codex bảo sửa nhưng nó nhầm, cứ sửa cho xong" | Phản biện điểm sai là một phần của quy trình; sửa mù làm hỏng code đúng. |
| "Test xanh sẵn rồi, khỏi chạy lại sau khi sửa" | Mỗi lần sửa theo finding là một thay đổi mới chưa được verify. |
| "Skip Codex verify, code rõ ràng mà" | Bỏ second opinion là bỏ chính giá trị của skill này. |

## Red Flags — dừng lại

- Vào bước Plan/Code mà bỏ qua bước Codex phân tích yêu cầu.
- `/codex-plan-review` hoặc `/codex-impl-review` thoát khi chưa APPROVE/stalemate.
- Sửa theo finding của Codex mà không hiểu/không đồng ý (sửa mù).
- Commit khi còn finding chưa giải quyết hoặc test chưa xanh.
- Nói "đã xong" mà không có output test/build.

## Verification checklist

- [ ] Yêu cầu đã tóm tắt + giả định nêu rõ.
- [ ] Codex đã phân tích yêu cầu (`/codex-think-about`) — có kết luận.
- [ ] `plan.md` có Goals/Steps/Acceptance kiểm chứng được.
- [ ] `/codex-plan-review` chạy tới APPROVE/stalemate; plan đã cập nhật.
- [ ] Code surgical, đúng plan.
- [ ] Có test bám Acceptance: bug fix có test tái hiện (fail-trước/pass-sau); feature có happy path + edge case.
- [ ] Lint/typecheck/build/test pass — có output.
- [ ] `/codex-impl-review` chạy xong; mọi finding đã sửa hoặc phản biện.
- [ ] Commit theo Conventional Commits, test xanh, đúng branch.
