# Domain: eval chất lượng code output

Nạp khi muốn chấm chất lượng code do agent (hoặc phiên bản skill khác nhau) sinh ra, theo tiêu chí lặp lại được — khác với review một lần, đây là đo có so sánh.

## Dataset
Mỗi ca = một **yêu cầu code** đủ cụ thể (task + ràng buộc + tiêu chí đạt), lý tưởng là có sẵn test hoặc mô tả hành vi đúng. Phủ: task điển hình của dự án, task có ca biên (input sai, lỗi, rỗng), task dễ dẫn tới over-engineering.

## Baseline
Phiên bản trước của agent/skill/prompt sinh code, hoặc agent trần không có skill. Chạy cùng yêu cầu.

## Grader — kết hợp 2 tầng
**Tầng khách quan (rule-based, ưu tiên):**
- **Đúng chức năng**: chạy test có sẵn / viết test cho ca → pass/fail. Đây là thước nặng nhất.
- **Build/typecheck/lint sạch**: chạy thật, lấy output (đúng tinh thần [[dev-workflow]] verify bằng bằng chứng).
- **Số đo cứng**: số dòng thay đổi (diff to bất thường = nghi over-engineer/lan man), có/không có test kèm.

**Tầng chủ quan (LLM-judge kèm rubric [[clean-code]]):**
- Đúng phạm vi (chỉ làm cái được yêu cầu, không thêm abstraction/flexibility thừa)?
- Surgical (không refactor lan man, khớp style xung quanh)?
- Tên rõ, hàm nhỏ một-việc, xử lý lỗi tường minh, không trùng lặp?
- Có test tương ứng, bug fix có test tái hiện?

Cho rubric thang 1–5 mỗi tiêu chí, judge nêu lý do trước điểm sau, chấm mù (không biết bản nào của ai).

## Kết luận
Ưu tiên tầng khách quan: code "đẹp" mà fail test là trượt. Trong số các bản pass test, dùng điểm rubric để so chất lượng. Báo cả ca regress (bản trước pass test, bản mới fail) — đây là tín hiệu thay đổi làm hỏng hành vi.
