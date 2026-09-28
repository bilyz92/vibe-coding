# Domain: eval tính năng AI trong sản phẩm

Nạp khi đánh giá một tính năng LLM bạn build trong dự án: prompt cho một chức năng, RAG, phân loại, trích xuất field, hay một LLM-judge nội bộ. Với HRM/Next.js, đây là các endpoint/service gọi model.

## Dataset
Mỗi ca = **input thật + output kỳ vọng (gold)**. Nguồn tốt nhất: dữ liệu thật đã ẩn danh + đáp án do người xác nhận. Phủ:
- Ca thường theo phân bố thực tế.
- Ca biên: input rỗng/quá dài/nhiều ngôn ngữ, tiếng Việt có dấu, ký tự đặc biệt, prompt-injection nếu input từ người dùng.
- Ca đã từng sai trong prod → thêm làm ca hồi quy.

## Baseline
Prompt/model/pipeline **hiện tại** (đang chạy prod). Mọi thay đổi (đổi prompt, đổi model, thêm RAG) so với nó trên cùng dataset. Đừng đổi nhiều biến một lúc — mỗi lần đổi 1 thứ để biết cái nào tạo ra khác biệt.

## Grader theo loại tính năng
- **Phân loại / trích xuất**: rule-based. Đo accuracy, và với lớp mất cân bằng thì precision/recall/F1 theo lớp — accuracy đơn lẻ dễ đánh lừa.
- **Trích xuất JSON có cấu trúc**: assert đúng schema + đúng giá trị từng field.
- **Sinh văn bản tự do (tóm tắt, trả lời)**: LLM-judge kèm rubric (đúng ý? bám nguồn? không bịa?). Kèm check rule cho ràng buộc cứng (độ dài, phải nhắc field bắt buộc).
- **RAG**: đo riêng *retrieval* (có lấy đúng tài liệu chứa đáp án không) và *generation* (câu trả lời có đúng theo tài liệu, không bịa). Grounding/faithfulness quan trọng ngang độ đúng.

## Lưu ý
- LLM có nhiễu → mỗi ca chạy ≥3 lần, báo mean ± stddev. Nhiệt độ 0 giảm nhiễu nhưng không loại hết.
- Đo cả **chi phí** (token, độ trễ) — một prompt tốt hơn 2% nhưng đắt gấp đôi có thể không đáng.
- Regression trong tính năng prod = rủi ro thật cho người dùng → mục ca regress phải rõ ràng, chặn ship nếu có ca quan trọng hỏng.
