---
name: eval-framework
description: Khung đánh giá ĐỊNH LƯỢNG, độc lập dự án — biến "tôi nghĩ nó tốt hơn" thành số đo lặp lại được. Vòng lặp chung dataset (bộ ca kiểm thử) → chạy → chấm (rule hoặc LLM-làm-giám-khảo) → so sánh giữa các phiên bản → báo cáo pass/fail + regression. Dùng khi cần biết một thay đổi có THẬT SỰ tốt lên không: sau khi nâng cấp một skill/agent của mình, khi build/sửa tính năng AI trong sản phẩm (prompt, RAG, phân loại, LLM-judge), khi muốn chấm chất lượng code do agent sinh ra theo tiêu chí, hoặc bất cứ khi nào ai đó nói "cái mới tốt hơn/ổn hơn/nhanh hơn" mà chưa có bằng chứng. Trigger cả khi user nói "đo/benchmark/đánh giá/so sánh phiên bản/eval/regression/A-B/chấm điểm/dataset test".
---

# Eval Framework — đánh giá định lượng, lặp lại được

Đóng gói kỷ luật eval để không rơi vào bẫy "vibe check": đổi một prompt/skill/đoạn code rồi tự tin "ổn hơn rồi" mà không có số. Không có dataset + grader cố định thì mọi so sánh chỉ là ấn tượng — và ấn tượng thiên vị về phía cái mình vừa làm. Skill này ép: **cố định bộ ca kiểm thử trước, chấm cùng một thước, so cùng một điều kiện.** Bổ trợ [[dev-workflow]] (verify bằng bằng chứng) và [[self-upgrade-principle]] (nâng cấp phải chứng minh được là tiến bộ).

## When to Use

- Sau khi nâng cấp một skill/agent của mình → chứng minh nó tốt lên chứ không phải thấy vậy ([[auto-upgrade-skill-loop]]).
- Khi build/sửa tính năng AI trong sản phẩm (prompt, RAG, phân loại, trích xuất, LLM-judge) → cần biết đổi có cải thiện không, có làm hỏng ca cũ không.
- Khi muốn chấm chất lượng output (code, văn bản sinh ra) theo tiêu chí, lặp lại được giữa các lần.
- Khi ai đó (kể cả chính bạn) nói "cái mới tốt hơn/nhanh hơn" mà chưa có số → dừng, đo.

KHÔNG cần dùng cho: chạy một lệnh một lần rồi bỏ; thay đổi thuần cơ học không có "chất lượng output" để đo (đổi tên biến, sửa typo); khi user rõ ràng chỉ muốn "vibe, đừng eval".

## Nguyên tắc cốt lõi (đọc trước khi làm)

1. **Cố định dataset TRƯỚC khi thấy kết quả.** Chọn ca kiểm thử dựa trên hành vi mong muốn, không phải sau khi đã biết cái nào đang thắng — nếu không bạn sẽ vô thức chọn ca có lợi cho phiên bản mình thích.
2. **Cùng một thước cho mọi phiên bản.** Grader (bộ chấm) phải giống hệt nhau khi chấm bản cũ và bản mới. Đổi thước giữa chừng = so sánh vô nghĩa.
3. **Baseline là bắt buộc.** "Tốt hơn" luôn là tốt hơn *so với cái gì*. Luôn chạy cả bản nền (bản cũ / không-skill / prompt gốc) trong cùng điều kiện.
4. **Regression quan trọng ngang cải thiện.** Một thay đổi làm 8 ca tốt lên nhưng 2 ca hỏng đi có thể là thụt lùi. Báo cáo phải nêu ca xấu đi, không chỉ điểm trung bình.
5. **Đủ mẫu để không bị nhiễu.** Với grader có tính ngẫu nhiên (LLM-judge, model sinh), chạy mỗi ca ≥3 lần và báo mean ± độ lệch; 1 lần chạy không phải bằng chứng.

## Process

