# Dataset & Grading — chi tiết cách dựng bộ ca và chấm

Nạp file này khi đã chọn được đối tượng eval và cần dựng dataset + grader cụ thể.

## Mục lục
- [Dựng dataset](#dựng-dataset)
- [Grader: rule-based](#grader-rule-based)
- [Grader: LLM-as-judge](#grader-llm-as-judge)
- [Tránh thiên vị LLM-judge](#tránh-thiên-vị-llm-judge)
- [Định dạng lưu & tổng hợp](#định-dạng-lưu--tổng-hợp)

## Dựng dataset

Một "ca" (case) tối thiểu gồm: `id`, `input` (prompt/dữ liệu vào), và **hành vi/output mong muốn** (gold answer, hoặc mô tả tiêu chí đạt).

Nguyên tắc chọn ca:
- **Phủ 3 nhóm**: ca thường (happy path), ca biên (rỗng, cực lớn, ký tự lạ, tiếng Việt dấu), ca từng sai trước đây (mỗi bug đã sửa → 1 ca hồi quy).
- **Đa dạng phrasing** nếu đối tượng nhạy với cách diễn đạt (skill/prompt): cùng ý, viết trang trọng lẫn nói suồng sã.
- **Cố định trước khi thấy kết quả.** Nếu thêm ca sau khi đã biết bản nào thắng, ghi rõ ca đó là "thêm sau" và diễn giải thận trọng.
- **Kích cỡ**: 5–10 ca đủ để bắt đầu lặp nhanh; mở rộng 20–50+ khi cần độ tin cậy trước khi "chốt".

## Grader: rule-based

Ưu tiên tuyệt đối khi output kiểm được bằng máy — nhanh, tất định, tái dùng được, không thiên vị:
- **So khớp chính xác / chuẩn hoá** (trim, lowercase) cho output rời rạc (nhãn phân loại, mã, JSON field).
- **Regex / chứa chuỗi** cho "phải nhắc tới X", "đúng định dạng Y".
- **Chạy test / assertion** cho code: viết script chấm, đừng nhìn bằng mắt. Script tái dùng qua các iteration.
- **Ngưỡng số** cho metric: độ chính xác, recall, số token, độ trễ.

Mỗi assertion đặt tên mô tả (đọc là hiểu nó kiểm gì), trả `passed` + `evidence` (bằng chứng cụ thể vì sao đạt/trượt).

## Grader: LLM-as-judge

Chỉ dùng cho tiêu chí CHỦ QUAN mà rule không bắt được: mạch lạc, đúng ý người dùng, chất lượng lý luận, giọng văn. Yêu cầu:
- **Rubric rõ ràng**: nêu thang điểm + tiêu chí cụ thể ("cho 1–5: 5 = trả lời đúng câu hỏi VÀ nêu được ràng buộc; 3 = đúng nhưng thiếu ràng buộc; 1 = lạc đề"). Rubric mơ hồ → điểm nhiễu.
- **Yêu cầu judge nêu lý do trước, điểm sau** (chain-of-thought ngắn) — điểm bám lý do đáng tin hơn.
- **Chạy nhiều lần** (≥3) và lấy trung bình vì judge có nhiễu.

## Tránh thiên vị LLM-judge

Judge LLM có các thiên vị đã biết — trung hoà chúng:
- **Position bias**: khi so A/B, judge hay thiên vị vị trí đầu. → Đảo thứ tự một nửa số lần, hoặc chấm mù (không cho biết đâu là "bản của mình").
- **Length/verbosity bias**: hay chấm cao câu dài hơn. → Rubric nói rõ "ngắn gọn không bị trừ điểm".
- **Self bias**: model hay ưu ái output do chính họ của mình sinh. → Chấm mù + rule-based cho phần đo được.
- **Sanity check**: thỉnh thoảng đưa 1 ca có đáp án rõ để chắc judge không loạn.

Với so sánh 2 phiên bản nghiêm túc: đưa 2 output cho judge độc lập KHÔNG nói đâu là bản nào, rồi mới phân tích vì sao bên thắng thắng.

## Định dạng lưu & tổng hợp

Gợi ý cấu trúc (điều chỉnh theo dự án):

```
evals/
  dataset.json         # danh sách ca cố định
  runs/
    <version>/
      case-<id>.json   # output thô mỗi ca (nhiều lần chạy)
      grading.json     # {case_id, passed, evidence} mỗi assertion
  report.md            # bảng so sánh + delta + danh sách regress
```

`dataset.json` mỗi ca:
```json
{ "id": "classify-empty-input", "input": "...", "expected": "...", "notes": "ca biên: input rỗng" }
```

Báo cáo phải có: pass-rate mỗi phiên bản (mean ± stddev nếu nhiều lần), delta so baseline, chi phí (thời gian/token) nếu quan trọng, và **mục riêng liệt kê ca regress** (baseline pass → bản mới fail).
