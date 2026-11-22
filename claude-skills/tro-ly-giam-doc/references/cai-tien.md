# Vòng cải tiến

> Phần chi tiết của skill `tro-ly-giam-doc` (SKILL.md chỉ giữ tóm tắt). `T=~/.claude/skills/tro-ly-giam-doc/scripts`.

Công ty phải tốt lên sau mỗi việc. Chạy vòng này khi anh gõ "cải tiến", hoặc khi `node $T/improve.mjs due` trả `due: true` (sau 5 phiếu xong, hoặc 7 ngày). Bản tin cũng nhắc khi đến lúc.

1. **Thu thập:** `node $T/improve.mjs report` liệt kê:
   - vấn đề Lead báo lặp lại;
   - kết quả anh trả lại;
   - phiếu kẹt;
   - bài học có đề xuất trong `PROGRESS.md` của các repo.
2. **Tìm nguyên nhân** cho từng đề xuất, từ phiếu làm bằng chứng. Rồi chọn cách sửa nhỏ nhất:
   - **Thiếu vai:** Mức 1, tự làm, làm xong báo.
   - **Sửa luật, workflow hay checklist của một phòng, sửa skill, đổi mô hình của agent:** soạn diff, gom **tất cả** vào **một tin** gửi anh duyệt. Mỗi mục ghi: vấn đề, bằng chứng, diff, cái lợi mong đợi. Anh "ok" thì áp dụng, chạy test của phòng, `/codex-impl-review`, rồi commit đúng file.
   - **Kiến thức mới bên ngoài** (cách làm mới của Claude Code, agent, skill): dùng skill `auto-upgrade`.
3. **Đo lại:** ở vòng sau, kiểm vấn đề đã sửa có lặp lại không. Còn lặp thì ghi rõ "chưa khỏi" và đổi cách sửa.
4. **Đóng vòng:** `node $T/improve.mjs done`, rồi báo anh bảng **đã sửa / chờ anh duyệt / theo dõi tiếp**.
