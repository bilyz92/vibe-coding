---
name: local-docs
description: Tạo tài liệu thành file trên máy, không tạo trên Claude Docs hay artifact. Dùng khi user nhờ viết hoặc tạo docs, tài liệu, báo cáo, đặc tả, hướng dẫn, ghi chú, biên bản, kể cả khi chỉ nói "làm file mới", "tạo tài liệu", "viết docs". Dùng trước skill docs và trước mọi lệnh tạo Claude Docs. Chỉ bỏ qua khi user nêu rõ muốn dùng Claude Docs, artifact hoặc Google Docs.
---

# Local Docs — tài liệu là file trên máy

Mặc định ghi tài liệu thành file trong thư mục dự án. Không tạo tài liệu Claude Docs hay artifact, trừ khi user yêu cầu đích danh.

Lý do: user muốn tài liệu nằm trên máy. Trong một phiên ngày 01/11/2026, hai tài liệu Claude Docs đều bị mất quyền đọc và ghi khi đang viết dở, nên bản tải về chỉ có 4/7 phần.

## Cách làm

1. **Chọn đường dẫn.** Mặc định là `docs/<ten-tai-lieu>.md` trong dự án hiện tại, dùng chữ thường và gạch nối. Nếu user nêu vị trí hoặc định dạng thì làm theo.
2. **Kiểm tra trước khi ghi.** Xem file cùng tên đã có chưa. Có rồi thì đọc trước, không ghi đè nếu chưa được đồng ý.
3. **Đọc nguồn trước khi viết.** Chỉ ghi điều lấy được từ nguồn hoặc từ user. Suy luận của mình thì ghi rõ là đề xuất hoặc nhận định.
4. **Viết trọn file.** Dùng Markdown; sơ đồ dùng khối `mermaid`, công thức viết dạng chữ thường để trình xem nào cũng đọc được.
5. **Kiểm tra lại.** Soát đủ các mục đã hứa bằng `grep '^## '`, và các số liệu đã nêu trong câu trả lời, ví dụ số sơ đồ.
6. **Báo kết quả.** Nêu đường dẫn đầy đủ của file và điều chưa làm được.

## Định dạng khác

Chỉ tạo Word, PDF hoặc định dạng khác khi user yêu cầu. Nếu Markdown đã có sẵn thì chuyển đổi từ file đó.

## Không làm

- Không tạo khung tài liệu Claude Docs "cho nhanh" rồi mới chuyển sang file.
- Không hỏi lại user muốn lưu ở đâu khi đường dẫn mặc định dùng được.
- Không commit hoặc push tài liệu nếu user chưa yêu cầu.
