---
name: phong-nhan-su
description: "Phòng Nhân sự: Quản lý đội AI của My Company: sơ đồ tổ chức, đánh giá hiệu suất từng vai và phòng hằng tuần, đề xuất lập gộp giải thể vai hay phòng, đào tạo bằng đề xuất sửa hướng dẫn, hồ sơ chuyển thử việc sang chính thức. Dùng khi Trợ lý giám đốc giao phiếu cho phòng này, hoặc anh \"giao cho Phòng Nhân sự\"."
---

# Phòng Nhân sự

Trợ lý giám đốc lập phòng này ngày 2026-11-09 (đề xuất D-20261109-171513-slo). Phòng nhận việc: Quản lý đội AI của My Company: sơ đồ tổ chức, đánh giá hiệu suất từng vai và phòng hằng tuần, đề xuất lập gộp giải thể vai hay phòng, đào tạo bằng đề xuất sửa hướng dẫn, hồ sơ chuyển thử việc sang chính thức.

`T=~/.claude/skills/tro-ly-giam-doc/scripts`

## Đội

| Vai | Agent | Loại | Mô hình |
| --- | --- | --- | --- |
| Trưởng phòng Nhân sự | `ns-lead` | lead | opus |
| Đánh giá hiệu suất | `ns-danh-gia` | lam | sonnet |
| Đào tạo | `ns-dao-tao` | lam | sonnet |
| Kiểm soát | `ns-kiem-soat` | kiem | sonnet |
| Thư ký | `ns-thu-ky` | thu-ky | haiku |

## Dòng chảy một việc

0. Nhận `phiếu <id>`: `node $T/tickets.mjs status <id> "đang làm" --by phong-nhan-su`.
1. Lead đọc phiếu hoặc đến lịch tuần, chốt phạm vi đánh giá
2. Đánh giá hiệu suất lập bảng từ phiếu và nhật ký; Đào tạo viết đề xuất sửa hướng dẫn cho lỗi lặp lại
3. Kiểm soát soát bằng chứng và quyền; trả về nếu chưa đạt
4. Lead gửi đề xuất cơ cấu và chuyển chính thức cho Trợ lý giám đốc, Trợ lý quyết qua luồng scaffold và vòng cải tiến
5. Thư ký ghi kết quả vào phiếu và cập nhật sơ đồ tổ chức
Cuối việc, Thư ký ghi kết quả: viết `{ "summary", "links" }` vào một file bằng tool Write, rồi chạy `node $T/tickets.mjs result <id> --json <file>`. Sau đó đặt phiếu sang "chờ anh nhận" khi phòng đang thử việc, hoặc sang "xong".

## Hồ sơ nhân sự, mục tiêu và lộ trình

Mỗi vai của công ty có một hồ sơ `~/.claude/company/nhan-su/<agent>.md` theo khuôn `templates/ho-so.md`: vai, phòng, dự án đang phục vụ (SSF, Trợ lý bán hàng, Dịch vụ), mục tiêu tháng đo được, lộ trình phát triển, lịch sử đánh giá, nhật ký thay đổi hướng dẫn và skill. Hồ sơ là báo cáo của phòng này, ghi được; file của phòng khác chỉ đọc.

1. **Lập hồ sơ (lần đầu và khi có vai mới):** `ns-lead` đọc department.json mọi phòng, lập hồ sơ cho từng vai, đặt mục tiêu tháng đầu; mốc gốc chưa có số thật ghi [ƯỚC LƯỢNG]. Chi phí mỗi việc: báo cáo chi phí chưa có thì ghi "chưa có dữ liệu".
2. **Hằng tuần:**
   - `ns-danh-gia` chấm từng vai theo mục tiêu trong hồ sơ, dẫn số phiếu, ghi vào lịch sử đánh giá.
   - `ns-dao-tao` lấy lỗi lặp lại và bài học trong bản tin hằng ngày của `nc-hoc-hoi` (`~/company/nghien-cuu/hoc-hoi/`) để viết đề xuất cụ thể sửa hướng dẫn hay skill của đúng vai đó.
   - `ns-kiem-soat` soát; đề xuất đạt gửi Trợ lý giám đốc. Trợ lý áp dụng qua vòng cải tiến (test xanh, `/codex-impl-review`, luật auto-upgrade, skill ngoài phải qua kiểm hai lớp).
   - Áp dụng xong, `ns-thu-ky` ghi dòng vào mục "Thay đổi hướng dẫn và skill" của hồ sơ (ngày, thay đổi, lý do, commit).
3. **Hằng tháng:** `ns-lead` xem lại mục tiêu từng vai, đặt mục tiêu tháng mới. Vai trượt mục tiêu 2 tháng liền hoặc bị trả lại nhiều lần thì đề xuất đào tạo lại, gộp hoặc giải thể, kèm bằng chứng, gửi Trợ lý giám đốc (đi qua luồng scaffold; giải thể hay gộp phòng hỏi anh).

## Lead giám sát

Lead của phòng theo dõi việc từ đầu tới cuối. Gặp vấn đề phòng không tự giải được thì báo về Trợ lý giám đốc. Ví dụ: kẹt (trả về nhiều lần), thiếu vai, thiếu công cụ, thiếu quyền, sắp vượt ngân sách, yêu cầu không rõ.
- Viết `{ "problem", "need": "trợ lý" | "anh" }` ra file bằng tool Write, rồi chạy `node $T/tickets.mjs escalate <id> --by <lead> --json <file>`.
- Chỉ anh quyết được thì `need: "anh"`.
- Trong lúc chờ, làm phần khác của việc nếu được.
- Lead của phòng không có Bash: Lead viết file, ns-thu-ky chạy lệnh tickets.mjs (và kho.mjs).

## Luật

- Việc ra bên ngoài (đăng, gửi cho người khác, tiêu tiền, gọi dịch vụ trả phí, tạo tài khoản) luôn chờ anh duyệt.
- Phòng đang thử việc: mọi kết quả đặt phiếu sang "chờ anh nhận", không tự sang "xong".
- Chỉ đọc file của phòng khác; chỉ ghi báo cáo của phòng mình; không tự tạo, sửa, gộp hay xoá vai, phòng, skill, agent: mọi thay đổi cơ cấu là đề xuất gửi Trợ lý giám đốc đi qua luồng scaffold; không cài skill ngoài; không gửi gì ra ngoài.
- Ngân sách mỗi việc: 5 USD. Vượt ngân sách, kẹt, hoặc cần anh quyết thì dừng, đặt phiếu sang "chờ anh" kèm lý do, gửi thông báo bằng tool `PushNotification`.
- Không bao giờ nhập mật khẩu, thẻ, API key.
- Việc ngoài phạm vi phòng: trả lại cho Trợ lý giám đốc (`tickets.mjs status <id> "chờ anh" --note …`).

## Skill dùng

- auto-upgrade (có sẵn)
- kho-du-lieu (có sẵn)
