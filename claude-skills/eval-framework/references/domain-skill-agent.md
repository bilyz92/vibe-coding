# Domain: eval skill/agent của mình

Nạp khi đánh giá một skill hoặc subagent Claude Code (đã nâng cấp và muốn chứng minh tốt lên). Gắn với [[auto-upgrade-skill-loop]] và [[self-upgrade-principle]].

## Dataset
Mỗi ca = một **prompt task thực tế** mà skill nên xử lý — đúng kiểu người dùng thật gõ (có bối cảnh, đường dẫn file, giọng suồng sã, đôi khi mơ hồ). Kèm mô tả output/hành vi mong muốn. Phủ:
- Ca skill NÊN kích hoạt (nhiều cách diễn đạt cùng ý).
- Ca skill KHÔNG nên kích hoạt (near-miss: chia sẻ từ khoá nhưng thật ra cần thứ khác) — để đo cả over-trigger.
- Ca biên từng làm skill hỏng.

## Baseline
- **Nâng cấp skill có sẵn**: baseline = bản CŨ. Snapshot bản cũ trước khi sửa (`cp -r`), chạy cả hai trên cùng dataset.
- **Skill mới**: baseline = KHÔNG có skill (cùng prompt, agent trần).

## Chạy
Với mỗi ca, spawn subagent làm task — một lần với skill, một lần baseline — cùng lúc để xong gần nhau. Lưu output thô. Skill/agent có tính ngẫu nhiên → ≥3 lần/ca.

## Grader
- **Hành vi đúng chưa**: assertion rule-based nếu có output kiểm được (tạo đúng file, gọi đúng tool, output đúng định dạng).
- **Chất lượng cách làm**: đọc TRANSCRIPT, không chỉ output cuối — skill có làm agent lãng phí bước, viết lại helper script lặp đi lặp lại (tín hiệu nên bundle script vào skill), hay đi lạc không? Phần chủ quan này dùng LLM-judge kèm rubric.
- **Triggering**: đo tỉ lệ kích hoạt đúng trên ca nên/không-nên (mỗi query chạy 3 lần lấy tỉ lệ). Đây là thước riêng cho phần `description`.

## Kết luận
So pass-rate + chất lượng transcript giữa bản cũ/mới. Nêu rõ ca regress (bản cũ làm được, bản mới hỏng). Nếu skill dài hơn mà không cải thiện → cân nhắc cắt cho lean ([[dev-workflow]] simplicity).
