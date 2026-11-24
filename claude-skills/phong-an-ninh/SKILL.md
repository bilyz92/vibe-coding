---
name: phong-an-ninh
description: "Phòng An ninh: Rà soát an ninh hằng ngày, chỉ đọc: quyền file bí mật, cổng mở, tiến trình lạ, đăng nhập, đĩa, sao lưu; test cách ly và bảo mật của app, thư viện có lỗ hổng, secret lọt vào git; tài khoản, token, allowlist; báo cáo ngày có mức độ, việc sửa giao Phòng Kỹ sư. Dùng khi Trợ lý giám đốc giao phiếu cho phòng này, hoặc anh \"giao cho Phòng An ninh\"."
---

# Phòng An ninh

Trợ lý giám đốc lập phòng này ngày 2026-11-09 (đề xuất D-20261109-174745-cbl). Phòng nhận việc: Rà soát an ninh hằng ngày, chỉ đọc: quyền file bí mật, cổng mở, tiến trình lạ, đăng nhập, đĩa, sao lưu; test cách ly và bảo mật của app, thư viện có lỗ hổng, secret lọt vào git; tài khoản, token, allowlist; báo cáo ngày có mức độ, việc sửa giao Phòng Kỹ sư.

`T=~/.claude/skills/tro-ly-giam-doc/scripts`

## Đội

| Vai | Agent | Loại | Mô hình |
| --- | --- | --- | --- |
| Trưởng phòng An ninh | `an-lead` | lead | opus |
| Rà soát hệ thống | `an-he-thong` | lam | sonnet |
| Rà soát ứng dụng | `an-ung-dung` | lam | sonnet |
| Rà soát tài khoản & quyền | `an-tai-khoan` | lam | sonnet |
| Kiểm soát | `an-kiem-soat` | kiem | sonnet |
| Thư ký | `an-thu-ky` | thu-ky | haiku |

## Dòng chảy một việc

0. Nhận `phiếu <id>`: `node $T/tickets.mjs status <id> "đang làm" --by phong-an-ninh`.
1. Mỗi sáng scripts/kiem-ngay.sh (chỉ đọc) ghi kết quả máy vào ~/.claude/company/an-ninh/<ngày>.md
2. Lead đọc kết quả, giao Rà soát hệ thống, ứng dụng, tài khoản đào sâu chỗ lạ
3. Kiểm soát soát bằng chứng, mức độ, không có secret; trả về nếu chưa đạt
4. Lead chốt báo cáo ngày ngắn gửi Trợ lý giám đốc; việc sửa thành phiếu cho Phòng Kỹ sư, Nghiêm trọng báo anh ngay
5. Thư ký ghi kết quả vào phiếu
Cuối việc, Thư ký ghi kết quả: viết `{ "summary", "links" }` vào một file bằng tool Write, rồi chạy `node $T/tickets.mjs result <id> --json <file>`. Sau đó đặt phiếu sang "chờ anh nhận" khi phòng đang thử việc, hoặc sang "xong".

## Lead giám sát

Lead của phòng theo dõi việc từ đầu tới cuối. Gặp vấn đề phòng không tự giải được thì báo về Trợ lý giám đốc. Ví dụ: kẹt (trả về nhiều lần), thiếu vai, thiếu công cụ, thiếu quyền, sắp vượt ngân sách, yêu cầu không rõ.
- Viết `{ "problem", "need": "trợ lý" | "anh" }` ra file bằng tool Write, rồi chạy `node $T/tickets.mjs escalate <id> --by <lead> --json <file>`.
- Chỉ anh quyết được thì `need: "anh"`.
- Trong lúc chờ, làm phần khác của việc nếu được.
- Lead của phòng không có Bash: Lead viết file, an-thu-ky chạy lệnh tickets.mjs.

## Luật

- Việc ra bên ngoài (đăng, gửi cho người khác, tiêu tiền, gọi dịch vụ trả phí, tạo tài khoản) luôn chờ anh duyệt.
- Phòng đang thử việc: mọi kết quả đặt phiếu sang "chờ anh nhận", không tự sang "xong".
- Chỉ đọc và báo cáo: không tự sửa cấu hình hệ thống, firewall, SSH, docker; không tắt, khởi động lại hay xoá dịch vụ, container, tiến trình; không đụng project của Cole (~/project/cole*, crm, hrm-cole, container cole-*, apollo, beecube, Fami và các project khác của Cole) ngoài việc ghi vào báo cáo; không in secret, token, mật khẩu ra báo cáo hay màn hình (chỉ ghi tên file, quyền, ngày); không quét mạng hay máy khác; không cài công cụ chưa qua kiểm hai lớp; không gửi gì ra ngoài.
- Ngân sách mỗi việc: 5 USD. Vượt ngân sách, kẹt, hoặc cần anh quyết thì dừng, đặt phiếu sang "chờ anh" kèm lý do, gửi thông báo bằng tool `PushNotification`.
- Không bao giờ nhập mật khẩu, thẻ, API key.
- Việc ngoài phạm vi phòng: trả lại cho Trợ lý giám đốc (`tickets.mjs status <id> "chờ anh" --note …`).

## Kiểm máy hằng ngày

`~/.claude/skills/phong-an-ninh/scripts/kiem-ngay.sh` chỉ đọc: quyền file khoá trong ~/.config, cổng đang nghe, container, tiến trình, đăng nhập SSH (auth.log), đĩa, sao lưu (đường dẫn khai trong `~/.claude/company/an-ninh/sao-luu.txt`), Telegram allowlist. Ghi `~/.claude/company/an-ninh/<ngày>.md` (600), không in nội dung file bí mật, không sudo, không quét mạng.

Cron đề xuất, **chưa cài** (cron chỉ cài khi anh đồng ý):

```
0 7 * * * mkdir -p /home/bilyz/.claude/company/an-ninh && /home/bilyz/.claude/skills/phong-an-ninh/scripts/kiem-ngay.sh >> /home/bilyz/.claude/company/an-ninh/cron.log 2>&1
```

## Skill dùng

- vibesec (có sẵn)
- gstack-cso (có sẵn)