1. **Xác định đối tượng + tiêu chí thành công** → verify: viết 1 câu "cái gì được coi là tốt hơn" đo được (vd: "tỉ lệ ca pass tăng, không ca nào regress", "độ chính xác phân loại ≥ 90%", "thời gian/token giảm mà pass-rate không giảm"). Chọn domain ở bảng dưới để lấy chi tiết.
2. **Dựng dataset** → verify: có ≥5–10 ca (input + output/hành vi mong muốn), phủ ca thường + ca biên + ca dễ sai trước đây. Lưu thành file cố định (JSON/thư mục), version-control được. Xem `references/dataset-and-grading.md`.
3. **Chọn grader** → verify: mỗi ca có cách chấm khách quan. Ưu tiên **rule-based** (so khớp, regex, chạy test, assertion) khi output kiểm được máy móc; dùng **LLM-as-judge** chỉ cho tiêu chí chủ quan (mạch lạc, đúng ý, chất lượng lý luận) — kèm rubric rõ. Chi tiết + cách tránh thiên vị judge: `references/dataset-and-grading.md`.
4. **Chạy cả bản mới VÀ baseline cùng điều kiện** → verify: cùng dataset, cùng grader, cùng tham số. Grader ngẫu nhiên → chạy mỗi ca ≥3 lần. Ghi lại cả pass/fail lẫn chi phí (thời gian, token) nếu quan trọng.
5. **Tổng hợp + so sánh** → verify: bảng pass-rate (mean ± stddev) theo phiên bản + delta; **liệt kê riêng ca regress** (baseline pass → bản mới fail). Đừng để điểm trung bình che ca hỏng.
6. **Kết luận theo tiêu chí bước 1** → verify: nói thẳng đạt/không đạt kèm số. Nếu cải thiện đi kèm regression hoặc tăng chi phí → nêu tradeoff, không tuyên bố "tốt hơn" trơn.

Chi tiết theo domain — đọc file tương ứng khi bắt tay làm:

| Đối tượng eval | Dataset là gì | Grader điển hình | Đọc |
|---|---|---|---|
| Skill / agent của mình | Các prompt task mẫu | so output/hành vi + assertion, có thể LLM-judge | `references/domain-skill-agent.md` |
| Tính năng AI trong sản phẩm | Input + output kỳ vọng (gold) | rule (khớp/độ chính xác) hoặc LLM-judge | `references/domain-ai-feature.md` |
| Chất lượng code output | Yêu cầu code + tiêu chí (đúng/đơn giản/có test) | chạy test + rubric ([[clean-code]]) | `references/domain-code-quality.md` |

## Rationalizations — các cớ cần phản bác

| Cái cớ | Phản bác |
|--------|----------|
| "Chạy thử 1 ca thấy ổn rồi" | 1 ca không phải dataset; và ổn ở ca bạn chọn ≠ ổn nói chung. |
| "Nhìn là biết bản mới tốt hơn" | Trực giác thiên vị về cái mình vừa làm; đó chính là lý do cần grader cố định. |
| "Khỏi cần baseline, rõ ràng mà" | "Tốt hơn" vô nghĩa nếu không so với cái gì; luôn chạy bản nền. |
| "Điểm trung bình tăng là được" | Trung bình che regression; 2 ca hỏng có thể quan trọng hơn 8 ca nhích lên. |
| "LLM-judge chấm là đủ khách quan" | Judge thiên vị (vị trí, độ dài, tự khen). Cần rubric + kiểm chéo; rule-based thì ưu tiên. |
| "Dataset nhỏ nên đo sau, giờ cứ sửa" | Dataset viết sau khi thấy kết quả sẽ bị uốn theo kết quả; cố định trước. |

## Red Flags — dừng lại

- Tuyên bố "tốt hơn/nhanh hơn" mà không có baseline chạy cùng điều kiện.
- Dataset được chọn/sửa SAU khi đã xem phiên bản nào thắng.
- Đổi grader giữa lúc so bản cũ và bản mới.
- Chỉ báo điểm trung bình, không rà ca regress.
- Grader ngẫu nhiên nhưng chỉ chạy 1 lần/ca.
- LLM-judge không có rubric, hoặc judge biết phiên bản nào là "của mình".
- Ép assertion cứng lên tiêu chí chủ quan (hoặc ngược lại: dùng judge cho thứ máy chấm được).

## Verification checklist

- [ ] Có tiêu chí thành công đo được, viết trước khi chạy.
- [ ] Dataset cố định (file version-control), ≥5–10 ca, phủ ca biên; dựng TRƯỚC khi xem kết quả.
- [ ] Mỗi ca có grader khách quan; rule-based khi chấm được bằng máy, LLM-judge kèm rubric cho phần chủ quan.
- [ ] Đã chạy baseline (bản cũ / không-skill / prompt gốc) cùng dataset + grader + tham số.
- [ ] Grader ngẫu nhiên → chạy ≥3 lần/ca, báo mean ± stddev.
- [ ] Báo cáo có bảng so sánh + delta + DANH SÁCH ca regress riêng.
- [ ] Kết luận đạt/không đạt bám tiêu chí bước 1; nêu tradeoff nếu có (regression/chi phí).
