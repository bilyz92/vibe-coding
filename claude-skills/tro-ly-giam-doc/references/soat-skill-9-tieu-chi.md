# Soát skill theo 9 tiêu chí

> Dùng khi tạo mới hoặc sửa một `SKILL.md` hay hướng dẫn agent. Ý tưởng từ ghi chú `~/project/my-office/docs/drive-pham-nhan-marketing.md`, viết lại bằng lời của mình. Đây là checklist đọc bằng mắt, không thay `skill-audit` hay Codex review.

Chấm từng dòng ĐẠT / CHƯA ĐẠT, chỉ rõ câu nào trong skill làm căn cứ. Không có câu căn cứ là CHƯA ĐẠT.

| # | Tiêu chí | ĐẠT khi |
| --- | --- | --- |
| 1 | Mục tiêu dùng | Nói rõ skill làm việc gì, dùng khi nào, không dùng khi nào; `description` đủ để nhận đúng việc |
| 2 | Vai trò AI | Nói rõ AI đóng vai gì, được quyết gì, phải hỏi anh gì |
| 3 | Đầu vào | Liệt kê thứ cần có trước khi làm, và xử lý thế nào khi thiếu |
| 4 | Tài liệu tham chiếu | Nói đọc file nào, lúc nào, dùng vào việc gì; hai nguồn lệch nhau thì theo nguồn nào |
| 5 | Quy trình | Các bước theo thứ tự, mỗi bước làm được ngay; có cổng chờ anh ở việc ra ngoài hay không đảo ngược |
| 6 | Đầu ra | Định dạng, nơi lưu, tên file, ai nhận |
| 7 | Tiêu chí đạt | Kiểm được bằng số đo, lệnh hoặc bằng chứng, không chỉ "tốt", "đẹp" |
| 8 | Rào chắn | Có đủ rào bắt buộc ở mục dưới |
| 9 | Độ gọn | Không lặp, không câu thừa; phần dài tách ra `references/` |

## Rào bắt buộc (tiêu chí 8)

Skill có tạo nội dung cho khách hoặc ra bên ngoài thì phải ghi rõ:

- **Không tự thêm claim, giá, số liệu.** Chỉ dùng những gì có trong brief, kho hoặc trang bán. Thiếu thì ghi `[CHƯA CÓ]` và báo, không đoán.
- Không tự thêm chính sách (đổi trả, giao hàng, bảo hành), lời khách, tên khách.
- Không dùng "nhất", "số 1", "tốt nhất" khi không có bằng chứng.
- Việc ra bên ngoài, tiêu tiền, không đảo ngược: chờ anh duyệt.

Thiếu một trong các dòng trên thì tiêu chí 8 CHƯA ĐẠT. Skill chỉ làm việc nội bộ (không tạo nội dung cho khách) thì ghi KHÔNG ÁP DỤNG cho ba dòng đầu, kèm lý do.

## Kết quả trả về (4 phần)

1. **Mức sẵn sàng:** chưa nên dùng (tiêu chí 1, 5 hoặc 8 CHƯA ĐẠT) / dùng thử (còn tiêu chí khác CHƯA ĐẠT) / sẵn sàng (đạt cả 9).
2. **Nhận xét:** 2–3 câu về điểm chính.
3. **Bảng sửa:** vấn đề, vì sao, sửa thế nào.
4. **Bản đề xuất:** đoạn thay thế cho phần cần sửa, chưa áp vào skill khi anh chưa đồng ý (trừ khi đang trong luồng tạo skill đã duyệt).
